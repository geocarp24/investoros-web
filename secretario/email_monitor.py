"""
El Secretario — Monitor de Email
Pinnacle Holdings Group | deals@pinnaclegroupwi.com

Conecta via IMAP, lee emails no leídos, clasifica con Claude,
notifica a Jorge por Telegram, y sube leads a Airtable.

Corre como servicio systemd cada 5 minutos.
"""

import imaplib
import smtplib
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
import json
import os
import sys
import time
import sqlite3
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Ajustar path para importar desde el proyecto
PROJECT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_DIR))

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_DIR / ".env")
except ImportError:
    pass

import anthropic
import requests

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────
EMAIL_ADDRESS  = os.getenv("SECRETARIO_EMAIL")  or "deals@pinnaclegroupwi.com"
# Use 'or' instead of getenv default so empty string from .env also falls back.
EMAIL_PASSWORD = os.getenv("SECRETARIO_PASSWORD") or "4523Jics!$"
IMAP_HOST      = os.getenv("IMAP_HOST",           "imap.hostinger.com")
IMAP_PORT      = int(os.getenv("IMAP_PORT",       "993"))
SMTP_HOST      = os.getenv("SMTP_HOST",           "smtp.hostinger.com")
SMTP_PORT      = int(os.getenv("SMTP_PORT",       "465"))

TELEGRAM_TOKEN   = os.getenv("TELEGRAM_TOKEN", "[REDACTED_TELEGRAM_BOT_TOKEN]")
OWNER_CHAT_ID    = os.getenv("TELEGRAM_CHAT_ID", "8402370952")
ANTHROPIC_KEY    = os.getenv("ANTHROPIC_KEY")
CLAUDE_MODEL     = "claude-sonnet-4-6"

AIRTABLE_TOKEN   = os.getenv("AIRTABLE_TOKEN", "[REDACTED_AIRTABLE_PAT]")
AIRTABLE_BASE_ID = "[REDACTED_AIRTABLE_BASE_ID]"
AIRTABLE_LEADS   = "[REDACTED_AIRTABLE_TABLE_ID]"
AIRTABLE_CONTACTS= "[REDACTED_AIRTABLE_TABLE_ID]"

DB_PATH = PROJECT_DIR / "secretario" / "emails.db"

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SECRETARIO] %(levelname)s — %(message)s",
    handlers=[
        logging.FileHandler(PROJECT_DIR / "agents" / "secretario.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# BASE DE DATOS LOCAL (SQLite)
# ─────────────────────────────────────────────
def init_db():
    """Inicializa la base de datos local para tracking de emails procesados."""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS emails_procesados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT UNIQUE,
            fecha TEXT,
            remitente TEXT,
            reply_to TEXT,
            asunto TEXT,
            categoria TEXT,
            resumen TEXT,
            respuesta_sugerida TEXT,
            telegram_notificado INTEGER DEFAULT 0,
            airtable_record_id TEXT,
            respondido INTEGER DEFAULT 0,
            respuesta_enviada TEXT,
            is_tracerfy INTEGER DEFAULT 0,
            archived_date TEXT
        )
    """)
    # Migrar tabla existente si le faltan los campos nuevos
    for col, col_def in [("is_tracerfy", "INTEGER DEFAULT 0"), ("archived_date", "TEXT"), ("reply_to", "TEXT")]:
        try:
            c.execute(f"ALTER TABLE emails_procesados ADD COLUMN {col} {col_def}")
            log.info(f"Columna '{col}' agregada a emails_procesados")
        except sqlite3.OperationalError:
            pass  # La columna ya existe
    conn.commit()
    conn.close()

def email_ya_procesado(message_id: str) -> bool:
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("SELECT id FROM emails_procesados WHERE message_id = ?", (message_id,))
    result = c.fetchone()
    conn.close()
    return result is not None

def guardar_email(data: dict) -> int:
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("""
        INSERT OR IGNORE INTO emails_procesados
        (message_id, fecha, remitente, reply_to, asunto, categoria, resumen, respuesta_sugerida)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data["message_id"], data["fecha"], data["remitente"], data.get("reply_to", ""),
        data["asunto"], data["categoria"], data["resumen"],
        data.get("respuesta_sugerida", "")
    ))
    email_id = c.lastrowid
    conn.commit()
    conn.close()
    return email_id

def marcar_notificado(message_id: str):
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("UPDATE emails_procesados SET telegram_notificado=1 WHERE message_id=?", (message_id,))
    conn.commit()
    conn.close()

def guardar_airtable_id(message_id: str, record_id: str):
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("UPDATE emails_procesados SET airtable_record_id=? WHERE message_id=?", (record_id, message_id))
    conn.commit()
    conn.close()

def get_email_by_db_id(db_id: int) -> dict | None:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM emails_procesados WHERE id=?", (db_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def marcar_respondido(db_id: int, texto_enviado: str):
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("UPDATE emails_procesados SET respondido=1, respuesta_enviada=? WHERE id=?",
              (texto_enviado, db_id))
    conn.commit()
    conn.close()

def get_ultimos_emails(n: int = 5) -> list:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""
        SELECT * FROM emails_procesados
        WHERE categoria != 'SPAM'
        ORDER BY fecha DESC LIMIT ?
    """, (n,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def guardar_tracerfy_archivado(message_id: str, remitente: str, asunto: str, fecha: str):
    """Registra un email de Tracerfy archivado en la DB local."""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    archived_date = datetime.now().strftime("%Y-%m-%d")
    c.execute("""
        INSERT OR IGNORE INTO emails_procesados
        (message_id, fecha, remitente, asunto, categoria, resumen, is_tracerfy, archived_date)
        VALUES (?, ?, ?, ?, 'TRACERFY', 'Archivado automáticamente — Tracerfy', 1, ?)
    """, (message_id, fecha, remitente, asunto, archived_date))
    conn.commit()
    conn.close()

def get_tracerfy_para_eliminar() -> list:
    """Retorna emails de Tracerfy archivados hace más de 30 días."""
    cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""
        SELECT * FROM emails_procesados
        WHERE is_tracerfy = 1
          AND archived_date IS NOT NULL
          AND archived_date <= ?
    """, (cutoff,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def eliminar_tracerfy_db(message_id: str):
    """Elimina registro de Tracerfy de la DB local."""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("DELETE FROM emails_procesados WHERE message_id = ?", (message_id,))
    conn.commit()
    conn.close()

# ─────────────────────────────────────────────
# IMAP — LEER EMAILS
# ─────────────────────────────────────────────
def decode_str(s):
    """Decodifica headers de email (maneja encoded-words)."""
    if s is None:
        return ""
    decoded_parts = decode_header(s)
    result = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            try:
                result.append(part.decode(charset or "utf-8", errors="replace"))
            except Exception:
                result.append(part.decode("utf-8", errors="replace"))
        else:
            result.append(str(part))
    return " ".join(result)

def get_email_body(msg) -> str:
    """Extrae el cuerpo de texto del email."""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                try:
                    charset = part.get_content_charset() or "utf-8"
                    body += part.get_payload(decode=True).decode(charset, errors="replace")
                except Exception:
                    pass
    else:
        try:
            charset = msg.get_content_charset() or "utf-8"
            body = msg.get_payload(decode=True).decode(charset, errors="replace")
        except Exception:
            body = str(msg.get_payload())
    return body[:3000]  # Limitar a 3000 chars para Claude

def leer_emails_no_leidos() -> list:
    """Conecta via IMAP y retorna lista de emails no leídos."""
    emails = []
    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        mail.select("INBOX")

        # Buscar emails no leídos
        _, data = mail.search(None, "UNSEEN")
        ids = data[0].split()

        log.info(f"Emails no leídos encontrados: {len(ids)}")

        for num in ids[-20:]:  # Máximo 20 por ciclo
            _, data = mail.fetch(num, "(RFC822)")
            raw = data[0][1]
            msg = email.message_from_bytes(raw)

            message_id = msg.get("Message-ID", f"no-id-{num.decode()}")
            remitente   = decode_str(msg.get("From", ""))
            reply_to    = decode_str(msg.get("Reply-To", ""))
            asunto      = decode_str(msg.get("Subject", "(sin asunto)"))
            fecha       = msg.get("Date", "")
            cuerpo      = get_email_body(msg)

            emails.append({
                "message_id": message_id,
                "remitente":  remitente,
                "reply_to":   reply_to,
                "asunto":     asunto,
                "fecha":      fecha,
                "cuerpo":     cuerpo,
                "imap_num":   num.decode()
            })

        mail.logout()
    except Exception as e:
        log.error(f"Error IMAP: {e}")

    return emails

# ─────────────────────────────────────────────
# TRACERFY — ARCHIVADO SILENCIOSO
# ─────────────────────────────────────────────
TRACERFY_ARCHIVE_FOLDER = "Archive"

def es_tracerfy(remitente: str) -> bool:
    """Detecta si un email proviene de Tracerfy."""
    return "tracerfy" in remitente.lower()

def _ensure_archive_folder(mail: imaplib.IMAP4_SSL) -> str:
    """
    Verifica que la carpeta Archive exista en el servidor.
    Si no existe, la crea. Retorna el nombre de carpeta a usar.
    """
    _, folders = mail.list()
    folder_names = []
    for f in folders:
        if isinstance(f, bytes):
            parts = f.decode().split('"')
            folder_names.append(parts[-1].strip().strip('"'))

    # Buscar variantes comunes de Archive
    for candidate in [TRACERFY_ARCHIVE_FOLDER, "Archived", "ARCHIVE", "Archivado"]:
        if candidate in folder_names:
            return candidate

    # Crear la carpeta Archive
    result, _ = mail.create(TRACERFY_ARCHIVE_FOLDER)
    if result == "OK":
        log.info(f"Carpeta '{TRACERFY_ARCHIVE_FOLDER}' creada en servidor IMAP")
    else:
        log.warning(f"No se pudo crear la carpeta Archive, usando INBOX como fallback")
        return "INBOX"
    return TRACERFY_ARCHIVE_FOLDER

def archivar_email_tracerfy(imap_num: str) -> bool:
    """
    Mueve un email de Tracerfy a la carpeta Archive en el servidor IMAP.
    COPY al destino → marcar \\Deleted en INBOX → EXPUNGE.
    Retorna True si el archivado fue exitoso.
    """
    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        mail.select("INBOX")

        archive_folder = _ensure_archive_folder(mail)

        # Copiar a Archive
        result, _ = mail.copy(imap_num, archive_folder)
        if result != "OK":
            log.error(f"Error al copiar email {imap_num} a {archive_folder}: {result}")
            mail.logout()
            return False

        # Marcar como eliminado en INBOX
        mail.store(imap_num, "+FLAGS", "\\Deleted")
        mail.expunge()
        mail.logout()
        log.info(f"Email Tracerfy {imap_num} archivado en '{archive_folder}'")
        return True
    except Exception as e:
        log.error(f"Error archivando email Tracerfy: {e}")
        return False

def limpiar_tracerfy_antiguos():
    """
    Job de limpieza diaria:
    - Busca emails de Tracerfy archivados hace más de 30 días (en SQLite)
    - Los elimina permanentemente del servidor IMAP (carpeta Archive)
    - Los elimina de la DB local
    - Registra cuántos fueron eliminados
    """
    pendientes = get_tracerfy_para_eliminar()
    if not pendientes:
        log.info("Limpieza Tracerfy: no hay emails con más de 30 días.")
        return

    log.info(f"Limpieza Tracerfy: {len(pendientes)} email(s) a eliminar permanentemente")

    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(EMAIL_ADDRESS, EMAIL_PASSWORD)

        # Determinar carpeta Archive
        archive_folder = _ensure_archive_folder(mail)
        mail.select(archive_folder)

        eliminados = 0
        for em in pendientes:
            msg_id = em["message_id"]
            try:
                # Buscar por Message-ID en la carpeta Archive
                _, data = mail.search(None, f'HEADER Message-ID "{msg_id}"')
                ids = data[0].split() if data[0] else []
                if ids:
                    for num in ids:
                        mail.store(num, "+FLAGS", "\\Deleted")
                    mail.expunge()
                    log.info(f"Eliminado permanentemente: {em['asunto'][:60]}")
                else:
                    log.info(f"Email no encontrado en Archive (ya eliminado?): {msg_id[:40]}")

                # Eliminar de DB local en ambos casos
                eliminar_tracerfy_db(msg_id)
                eliminados += 1
            except Exception as e:
                log.error(f"Error eliminando {msg_id[:40]}: {e}")

        mail.logout()
        log.info(f"Limpieza Tracerfy completada: {eliminados}/{len(pendientes)} eliminados")

    except Exception as e:
        log.error(f"Error en limpieza Tracerfy: {e}")

# ─────────────────────────────────────────────
# CLAUDE — CLASIFICAR Y REDACTAR
# ─────────────────────────────────────────────
def clasificar_email(remitente: str, asunto: str, cuerpo: str) -> dict:
    """Usa Claude para clasificar el email y redactar respuesta sugerida."""
    if not ANTHROPIC_KEY:
        log.error("ANTHROPIC_KEY no configurada")
        return {"categoria": "RUTINARIO", "resumen": asunto, "respuesta_sugerida": ""}

    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    prompt = f"""Eres El Secretario de Pinnacle Holdings Group, empresa de inversión inmobiliaria en Wisconsin.

Analiza este email recibido en deals@pinnaclegroupwi.com y responde en JSON.

EMAIL:
De: {remitente}
Asunto: {asunto}
Cuerpo: {cuerpo}

Clasifica en UNA categoría:
- LEAD: dueño o representante queriendo vender propiedad, wholesaler con deal, agente con off-market listing
- URGENTE: foreclosure inminente (<30 días), fecha límite hoy/mañana, respuesta requerida urgente
- RUTINARIO: seguimiento, preguntas generales, confirmaciones, información de mercado
- SPAM: marketing no solicitado, newsletters, phishing, scam

Responde SOLO en JSON válido:
{{
  "categoria": "LEAD|URGENTE|RUTINARIO|SPAM",
  "resumen": "2-3 oraciones resumiendo el email en español",
  "nombre_remitente": "nombre extraído del email o empresa",
  "telefono": "teléfono si aparece en el email, o null",
  "direccion_propiedad": "dirección de propiedad si se menciona, o null",
  "respuesta_sugerida": "texto de respuesta en inglés, profesional, máximo 150 palabras. Vacío si es SPAM.",
  "prioridad": "alta|media|baja"
}}"""

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text.strip()
        # Limpiar posible markdown
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        log.error(f"Error Claude clasificación: {e}")
        return {
            "categoria": "RUTINARIO",
            "resumen": f"Email de {remitente}: {asunto}",
            "nombre_remitente": "",
            "telefono": None,
            "direccion_propiedad": None,
            "respuesta_sugerida": "",
            "prioridad": "baja"
        }

# ─────────────────────────────────────────────
# AIRTABLE — CREAR LEAD
# ─────────────────────────────────────────────
def crear_lead_airtable(email_data: dict, clasificacion: dict) -> str | None:
    """Crea registro en Airtable tabla Leads. Retorna record_id o None."""
    headers = {
        "Authorization": f"Bearer {AIRTABLE_TOKEN}",
        "Content-Type": "application/json"
    }

    nombre = clasificacion.get("nombre_remitente", "")
    partes = nombre.split(" ", 1) if nombre else ["", ""]
    first_name = partes[0]
    last_name   = partes[1] if len(partes) > 1 else ""

    # Extraer email del campo remitente (formato: "Nombre <email@domain.com>")
    remitente_raw = email_data.get("remitente", "")
    email_addr = ""
    if "<" in remitente_raw and ">" in remitente_raw:
        email_addr = remitente_raw.split("<")[1].split(">")[0].strip()
    elif "@" in remitente_raw:
        email_addr = remitente_raw.strip()

    fields = {
        "First Name":  first_name,
        "Last Name":   last_name,
        "Email":       email_addr,
        "Stage":       "New Lead",
        "Source":      "Email - deals@pinnaclegroupwi.com",
        "Notes":       f"[El Secretario] {clasificacion.get('resumen', '')}\n\nAsunto original: {email_data.get('asunto', '')}",
    }

    if clasificacion.get("telefono"):
        fields["Phone"] = clasificacion["telefono"]
    if clasificacion.get("direccion_propiedad"):
        fields["Address"] = clasificacion["direccion_propiedad"]

    # Remover campos vacíos
    fields = {k: v for k, v in fields.items() if v}

    try:
        r = requests.post(
            f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{AIRTABLE_LEADS}",
            headers=headers,
            json={"fields": fields},
            timeout=15
        )
        if r.status_code == 200:
            record_id = r.json().get("id")
            log.info(f"Lead creado en Airtable: {record_id}")
            return record_id
        else:
            log.error(f"Airtable error {r.status_code}: {r.text[:200]}")
            return None
    except Exception as e:
        log.error(f"Airtable request error: {e}")
        return None

# ─────────────────────────────────────────────
# TELEGRAM — NOTIFICAR
# ─────────────────────────────────────────────
def enviar_telegram(mensaje: str, parse_mode: str = "Markdown") -> bool:
    """Envía mensaje a Jorge via Telegram."""
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={
                "chat_id": OWNER_CHAT_ID,
                "text": mensaje,
                "parse_mode": parse_mode
            },
            timeout=15
        )
        return r.status_code == 200
    except Exception as e:
        log.error(f"Error Telegram: {e}")
        return False

def formatear_notificacion(email_data: dict, clasificacion: dict, db_id: int, airtable_ok: bool) -> str:
    """Formatea mensaje de Telegram para Jorge."""
    cat = clasificacion.get("categoria", "RUTINARIO")
    emojis = {"LEAD": "🏠", "URGENTE": "🚨", "RUTINARIO": "📋", "SPAM": "🗑️"}
    emoji = emojis.get(cat, "📧")

    resumen = clasificacion.get("resumen", "")
    respuesta = clasificacion.get("respuesta_sugerida", "")
    airtable_status = "✅ Lead creado en Airtable" if airtable_ok else ""

    msg = f"""{emoji} *{cat}* — EMAIL NUEVO

*De:* {email_data.get('remitente', '')[:80]}
*Asunto:* {email_data.get('asunto', '')[:100]}

*Resumen:*
{resumen}
"""

    if airtable_status:
        msg += f"\n{airtable_status}"

    if respuesta and cat != "SPAM":
        msg += f"""

💬 *Respuesta sugerida:*
_{respuesta[:400]}_

Para responder: `/responder {db_id}`
Para responder con otro texto: `/responder {db_id} tu mensaje aquí`"""

    return msg

# ─────────────────────────────────────────────
# SMTP — ENVIAR RESPUESTA
# ─────────────────────────────────────────────
def enviar_respuesta_email(destinatario: str, asunto: str, cuerpo: str) -> bool:
    """Envía email de respuesta via SMTP.
    FROM + Reply-To se fuerzan a la cuenta autenticada (deals@...) para evitar
    rebotes por 'wordpress@' u otras cuentas que no existen en el servidor."""
    try:
        msg = MIMEMultipart()
        # Friendly display name + forced FROM (must exist on Hostinger)
        msg["From"]      = f"Pinnacle Holdings <{EMAIL_ADDRESS}>"
        msg["Reply-To"]  = EMAIL_ADDRESS
        msg["To"]        = destinatario
        msg["Subject"]   = f"Re: {asunto}" if not asunto.startswith("Re:") else asunto

        firma = """

Best regards,

Jorge
Pinnacle Holdings Group
deals@pinnaclegroupwi.com
Wisconsin Real Estate Investors"""

        msg.attach(MIMEText(cuerpo + firma, "plain"))

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.send_message(msg)

        log.info(f"Email enviado a {destinatario}")
        return True
    except Exception as e:
        log.error(f"Error SMTP al enviar a {destinatario}: {e}")
        return False

# ─────────────────────────────────────────────
# CICLO PRINCIPAL
# ─────────────────────────────────────────────
def procesar_emails():
    """Ciclo principal: lee, clasifica, notifica y registra emails."""
    log.info("=== Iniciando ciclo de revisión de emails ===")
    init_db()

    # Job de limpieza diaria de Tracerfy (corre al inicio de cada ciclo, es idempotente)
    limpiar_tracerfy_antiguos()

    emails = leer_emails_no_leidos()
    if not emails:
        log.info("Sin emails nuevos.")
        return

    procesados = 0
    for em in emails:
        msg_id = em["message_id"]

        if email_ya_procesado(msg_id):
            log.info(f"Ya procesado: {em['asunto'][:60]}")
            continue

        # ── Regla Tracerfy: archivar silenciosamente ──────────────────────
        if es_tracerfy(em["remitente"]):
            log.info(f"Tracerfy detectado — archivando silenciosamente: {em['asunto'][:60]}")
            ok = archivar_email_tracerfy(em["imap_num"])
            guardar_tracerfy_archivado(msg_id, em["remitente"], em["asunto"], em["fecha"])
            if ok:
                log.info(f"Tracerfy archivado: {em['asunto'][:60]}")
            else:
                log.warning(f"No se pudo archivar en IMAP, pero registrado en DB: {msg_id[:40]}")
            procesados += 1
            continue
        # ──────────────────────────────────────────────────────────────────

        log.info(f"Clasificando: {em['asunto'][:60]} | De: {em['remitente'][:50]}")

        # Clasificar con Claude
        clas = clasificar_email(em["remitente"], em["asunto"], em["cuerpo"])
        cat  = clas.get("categoria", "RUTINARIO")

        log.info(f"Categoría: {cat} | Prioridad: {clas.get('prioridad','?')}")

        # Guardar en DB local
        db_id = guardar_email({
            "message_id":       msg_id,
            "fecha":            em["fecha"],
            "remitente":        em["remitente"],
            "asunto":           em["asunto"],
            "categoria":        cat,
            "resumen":          clas.get("resumen", ""),
            "respuesta_sugerida": clas.get("respuesta_sugerida", "")
        })

        # Si es SPAM, skip
        if cat == "SPAM":
            log.info(f"SPAM ignorado: {em['asunto'][:60]}")
            continue

        # Si es LEAD → crear en Airtable
        airtable_ok = False
        if cat == "LEAD":
            record_id = crear_lead_airtable(em, clas)
            if record_id:
                guardar_airtable_id(msg_id, record_id)
                airtable_ok = True

        # Notificar a Jorge por Telegram (LEAD y URGENTE siempre; RUTINARIO solo si hay respuesta sugerida)
        if cat in ("LEAD", "URGENTE") or (cat == "RUTINARIO" and clas.get("respuesta_sugerida")):
            notif = formatear_notificacion(em, clas, db_id, airtable_ok)
            ok = enviar_telegram(notif)
            if ok:
                marcar_notificado(msg_id)
                log.info(f"Notificación enviada a Jorge: {cat}")

        procesados += 1
        time.sleep(1)  # Pequeña pausa entre procesados

    log.info(f"Ciclo completado. Procesados: {procesados}/{len(emails)}")

# ─────────────────────────────────────────────
# RESPONDER EMAIL (llamado desde bot Telegram)
# ─────────────────────────────────────────────
def _extract_email_addr(raw: str) -> str:
    """Extrae 'foo@bar.com' de '"Name" <foo@bar.com>' o devuelve raw limpio."""
    if not raw: return ""
    raw = raw.strip()
    if "<" in raw and ">" in raw:
        return raw.split("<")[1].split(">")[0].strip()
    if "@" in raw:
        # remove surrounding text/quotes, keep only email
        import re
        m = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", raw)
        if m: return m.group(0).lower()
    return ""

def _is_system_sender(addr: str) -> bool:
    """Detecta remitentes genéricos del sistema que NO deben recibir respuesta."""
    if not addr: return True
    a = addr.lower()
    blocklist = [
        "wordpress@", "no-reply@", "noreply@", "mailer-daemon@", "mail-daemon@",
        "postmaster@", "donotreply@", "bounce@", "bounces@", "mail@wordpress",
    ]
    return any(a.startswith(p) or p in a for p in blocklist)

def _extract_email_from_body(body: str) -> str:
    """Busca un email del cliente embebido en el cuerpo (ej: WP CF7 'Email: foo@bar.com')."""
    if not body: return ""
    import re
    # Patrones comunes de formularios WP
    patterns = [
        r"(?:Email|E-?mail|Correo)\s*[:\-]\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})",
        r"reply[- ]?to\s*[:\-]\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})",
        r"from\s*[:\-]\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})",
    ]
    for pat in patterns:
        m = re.search(pat, body, re.IGNORECASE)
        if m:
            addr = m.group(1).lower()
            if not _is_system_sender(addr):
                return addr
    # Cualquier email en el body que no sea sistema
    all_emails = re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", body)
    for addr in all_emails:
        a = addr.lower()
        if (not _is_system_sender(a)
            and not a.endswith("@pinnaclegroupwi.com")
            and not a.endswith("@geocarpentry.com")):
            return a
    return ""

def responder_email_aprobado(db_id: int, texto_personalizado: str | None = None) -> tuple[bool, str]:
    """
    Envía respuesta a un email con aprobación del Jefe.
    Orden de resolución del destinatario:
      1) Reply-To del email original (si no es sistema)
      2) From del email original (si no es sistema)
      3) Email embebido en el cuerpo (ej: WP CF7 "Email: foo@bar.com")
    """
    em = get_email_by_db_id(db_id)
    if not em:
        return False, f"No encontré email con ID {db_id}"
    if em.get("respondido"):
        return False, f"Este email ya fue respondido el {em.get('fecha')}"

    # 1) Reply-To
    email_dest = _extract_email_addr(em.get("reply_to", ""))
    if email_dest and _is_system_sender(email_dest):
        email_dest = ""
    # 2) From
    if not email_dest:
        cand = _extract_email_addr(em.get("remitente", ""))
        if cand and not _is_system_sender(cand):
            email_dest = cand
    # 3) Body scan (WP CF7 puts "Email: client@example.com" in body)
    source = "reply_to" if em.get("reply_to") and _extract_email_addr(em.get("reply_to","")) == email_dest else ("from" if email_dest else "")
    if not email_dest:
        email_dest = _extract_email_from_body(em.get("cuerpo", ""))
        if email_dest: source = "body"

    if not email_dest:
        return False, (
            f"No pude resolver email del cliente.\n"
            f"From: {em.get('remitente','')}\n"
            f"Reply-To: {em.get('reply_to','')}\n"
            f"Usa: /responder {db_id} <email> <mensaje>"
        )

    cuerpo = texto_personalizado if texto_personalizado else em.get("respuesta_sugerida", "")
    if not cuerpo:
        return False, f"No hay texto de respuesta. Usa: /responder {db_id} tu mensaje"

    ok = enviar_respuesta_email(email_dest, em.get("asunto", ""), cuerpo)
    if ok:
        marcar_respondido(db_id, cuerpo)
        return True, f"Email enviado a {email_dest} (resuelto por {source})"
    else:
        return False, f"Error al enviar a {email_dest}. Revisa credenciales SMTP."


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    # Modo: monitoreo continuo o un solo ciclo
    if "--daemon" in sys.argv:
        log.info("Modo daemon — revisión cada 5 minutos")
        while True:
            try:
                procesar_emails()
            except Exception as e:
                log.error(f"Error en ciclo principal: {e}")
            time.sleep(300)  # 5 minutos
    else:
        # Un solo ciclo (para cron o systemd)
        procesar_emails()
