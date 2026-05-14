"""
El Secretario — Gestor de Google Calendar
Pinnacle Holdings Group

Lee agenda diaria y envía resumen a Jorge por Telegram.
Permite crear citas desde Telegram con /cita.

SETUP INICIAL (una sola vez):
  python3 calendar_manager.py --setup
  Seguir instrucciones para autorizar con Google OAuth.
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_DIR / ".env")
except ImportError:
    pass

import requests

# Intentar importar Google Calendar — opcional
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────
TELEGRAM_TOKEN  = os.getenv("TELEGRAM_TOKEN", "[REDACTED_TELEGRAM_BOT_TOKEN]")
OWNER_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "8402370952")
GOOGLE_CAL_ID   = os.getenv("GOOGLE_CALENDAR_ID", "deals@pinnaclegroupwi.com")

SCOPES = ["https://www.googleapis.com/auth/calendar"]
CREDS_DIR       = PROJECT_DIR / "secretario" / "google_creds"
SA_FILE         = CREDS_DIR / "service_account.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [CALENDAR] %(levelname)s — %(message)s",
    handlers=[
        logging.FileHandler(PROJECT_DIR / "agents" / "secretario.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# AUTENTICACIÓN GOOGLE
# ─────────────────────────────────────────────
def get_google_service():
    """Retorna cliente autenticado de Google Calendar usando Service Account."""
    if not GOOGLE_AVAILABLE:
        log.error("Google Calendar libs no instaladas.")
        return None

    if not SA_FILE.exists():
        log.error(f"Service account JSON no encontrado en {SA_FILE}")
        return None

    try:
        creds = service_account.Credentials.from_service_account_file(
            str(SA_FILE), scopes=SCOPES
        )
        return build("calendar", "v3", credentials=creds)
    except Exception as e:
        log.error(f"Error conectando Google Calendar: {e}")
        return None

# ─────────────────────────────────────────────
# LEER AGENDA
# ─────────────────────────────────────────────
def get_eventos_hoy(service=None) -> list:
    """Retorna eventos del día de hoy."""
    if service is None:
        service = get_google_service()
    if service is None:
        return []

    now = datetime.now(timezone.utc)
    inicio_dia = now.replace(hour=0, minute=0, second=0, microsecond=0)
    fin_dia     = now.replace(hour=23, minute=59, second=59, microsecond=0)

    try:
        eventos = service.events().list(
            calendarId=GOOGLE_CAL_ID,
            timeMin=inicio_dia.isoformat(),
            timeMax=fin_dia.isoformat(),
            singleEvents=True,
            orderBy="startTime"
        ).execute()
        return eventos.get("items", [])
    except Exception as e:
        log.error(f"Error leyendo calendario: {e}")
        return []

def get_eventos_semana(service=None) -> list:
    """Retorna eventos de los próximos 7 días."""
    if service is None:
        service = get_google_service()
    if service is None:
        return []

    now     = datetime.now(timezone.utc)
    fin_sem = now + timedelta(days=7)

    try:
        eventos = service.events().list(
            calendarId=GOOGLE_CAL_ID,
            timeMin=now.isoformat(),
            timeMax=fin_sem.isoformat(),
            singleEvents=True,
            orderBy="startTime"
        ).execute()
        return eventos.get("items", [])
    except Exception as e:
        log.error(f"Error leyendo semana: {e}")
        return []

def formatear_hora_evento(evento: dict) -> str:
    """Extrae y formatea la hora de inicio de un evento."""
    start = evento.get("start", {})
    if "dateTime" in start:
        dt = datetime.fromisoformat(start["dateTime"].replace("Z", "+00:00"))
        # Convertir a CST (UTC-6 o UTC-5 según DST)
        cst_offset = timedelta(hours=-5)  # CDT (verano)
        dt_cst = dt + cst_offset
        return dt_cst.strftime("%I:%M %p")
    elif "date" in start:
        return "Todo el día"
    return "?"

# ─────────────────────────────────────────────
# CREAR CITA
# ─────────────────────────────────────────────
def crear_cita(
    fecha_str: str,    # "2024-01-15"
    hora_str: str,     # "14:30"
    nombre: str,       # "John Smith"
    motivo: str,       # "Llamada sobre propiedad en Milwaukee"
    duracion_min: int = 60,
    service=None
) -> tuple[bool, str]:
    """Crea un evento en Google Calendar."""
    if service is None:
        service = get_google_service()
    if service is None:
        return False, "Google Calendar no disponible"

    try:
        # Parsear fecha y hora (asumiendo CST = UTC-5 en verano)
        dt_str = f"{fecha_str}T{hora_str}:00"
        dt_inicio = datetime.fromisoformat(dt_str).replace(tzinfo=timezone(timedelta(hours=-5)))
        dt_fin    = dt_inicio + timedelta(minutes=duracion_min)

        evento = {
            "summary": f"{nombre} — {motivo}",
            "description": f"Creado por El Secretario (ALEX)\nContacto: {nombre}\nMotivo: {motivo}",
            "start": {
                "dateTime": dt_inicio.isoformat(),
                "timeZone": "America/Chicago"
            },
            "end": {
                "dateTime": dt_fin.isoformat(),
                "timeZone": "America/Chicago"
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 30},
                ]
            }
        }

        resultado = service.events().insert(calendarId=GOOGLE_CAL_ID, body=evento).execute()
        event_id = resultado.get("id")
        link     = resultado.get("htmlLink", "")
        log.info(f"Cita creada: {event_id} — {nombre} {fecha_str} {hora_str}")
        return True, f"Cita creada exitosamente\nID: {event_id}\nLink: {link}"

    except Exception as e:
        log.error(f"Error creando cita: {e}")
        return False, f"Error: {str(e)}"

# ─────────────────────────────────────────────
# TELEGRAM — HELPERS
# ─────────────────────────────────────────────
def enviar_telegram(mensaje: str) -> bool:
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": OWNER_CHAT_ID, "text": mensaje, "parse_mode": "Markdown"},
            timeout=15
        )
        return r.status_code == 200
    except Exception as e:
        log.error(f"Error Telegram: {e}")
        return False

def formatear_agenda_diaria(eventos: list, titulo: str = None) -> str:
    """Formatea agenda para enviar por Telegram."""
    hoy = datetime.now().strftime("%A, %B %d, %Y")
    encabezado = titulo or f"📅 *AGENDA HOY — {hoy}*\n"

    if not eventos:
        return encabezado + "\nSin citas programadas para hoy. ¡Buen día libre, Jefe!"

    lineas = [encabezado]
    for ev in eventos:
        hora    = formatear_hora_evento(ev)
        summary = ev.get("summary", "(sin título)")
        desc    = ev.get("description", "")
        # Extraer primera línea de la descripción si existe
        desc_short = desc.split("\n")[0][:60] if desc else ""
        linea = f"⏰ {hora} — *{summary}*"
        if desc_short and "Creado por El Secretario" not in desc_short:
            linea += f"\n   _{desc_short}_"
        lineas.append(linea)

    lineas.append("\nPara ver la semana completa: /agenda semana")
    return "\n".join(lineas)

# ─────────────────────────────────────────────
# RESUMEN MATUTINO (cron 8am)
# ─────────────────────────────────────────────
def enviar_resumen_matutino():
    """Envía resumen de agenda del día a las 8am."""
    log.info("Enviando resumen matutino...")
    service  = get_google_service()
    eventos  = get_eventos_hoy(service)
    mensaje  = formatear_agenda_diaria(eventos)
    ok       = enviar_telegram(mensaje)
    if ok:
        log.info("Resumen matutino enviado")
    else:
        log.error("Error enviando resumen matutino")

# ─────────────────────────────────────────────
# RECORDATORIOS (cron cada 15 min)
# ─────────────────────────────────────────────
def verificar_recordatorios():
    """Revisa eventos próximos en 30 minutos y envía recordatorio."""
    service = get_google_service()
    if not service:
        return

    now     = datetime.now(timezone.utc)
    en_30   = now + timedelta(minutes=30)
    en_35   = now + timedelta(minutes=35)

    try:
        eventos = service.events().list(
            calendarId=GOOGLE_CAL_ID,
            timeMin=en_30.isoformat(),
            timeMax=en_35.isoformat(),
            singleEvents=True,
            orderBy="startTime"
        ).execute().get("items", [])

        for ev in eventos:
            hora    = formatear_hora_evento(ev)
            summary = ev.get("summary", "(sin título)")
            msg     = f"⏰ *RECORDATORIO*: _{summary}_ en 30 minutos ({hora})"
            enviar_telegram(msg)
            log.info(f"Recordatorio enviado: {summary}")

    except Exception as e:
        log.error(f"Error verificando recordatorios: {e}")

# ─────────────────────────────────────────────
# SETUP
# ─────────────────────────────────────────────
def setup_google_oauth():
    """Instrucciones para configurar OAuth de Google Calendar."""
    print("""
=== SETUP GOOGLE CALENDAR — EL SECRETARIO ===

Para conectar Google Calendar, sigue estos pasos:

1. Ve a https://console.cloud.google.com/
2. Crea un nuevo proyecto llamado "Pinnacle ALEX Bot"
3. Habilita la API "Google Calendar API"
4. Ve a "Credenciales" → "Crear credenciales" → "ID de cliente OAuth 2.0"
5. Tipo: "App de escritorio"
6. Descarga el JSON → guárdalo como:
   /opt/alex-bot/secretario/google_creds/credentials.json

7. Ejecuta desde el VPS:
   cd /opt/alex-bot
   source venv/bin/activate
   python3 secretario/calendar_manager.py --auth

8. Se abrirá un link — ábrelo en tu navegador, autoriza con la cuenta Google de Pinnacle
9. El token se guarda automáticamente

¿Necesitas ayuda? Pregúntale a ALEX por Telegram.
    """)

def auth_google():
    """Ejecuta el flujo de autorización OAuth."""
    if not GOOGLE_AVAILABLE:
        print("Error: Instala las dependencias: pip install google-auth google-auth-oauthlib google-api-python-client")
        return

    CREDS_DIR.mkdir(parents=True, exist_ok=True)

    if not CREDS_FILE.exists():
        print(f"Error: No encontré credentials.json en {CREDS_FILE}")
        print("Sigue el proceso de setup primero: python3 calendar_manager.py --setup")
        return

    flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_FILE), SCOPES)
    creds = flow.run_console()  # Para VPS sin browser
    TOKEN_FILE.write_text(creds.to_json())
    print(f"✅ Token guardado en {TOKEN_FILE}")
    print("Google Calendar conectado exitosamente!")

# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    if "--setup" in sys.argv:
        setup_google_oauth()
    elif "--auth" in sys.argv:
        auth_google()
    elif "--resumen" in sys.argv:
        enviar_resumen_matutino()
    elif "--recordatorios" in sys.argv:
        verificar_recordatorios()
    elif "--test" in sys.argv:
        # Test de conexión
        service = get_google_service()
        if service:
            print("✅ Conexión a Google Calendar exitosa")
            eventos = get_eventos_hoy(service)
            print(f"Eventos hoy: {len(eventos)}")
        else:
            print("❌ No se pudo conectar a Google Calendar")
    else:
        print("Uso:")
        print("  --setup         Instrucciones para configurar OAuth")
        print("  --auth          Ejecutar flujo de autorización")
        print("  --resumen       Enviar resumen matutino a Telegram")
        print("  --recordatorios Verificar recordatorios próximos")
        print("  --test          Probar conexión")
