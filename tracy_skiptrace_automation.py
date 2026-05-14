"""
TRACY — Skip Trace Automation Script
Flujo completo: Airtable (pending) → CSV → Tracerfy → polling → Airtable (success/error) → Contacts
Referencia: agents/tracy.md
"""

import requests
import csv
import json
import time
import subprocess
from datetime import datetime, timezone
from pathlib import Path

# ─────────────────────────────────────────────
# CREDENCIALES
# ─────────────────────────────────────────────
TRACERFY_API_KEY  = "[REDACTED_JWT]"
AIRTABLE_TOKEN    = "[REDACTED_AIRTABLE_PAT]"
AIRTABLE_BASE_ID  = "[REDACTED_AIRTABLE_BASE_ID]"
AIRTABLE_TRACY    = "[REDACTED_AIRTABLE_TABLE_ID]"   # tabla de log de rastreos
AIRTABLE_CONTACTS = "[REDACTED_AIRTABLE_TABLE_ID]"   # tabla de contactos

TRACERFY_BASE     = "https://tracerfy.com/v1/api"
CHISMOSO_URL      = "https://pinnaclegroupwi.com/Tools/el_chismoso.php"
CHISMOSO_TOKEN    = "pinnacle2026"
# Endpoints confirmados:
#   POST /trace/         → enviar CSV, devuelve queue_id
#   GET  /queue/{id}     → resultados (sin trailing slash), devuelve [] o array de contactos
AIRTABLE_BASE_URL = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}"
ALERT_SCRIPT      = str(Path(__file__).parent / "agents" / "alerta_telegram.sh")

AIRTABLE_HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_TOKEN}",
    "Content-Type":  "application/json",
}

# ─────────────────────────────────────────────
# ALERTA DE SEGURIDAD / ERROR
# ─────────────────────────────────────────────
def send_alert(level: str, description: str, solutions: str = "Revisar logs del sistema."):
    try:
        subprocess.run(
            ["bash", ALERT_SCRIPT, level, description, solutions],
            timeout=15, check=False
        )
    except Exception as e:
        print(f"[ALERT] No se pudo enviar alerta Telegram: {e}")


# ─────────────────────────────────────────────
# PASO 0 — Verificar duplicados
# ─────────────────────────────────────────────
def check_duplicate(address: str) -> dict | None:
    """Devuelve el registro existente si ya fue rastreado con éxito, o None."""
    formula = f"AND(LOWER({{address}})=LOWER('{address}'),{{status}}='success')"
    try:
        resp = requests.get(
            f"{AIRTABLE_BASE_URL}/{AIRTABLE_TRACY}",
            headers=AIRTABLE_HEADERS,
            params={"filterByFormula": formula, "maxRecords": 1},
            timeout=20
        )
        data = resp.json()
        records = data.get("records", [])
        return records[0] if records else None
    except Exception as e:
        print(f"[TRACY] Error verificando duplicados: {e}")
        return None


# ─────────────────────────────────────────────
# PASO 1 — Crear registro pending en Tracy
# ─────────────────────────────────────────────
def create_tracy_record(address: str, city: str, state: str, zip_code: str,
                         first_name: str = "", last_name: str = "",
                         mail_address: str = "", mail_city: str = "", mail_state: str = "") -> str | None:
    """Crea registro en tabla Tracy con status=pending. Devuelve record_id."""
    fields = {
        "address":      address,
        "fecha_rastreo": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "status":       "pending",
        "notas":        "Rastreo iniciado por ALEX",
    }
    if city:        fields["city"]         = city
    if state:       fields["state"]        = state
    if zip_code:    fields["zip"]          = zip_code
    if first_name:  fields["first_name"]   = first_name
    if last_name:   fields["last_name"]    = last_name
    if mail_address: fields["mail_address"] = mail_address
    if mail_city:   fields["mail_city"]    = mail_city
    if mail_state:  fields["mail_state"]   = mail_state

    try:
        resp = requests.post(
            f"{AIRTABLE_BASE_URL}/{AIRTABLE_TRACY}",
            headers=AIRTABLE_HEADERS,
            json={"fields": fields},
            timeout=20
        )
        data = resp.json()
        record_id = data.get("id")
        if not record_id:
            print(f"[TRACY] Error creando registro pending: {data}")
            return None
        print(f"[TRACY] Registro pending creado: {record_id}")
        return record_id
    except Exception as e:
        print(f"[TRACY] Excepción creando registro: {e}")
        return None


# ─────────────────────────────────────────────
# PASO 2 — Crear CSV temporal
# ─────────────────────────────────────────────
def create_csv(address: str, city: str, state: str, zip_code: str,
               first_name: str = "", last_name: str = "",
               mail_address: str = "", mail_city: str = "", mail_state: str = "",
               mail_zip: str = "") -> str:
    csv_path = str(Path(__file__).parent / "tracy_trace_input.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["address", "city", "state", "zip", "first_name", "last_name",
                         "mail_address", "mail_city", "mail_state", "mail_zip"])
        writer.writerow([address, city, state, zip_code,
                         first_name, last_name, mail_address, mail_city, mail_state, mail_zip])
    print(f"[TRACY] CSV creado: {csv_path}")
    return csv_path


# ─────────────────────────────────────────────
# PASO 3 — Enviar a Tracerfy
# ─────────────────────────────────────────────
def send_to_tracerfy(csv_path: str) -> dict:
    headers = {"Authorization": f"Bearer {TRACERFY_API_KEY}"}
    with open(csv_path, "rb") as f:
        files = {"csv_file": ("tracy_trace_input.csv", f, "text/csv")}
        data  = {
            "address_column":      "address",
            "city_column":         "city",
            "state_column":        "state",
            "zip_column":          "zip",
            "first_name_column":   "first_name",
            "last_name_column":    "last_name",
            "mail_address_column": "mail_address",
            "mail_city_column":    "mail_city",
            "mail_state_column":   "mail_state",
            "mailing_zip_column":  "mail_zip",
            "trace_type":          "advanced",
        }
        resp = requests.post(
            f"{TRACERFY_BASE}/trace/",
            headers=headers,
            files=files,
            data=data,
            timeout=30
        )
    result = resp.json()
    print(f"[TRACY] Tracerfy response: {result}")
    return result


# ─────────────────────────────────────────────
# PASO 3B — Instant Lookup (single address, no queue)
# ─────────────────────────────────────────────
def instant_lookup(address: str, city: str, state: str, zip_code: str = "",
                   find_owner: bool = True) -> dict | None:
    """
    Usa el endpoint /trace/lookup/ para búsqueda instantánea (sincrónica).
    5 créditos por hit, 0 por miss. Rate limit: 500 RPM.
    Devuelve el JSON de contacto directamente o None si falla.
    """
    headers = {
        "Authorization": f"Bearer {TRACERFY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "address": address,
        "city": city,
        "state": state,
        "find_owner": find_owner,
    }
    if zip_code:
        payload["zip"] = zip_code

    try:
        resp = requests.post(
            f"{TRACERFY_BASE}/trace/lookup/",
            headers=headers,
            json=payload,
            timeout=30,
        )
        data = resp.json()
        print(f"[TRACY] Instant lookup response: {json.dumps(data, indent=2, ensure_ascii=False)[:1000]}")
        return data
    except Exception as e:
        print(f"[TRACY] Instant lookup error: {e}")
        return None


# ─────────────────────────────────────────────
# PASO 4 — Polling hasta obtener resultado
# ─────────────────────────────────────────────
def poll_queue(queue_id: int, max_attempts: int = 10, wait_seconds: int = 15) -> dict | None:
    headers = {"Authorization": f"Bearer {TRACERFY_API_KEY}"}
    for attempt in range(1, max_attempts + 1):
        print(f"[TRACY] Polling {attempt}/{max_attempts} para queue {queue_id}...")
        time.sleep(wait_seconds)
        try:
            resp = requests.get(
                f"{TRACERFY_BASE}/queue/{queue_id}",
                headers=headers,
                timeout=30
            )
            data = resp.json()
            # El endpoint devuelve un array con los resultados cuando está listo
            # [] = sin resultados (dirección inválida o no encontrada)
            # [{...}] = contactos encontrados
            if isinstance(data, list):
                print(f"[TRACY] Queue completado — {len(data)} registro(s) encontrado(s)")
                # Debug: mostrar estructura de la respuesta para diagnóstico
                for i, rec in enumerate(data):
                    keys = list(rec.keys()) if isinstance(rec, dict) else str(type(rec))
                    print(f"[TRACY] Record {i} keys: {keys}")
                    print(f"[TRACY] Record {i} preview: {json.dumps(rec, indent=2, ensure_ascii=False)[:500]}")
                return {"status": "completed", "records": data}
            # Si devuelve objeto con status
            status = data.get("status", "")
            print(f"[TRACY] Queue status: {status}")
            if status not in ("pending", "processing"):
                return data
        except Exception as e:
            print(f"[TRACY] Error en polling: {e}")
    return None  # timeout


# ─────────────────────────────────────────────
# PASO 5 — Actualizar registro Tracy
# ─────────────────────────────────────────────
def update_tracy_record(record_id: str, status: str, resultado: str, notas: str = "") -> bool:
    fields = {"status": status, "resultado": resultado}
    if notas:
        fields["notas"] = notas
    try:
        resp = requests.patch(
            f"{AIRTABLE_BASE_URL}/{AIRTABLE_TRACY}/{record_id}",
            headers=AIRTABLE_HEADERS,
            json={"fields": fields},
            timeout=20
        )
        data = resp.json()
        ok = "id" in data
        print(f"[TRACY] Registro actualizado ({status}): {ok}")
        return ok
    except Exception as e:
        print(f"[TRACY] Error actualizando registro: {e}")
        return False


# ─────────────────────────────────────────────
# PASO 6 — Extraer contactos de la respuesta
# ─────────────────────────────────────────────
def extract_contacts(result_data: dict, property_address: str) -> list[dict]:
    contacts = []
    records = result_data.get("records", result_data.get("results", []))
    if not isinstance(records, list):
        print(f"[TRACY] extract_contacts: records no es lista — tipo: {type(records)}, valor: {str(records)[:300]}")
        return contacts
    print(f"[TRACY] extract_contacts: procesando {len(records)} registro(s)")

    for record in records:
        # Owner
        owner_name = (
            record.get("name") or
            f"{record.get('first_name', '')} {record.get('last_name', '')}".strip()
        )
        phones = [record.get(k) for k in [
            "primary_phone", "mobile_1", "mobile_2", "mobile_3",
            "mobile_4", "mobile_5", "landline_1", "landline_2", "landline_3"
        ] if record.get(k)]
        emails = [record.get(k) for k in [
            "email_1", "email_2", "email_3", "email_4", "email_5"
        ] if record.get(k)]

        if owner_name:
            contacts.append({
                "name":         owner_name,
                "phone":        phones[0] if phones else None,
                "phone_type":   record.get("primary_phone_type", ""),
                "extra_phones": phones[1:],
                "email":        emails[0] if emails else None,
                "extra_emails": emails[1:],
                "address":      property_address,
                "mail_address": record.get("mail_address", ""),
                "mail_city":    record.get("mail_city", ""),
                "mail_state":   record.get("mail_state", ""),
                "mail_zip":     record.get("mail_zip", ""),
                "tracerfy_id":  record.get("id"),
                "role":         "Owner",
            })

        # Relatives
        for relative in record.get("relatives", record.get("associated_people", [])):
            rel_name = (
                relative.get("name") or
                f"{relative.get('first_name', '')} {relative.get('last_name', '')}".strip()
            )
            rel_phones = [relative.get(k) for k in ["phone", "mobile_1", "primary_phone"] if relative.get(k)]
            rel_emails = [relative.get(k) for k in ["email", "email_1"] if relative.get(k)]
            if rel_name:
                contacts.append({
                    "name":         rel_name,
                    "phone":        rel_phones[0] if rel_phones else None,
                    "extra_phones": [],
                    "email":        rel_emails[0] if rel_emails else None,
                    "extra_emails": [],
                    "address":      None,
                    "role":         "Relative",
                })

    return contacts


# ─────────────────────────────────────────────
# PASO 7 — Escribir contactos en Contacts
# ─────────────────────────────────────────────
def _to_e164_int(phone_str: str) -> int | None:
    """Convierte string de teléfono a entero E.164 (sin +). Asume US (+1)."""
    if not phone_str:
        return None
    digits = "".join(c for c in str(phone_str) if c.isdigit())
    if not digits:
        return None
    if len(digits) == 10:
        digits = "1" + digits   # agregar código de país US
    elif len(digits) == 11 and digits.startswith("1"):
        pass  # ya tiene código de país
    else:
        return None
    return int(digits)


def write_contact_to_airtable(contact: dict, property_address: str) -> dict:
    fields = {
        "Full Name":   contact["name"],
        "Category":    "Lead",
        "Stage":       "To Be Contacted",
        "Lead Source": "Skip Trace - Tracy",
        "Owner Address": property_address,
    }

    # Teléfonos — formato E.164 como entero
    phones = [contact.get("phone")] + contact.get("extra_phones", [])
    phone_keys = ["Phone1", "Phone2", "Phone3", "Phone4"]
    for key, ph in zip(phone_keys, phones):
        val = _to_e164_int(ph)
        if val:
            fields[key] = val

    if contact.get("phone_type"):
        fields["Phone1 Type"] = contact["phone_type"]

    # Emails
    emails = [contact.get("email")] + contact.get("extra_emails", [])
    email_keys = ["Email1", "Email2", "Email3"]
    for key, em in zip(email_keys, emails):
        if em:
            fields[key] = em

    # Dirección postal
    if contact.get("mail_address"): fields["Mail Address"] = contact["mail_address"]
    if contact.get("mail_city"):    fields["Mail City"]    = contact["mail_city"]
    if contact.get("mail_state"):   fields["Mail State"]   = contact["mail_state"]
    if contact.get("mail_zip"):     fields["Mail Zip"]     = contact["mail_zip"]

    # ID de Tracerfy para deduplicación
    if contact.get("tracerfy_id"):
        fields["Tracerfy ID"] = int(contact["tracerfy_id"])

    try:
        resp = requests.post(
            f"{AIRTABLE_BASE_URL}/{AIRTABLE_CONTACTS}",
            headers=AIRTABLE_HEADERS,
            json={"fields": fields},
            timeout=20
        )
        data = resp.json()
        time.sleep(0.2)  # respetar rate limit (5 req/seg)
        return {
            "name":               contact["name"],
            "phone":              contact.get("phone"),
            "email":              contact.get("email"),
            "role":               contact["role"],
            "airtable_record_id": data.get("id", ""),
            "airtable_status":    "written" if data.get("id") else "failed",
        }
    except Exception as e:
        return {
            "name":             contact["name"],
            "role":             contact["role"],
            "airtable_status":  "failed",
            "error":            str(e),
        }


# ─────────────────────────────────────────────
# FLUJO PRINCIPAL
# ─────────────────────────────────────────────
def run_skip_trace(
    address:     str,
    city:        str = "",
    state:       str = "",
    zip_code:    str = "",
    first_name:  str = "",
    last_name:   str = "",
    mail_address: str = "",
    mail_city:   str = "",
    mail_state:  str = "",
    force:       bool = False,   # True = ignorar duplicados y rastrear igual
) -> dict:

    full_address = ", ".join(filter(None, [address, city, state, zip_code]))
    print(f"\n{'='*60}")
    print(f"TRACY — Skip trace: {full_address}")
    print(f"{'='*60}\n")

    result = {
        "tracy_results": {
            "property_address":       full_address,
            "trace_date":             datetime.now().strftime("%Y-%m-%d"),
            "queue_id":               None,
            "tracy_record_id":        None,
            "status":                 "failed",
            "contacts_found":         [],
            "total_contacts_found":   0,
            "total_written_to_airtable": 0,
            "errors":                 [],
            "notes":                  "",
        }
    }

    # ── PASO 0: Verificar duplicados ──────────────────────────────
    if not force:
        existing = check_duplicate(address)
        if existing:
            prev_date = existing.get("fields", {}).get("fecha_rastreo", "fecha desconocida")
            prev_result = existing.get("fields", {}).get("resultado", "sin resultado")
            result["tracy_results"]["status"] = "duplicate"
            result["tracy_results"]["notes"]  = f"Rastreado previamente el {prev_date}. Resultado: {prev_result}"
            result["tracy_results"]["tracy_record_id"] = existing.get("id")
            print(f"[TRACY] Dirección ya rastreada. Usa force=True para re-rastrear.")
            return result

    # ── PASO 1: Crear registro pending ───────────────────────────
    tracy_record_id = create_tracy_record(
        address, city, state, zip_code,
        first_name, last_name, mail_address, mail_city, mail_state
    )
    if not tracy_record_id:
        error_msg = "No se pudo crear registro en tabla Tracy"
        result["tracy_results"]["errors"].append(error_msg)
        send_alert("ADVERTENCIA", f"Tracy: {error_msg} para {full_address}",
                   "1. Verificar token Airtable. 2. Verificar estructura tabla Tracy.")
        return result

    result["tracy_results"]["tracy_record_id"] = tracy_record_id

    # ── PASO 2: Crear CSV ─────────────────────────────────────────
    csv_path = create_csv(address, city, state, zip_code,
                          first_name, last_name, mail_address, mail_city, mail_state)

    # ── PASO 3: Enviar a Tracerfy ─────────────────────────────────
    try:
        trace_response = send_to_tracerfy(csv_path)
    except Exception as e:
        error_msg = f"Error enviando a Tracerfy: {e}"
        result["tracy_results"]["errors"].append(error_msg)
        update_tracy_record(tracy_record_id, "error", error_msg)
        send_alert("ADVERTENCIA", f"Tracy: {error_msg}",
                   "1. Verificar API key de Tracerfy. 2. Verificar conectividad. 3. Revisar formato del CSV.")
        return result

    if "queue_id" not in trace_response:
        error_msg = f"Tracerfy no devolvió queue_id: {trace_response}"
        result["tracy_results"]["errors"].append(error_msg)
        update_tracy_record(tracy_record_id, "error", error_msg)
        send_alert("ADVERTENCIA", f"Tracy: respuesta inesperada de Tracerfy para {full_address}",
                   f"Respuesta recibida: {str(trace_response)[:200]}")
        return result

    queue_id = trace_response["queue_id"]
    result["tracy_results"]["queue_id"] = queue_id
    print(f"[TRACY] Queue ID: {queue_id} — esperando resultados...")

    # ── PASO 4: Polling ───────────────────────────────────────────
    result_data = poll_queue(queue_id)

    if result_data is None:
        error_msg = "Timeout — Tracerfy no respondió en 2.5 minutos"
        result["tracy_results"]["status"] = "timeout"
        result["tracy_results"]["errors"].append(error_msg)
        update_tracy_record(tracy_record_id, "error", error_msg, "Timeout después de 10 intentos de polling")
        send_alert("ADVERTENCIA", f"Tracy timeout para {full_address}",
                   "1. Verificar estado de la API de Tracerfy. 2. Re-intentar más tarde. 3. Consultar queue manualmente.")
        return result

    # ── PASO 5: Actualizar registro Tracy ─────────────────────────
    contacts_raw = extract_contacts(result_data, full_address)

    if not contacts_raw:
        # Fallback: intentar instant lookup si el queue no devolvió contactos
        print("[TRACY] Queue sin contactos — intentando instant lookup como fallback...")
        lookup_data = instant_lookup(address, city, state, zip_code)
        if lookup_data and isinstance(lookup_data, dict) and lookup_data.get("first_name"):
            contacts_raw = extract_contacts({"records": [lookup_data]}, full_address)
            if contacts_raw:
                print(f"[TRACY] Instant lookup encontró {len(contacts_raw)} contacto(s)")

    if not contacts_raw:
        resultado_str = "No se encontraron contactos (queue + instant lookup)"
        update_tracy_record(tracy_record_id, "success", resultado_str,
                           "Tracerfy completó el rastreo sin resultados en ambos métodos.")
        result["tracy_results"]["status"] = "completed"
        result["tracy_results"]["notes"]  = resultado_str
        # Limpiar CSV antes de salir
        try:
            Path(csv_path).unlink(missing_ok=True)
        except Exception:
            pass
        return result

    # ── PASO 7: Escribir contactos en Contacts ────────────────────
    airtable_results = []
    for contact in contacts_raw:
        at_result = write_contact_to_airtable(contact, full_address)
        airtable_results.append(at_result)
        status_icon = "[OK]" if at_result["airtable_status"] == "written" else "[X]"
        print(f"[TRACY] {status_icon} {contact['name']} ({contact['role']})")

    written = sum(1 for r in airtable_results if r["airtable_status"] == "written")
    summary_names = ", ".join(
        f"{r['name']} ({r.get('phone') or 'sin tel'})"
        for r in airtable_results if r["airtable_status"] == "written"
    )
    resultado_str = f"{written} contacto(s) encontrado(s): {summary_names}"
    notas_str     = f"Owner + {len([c for c in contacts_raw if c['role']=='Relative'])} relative(s). Escritos en Contacts."

    update_tracy_record(tracy_record_id, "success", resultado_str, notas_str)

    # ── WEBHOOK: Notificar a el_chismoso.php ─────────────────────
    try:
        wh = requests.post(
            CHISMOSO_URL,
            headers={"X-Chismoso-Token": CHISMOSO_TOKEN, "Content-Type": "application/json"},
            json={"record_id": tracy_record_id},
            timeout=15
        )
        print(f"[CHISMOSO] Response: {wh.status_code} — {wh.text[:200]}")
    except Exception as e:
        print(f"[CHISMOSO] Error notificando webhook: {e}")

    # ── PASO 8: Limpiar CSV ───────────────────────────────────────
    try:
        Path(csv_path).unlink(missing_ok=True)
    except Exception:
        pass

    # ── Resultado final ───────────────────────────────────────────
    result["tracy_results"].update({
        "status":                    "completed",
        "contacts_found":            airtable_results,
        "total_contacts_found":      len(airtable_results),
        "total_written_to_airtable": written,
        "notes":                     notas_str,
    })

    print(f"\n[TRACY] COMPLETADO — {written} contacto(s) escritos en Airtable.")
    return result


# ─────────────────────────────────────────────
# ENTRADA DE LÍNEA DE COMANDOS
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    # Uso: python tracy_skiptrace_automation.py "123 Main St" "Milwaukee" "WI" "53202"
    if len(sys.argv) < 2:
        print("Uso: python tracy_skiptrace_automation.py <address> [city] [state] [zip]")
        print("Ejemplo: python tracy_skiptrace_automation.py \"123 Main St\" \"Milwaukee\" \"WI\" \"53202\"")
        sys.exit(1)

    addr   = sys.argv[1]
    city   = sys.argv[2] if len(sys.argv) > 2 else ""
    state  = sys.argv[3] if len(sys.argv) > 3 else ""
    zipc   = sys.argv[4] if len(sys.argv) > 4 else ""

    output = run_skip_trace(addr, city, state, zipc)
    print("\n" + json.dumps(output, indent=2, ensure_ascii=False))
