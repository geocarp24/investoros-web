"""
TRACY LEADS POLLER — Script de automatización batch
Lee la tabla Leads de Airtable, detecta direcciones sin skip trace,
y ejecuta Tracy automáticamente para cada una.

Flujo:
  Airtable Leads (sin skip trace exitoso) → Tracy → Contacts + log Tracy

Uso:
  python tracy_leads_poller.py              # procesa todos los leads pendientes
  python tracy_leads_poller.py --dry-run    # muestra qué se procesaría sin ejecutar
  python tracy_leads_poller.py --max 5      # procesa máximo N leads
  python tracy_leads_poller.py --stage "New Lead"  # filtra por stage específico
"""

import requests
import json
import time
import argparse
from datetime import datetime
from tracy_skiptrace_automation import run_skip_trace, check_duplicate, send_alert

# ─────────────────────────────────────────────
# CREDENCIALES
# ─────────────────────────────────────────────
AIRTABLE_TOKEN    = "[REDACTED_AIRTABLE_PAT]"
AIRTABLE_BASE_ID  = "[REDACTED_AIRTABLE_BASE_ID]"
AIRTABLE_LEADS    = "[REDACTED_AIRTABLE_TABLE_ID]"
AIRTABLE_BASE_URL = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}"

AIRTABLE_HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_TOKEN}",
    "Content-Type":  "application/json",
}

# Stages que NO se procesan (deals cerrados o descartados)
SKIP_STAGES = {"Dead", "Done Deal", "Closing", "Under Contract", "Offer Sent"}


# ─────────────────────────────────────────────
# PASO 1 — Leer leads de Airtable
# ─────────────────────────────────────────────
def get_all_leads(max_records: int = 100, stage_filter: str = None) -> list[dict]:
    """
    Lee leads de Airtable con paginación.
    Ignora automáticamente stages en SKIP_STAGES.
    Si stage_filter se especifica, solo devuelve esa stage.
    """
    records = []
    offset  = None

    while True:
        params = {"pageSize": 100}
        if offset:
            params["offset"] = offset
        if stage_filter:
            params["filterByFormula"] = f"{{Stage}}='{stage_filter}'"

        try:
            resp = requests.get(
                f"{AIRTABLE_BASE_URL}/{AIRTABLE_LEADS}",
                headers=AIRTABLE_HEADERS,
                params=params,
                timeout=30
            )
            data = resp.json()
        except Exception as e:
            print(f"[POLLER] Error leyendo tabla Leads: {e}")
            break

        for record in data.get("records", []):
            fields  = record.get("fields", {})
            address = fields.get("Address", "").strip()
            stage   = fields.get("Stage", "")

            if not address:
                continue
            if not stage_filter and stage in SKIP_STAGES:
                continue

            zip_raw = fields.get("Zip Code", "")
            try:
                zip_str = str(int(zip_raw)) if zip_raw else ""
            except (ValueError, TypeError):
                zip_str = str(zip_raw).strip() if zip_raw else ""

            records.append({
                "record_id": record["id"],
                "address":   address,
                "city":      fields.get("City", ""),
                "state":     fields.get("State", ""),
                "zip":       zip_str,
                "stage":     stage,
            })

            if max_records and len(records) >= max_records:
                return records

        offset = data.get("offset")
        if not offset:
            break

    return records


# ─────────────────────────────────────────────
# PASO 2 — Filtrar los que ya tienen skip trace
# ─────────────────────────────────────────────
def filter_needs_trace(leads: list[dict]) -> list[dict]:
    """
    Para cada lead, verifica si Tracy ya tiene un registro 'success'.
    Devuelve solo los leads que aún no han sido rastreados.
    """
    pending = []
    for lead in leads:
        existing = check_duplicate(lead["address"])
        if existing:
            fields    = existing.get("fields", {})
            prev_date = fields.get("fecha_rastreo", "fecha desconocida")
            resultado = fields.get("resultado", "—")
            print(f"[POLLER] ✓ Ya rastreado: {lead['address']}  ({prev_date}) → {resultado[:60]}")
        else:
            pending.append(lead)
        time.sleep(0.2)   # respetar rate limit de Airtable (5 req/s)
    return pending


# ─────────────────────────────────────────────
# PASO 3 — Ejecutar skip trace batch
# ─────────────────────────────────────────────
def run_batch(leads: list[dict], dry_run: bool = False) -> dict:
    """
    Ejecuta run_skip_trace() para cada lead.
    Devuelve un resumen con conteos y detalles por dirección.
    """
    summary = {
        "total_procesados":  0,
        "exitosos":          0,
        "sin_resultados":    0,
        "errores":           0,
        "omitidos_dry_run":  0,
        "detalles":          [],
    }

    for i, lead in enumerate(leads, 1):
        addr = lead["address"]
        print(f"\n[POLLER] [{i}/{len(leads)}] Procesando: {addr}")

        if dry_run:
            print(f"[POLLER] DRY RUN — se procesaría: {addr} ({lead['city']}, {lead['state']} {lead['zip']})")
            summary["omitidos_dry_run"] += 1
            summary["detalles"].append({"address": addr, "status": "dry_run"})
            continue

        try:
            result = run_skip_trace(
                address=lead["address"],
                city=lead["city"],
                state=lead["state"],
                zip_code=lead["zip"],
            )
            tr     = result.get("tracy_results", {})
            status = tr.get("status", "failed")

            if status == "completed":
                written = tr.get("total_written_to_airtable", 0)
                if written > 0:
                    summary["exitosos"] += 1
                    detail_status = "success"
                    print(f"[POLLER] ✓ {addr} — {written} contacto(s) escrito(s)")
                else:
                    summary["sin_resultados"] += 1
                    detail_status = "completed_no_contacts"
                    print(f"[POLLER] ~ {addr} — completado pero sin contactos")
                summary["detalles"].append({
                    "address":          addr,
                    "status":           detail_status,
                    "contacts_written": written,
                    "tracy_record_id":  tr.get("tracy_record_id"),
                })
            else:
                summary["errores"] += 1
                print(f"[POLLER] ✗ {addr} — status: {status}")
                summary["detalles"].append({
                    "address": addr,
                    "status":  status,
                    "notes":   tr.get("notes", ""),
                    "errors":  tr.get("errors", []),
                })

            summary["total_procesados"] += 1

        except Exception as e:
            summary["errores"] += 1
            summary["total_procesados"] += 1
            summary["detalles"].append({
                "address": addr,
                "status":  "exception",
                "error":   str(e),
            })
            print(f"[POLLER] ✗ {addr} — excepción: {e}")

        # Pausa entre rastreos para no saturar las APIs
        if i < len(leads):
            print(f"[POLLER] Pausa 5 segundos...")
            time.sleep(5)

    return summary


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Tracy Leads Poller — Skip trace automático para leads de Airtable"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostrar qué leads se procesarían sin ejecutar el skip trace"
    )
    parser.add_argument(
        "--max",
        type=int,
        default=50,
        help="Máximo de leads a procesar en esta ejecución (default: 50)"
    )
    parser.add_argument(
        "--stage",
        type=str,
        default=None,
        help="Filtrar por stage específico (ej: 'New Lead', 'To be Contacted')"
    )
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"TRACY LEADS POLLER")
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Modo:  {'DRY RUN' if args.dry_run else 'EJECUCIÓN REAL'}")
    if args.stage:
        print(f"Stage: {args.stage}")
    print(f"{'='*60}\n")

    # ── 1. Leer leads ─────────────────────────────────────────────
    print("[POLLER] Leyendo tabla Leads de Airtable...")
    all_leads = get_all_leads(max_records=args.max, stage_filter=args.stage)

    stages_excluidos = f" (excluyendo: {', '.join(SKIP_STAGES)})" if not args.stage else ""
    print(f"[POLLER] {len(all_leads)} lead(s) encontrado(s){stages_excluidos}")

    if not all_leads:
        print("[POLLER] No hay leads para procesar.")
        return

    # ── 2. Filtrar pendientes ──────────────────────────────────────
    print("\n[POLLER] Verificando cuáles ya tienen skip trace exitoso...")
    pending = filter_needs_trace(all_leads)

    already_done = len(all_leads) - len(pending)
    print(f"\n[POLLER] {already_done} ya rastreado(s), {len(pending)} pendiente(s)")

    if not pending:
        print("[POLLER] Todos los leads ya fueron rastreados.")
        return

    # ── 3. Mostrar lista a procesar ────────────────────────────────
    print(f"\n[POLLER] Leads a procesar ({len(pending)}):")
    for lead in pending:
        city_state = f"{lead['city']}, {lead['state']} {lead['zip']}".strip(", ")
        print(f"  - {lead['address']}  [{city_state}]  (Stage: {lead['stage'] or '—'})")

    # ── 4. Ejecutar batch ──────────────────────────────────────────
    print(f"\n[POLLER] Iniciando skip trace{'  [DRY RUN]' if args.dry_run else ''}...")
    summary = run_batch(pending, dry_run=args.dry_run)

    # ── 5. Resumen final ───────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"RESUMEN FINAL — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    if args.dry_run:
        print(f"  Leads que se procesarían: {summary['omitidos_dry_run']}")
    else:
        print(f"  Total procesados:         {summary['total_procesados']}")
        print(f"  Con contactos escritos:   {summary['exitosos']}")
        print(f"  Sin contactos (OK):       {summary['sin_resultados']}")
        print(f"  Errores:                  {summary['errores']}")

    # Alerta Telegram si hubo errores
    if not args.dry_run and summary["errores"] > 0:
        send_alert(
            "ADVERTENCIA",
            f"Tracy Leads Poller terminó con {summary['errores']} error(s) de {summary['total_procesados']} leads",
            "1. Revisar logs del poller. 2. Re-ejecutar con --max para reintentar. 3. Verificar APIs de Tracerfy y Airtable."
        )

    print()


if __name__ == "__main__":
    main()
