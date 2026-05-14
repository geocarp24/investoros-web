"""
Script de Autorización OAuth — Google Calendar + Gmail
=======================================================
Para Desktop app credentials (installed). Usa localhost como redirect.

CÓMO EJECUTAR:
  1. En tu computadora (otra terminal), abre el túnel SSH:
       ssh -L 8080:localhost:8080 root@187.77.215.146 -N
  2. En el VPS (este terminal):
       cd /opt/alex-bot && source venv/bin/activate
       python3 secretario/auth_google.py
  3. Abre la URL que aparece en tu navegador y autoriza
"""
import sys
from pathlib import Path

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
except ImportError:
    print("ERROR: pip install google-auth google-auth-oauthlib google-api-python-client")
    sys.exit(1)

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]

CREDS_DIR  = Path(__file__).parent / "google_creds"
CREDS_FILE = CREDS_DIR / "credentials.json"
TOKEN_FILE = CREDS_DIR / "token.json"
PORT       = 8080

CREDS_DIR.mkdir(parents=True, exist_ok=True)

if not CREDS_FILE.exists():
    print(f"ERROR: No encontré {CREDS_FILE}")
    sys.exit(1)

print("\n=== AUTORIZACIÓN GOOGLE — ALEX (Calendar + Gmail) ===\n")
print("Asegúrate de tener el túnel SSH activo en tu computadora:")
print("  ssh -L 8080:localhost:8080 root@187.77.215.146 -N\n")
print(f"Iniciando servidor OAuth en localhost:{PORT}...\n")

flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_FILE), SCOPES)

# run_local_server levanta un servidor en localhost:8080,
# imprime la URL y espera el callback de Google automáticamente.
# El túnel SSH hace que tu navegador llegue al servidor del VPS.
creds = flow.run_local_server(
    port=PORT,
    prompt="consent",
    access_type="offline",
    open_browser=False,   # No intenta abrir browser en el VPS (headless)
)

TOKEN_FILE.write_text(creds.to_json())
print(f"\n✅ Token guardado en {TOKEN_FILE}")

# Verificar Calendar
try:
    cal = build("calendar", "v3", credentials=creds)
    result = cal.calendarList().list().execute()
    cals = result.get("items", [])
    print(f"✅ Google Calendar — {len(cals)} calendario(s):")
    for c in cals:
        print(f"   - {c.get('summary','?')} ({c.get('id','?')})")
except Exception as e:
    print(f"⚠️ Calendar: {e}")

# Verificar Gmail
try:
    gmail = build("gmail", "v1", credentials=creds)
    profile = gmail.users().getProfile(userId="me").execute()
    print(f"✅ Gmail — cuenta: {profile.get('emailAddress','?')}")
except Exception as e:
    print(f"⚠️ Gmail: {e}")

print("\n✅ Autorización completa. ALEX puede usar Calendar y Gmail.")
