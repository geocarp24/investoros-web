#!/usr/bin/env python3
"""Provisiona Ops_Health + Ops_Insights para El Supervisor."""
import json, os, sys, urllib.request, urllib.error

TOKEN=[REDACTED]("AIRTABLE_TOKEN") or "[REDACTED_AIRTABLE_PAT]"
BASE_ID = "[REDACTED_AIRTABLE_BASE_ID]"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def http_post(path, body):
    req = urllib.request.Request(
        f"https://api.airtable.com/v0/meta/bases/{BASE_ID}{path}",
        data=json.dumps(body).encode(), headers=HEADERS, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode() if hasattr(e, "read") else ""
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw_error": raw[:500]}
    except Exception as e:
        return 0, {"exception": str(e)[:300]}

def text(n, d=""):   return {"name": n, "type": "singleLineText",  "description": d}
def long(n, d=""):   return {"name": n, "type": "multilineText",   "description": d}
def url_(n, d=""):   return {"name": n, "type": "url",             "description": d}
def num(n, p=0, d=""):
    return {"name": n, "type": "number", "options": {"precision": p}, "description": d}
def dt(n, d=""):
    return {"name": n, "type": "dateTime", "options": {"dateFormat": {"name":"iso"},
        "timeFormat": {"name":"24hour"}, "timeZone": "America/Chicago"}, "description": d}

TABLES = [
    {
        "name": "Ops_Health",
        "description": "El Supervisor — rolling health checks de toda la plataforma. 1 row por run (heartbeat 15min / deep 1h / evolve weekly).",
        "fields": [
            text("run_id"),
            text("tenant_id"),
            text("check_type",           "heartbeat | deep | evolve"),
            text("status",               "Running | Done | Failed"),
            text("health",               "green | yellow | red"),
            text("trigger",              "cron | manual | api"),
            dt("started_at"),
            dt("completed_at"),
            num("duration_sec"),

            # --- Component-level scores ---
            num("checks_total", 0),
            num("checks_passed", 0),
            num("checks_failed", 0),
            num("autofixes_applied", 0),

            # --- Specific check outputs ---
            num("cron_first_contact_ok", 0,  "1 if endpoint responded 200 & last log <4h, 0 if stale"),
            num("cron_seguimiento_ok", 0),
            num("cron_stale_ok", 0),
            num("cron_morning_brief_ok", 0),
            num("airtable_api_ok", 0),
            num("openphone_api_ok", 0),
            num("telegram_bot_ok", 0),
            num("webhook_recent_ok", 0,      "1 if any webhook in last 24h"),

            # --- Pipeline sanity ---
            num("contacts_total", 0),
            num("contacts_new", 0),
            num("contacts_tbc", 0,           "To Be Contacted"),
            num("contacts_contacted", 0),
            num("contacts_seguimiento", 0),
            num("contacts_dead", 0),
            num("ghosts_detected", 0,        "Contacts stuck in Contacted/Seguimiento without progress"),
            num("ghosts_autoreset", 0),

            # --- Findings ---
            long("critical_issues",          "Requiere acción humana o auto-fix"),
            long("warnings",                 "Degradación pero no bloqueante"),
            long("auto_fixes_log",           "Qué arregló automáticamente este run"),
            long("recommendations",          "Ideas para Jorge (no críticas)"),

            # --- Run details ---
            long("summary_md"),
            url_("report_url"),
            num("tokens_used"),
        ],
    },
    {
        "name": "Ops_Insights",
        "description": "El Supervisor evolve-mode — pattern recognition. Cada row = un insight / sugerencia de mejora al sistema. El Supervisor lo genera weekly, Jorge lo revisa.",
        "fields": [
            text("insight_id"),
            text("tenant_id"),
            dt("detected_at"),
            text("category",                 "bug | performance | cost | ux | security | auto-repair | feature"),
            text("severity",                 "critical | high | medium | low | info"),
            text("status",                   "open | acknowledged | applied | dismissed | auto-applied"),
            text("trigger_run_id",           "Ops_Health run_id that surfaced this"),

            text("component",                "Which agent / script / flow"),
            num("occurrences", 0,            "How many times this pattern repeated in the window"),
            text("window",                   "e.g. '7d' or '30d'"),

            long("pattern_description",      "What the Supervisor observed"),
            long("hypothesis",               "Why is this happening"),
            long("suggested_fix",            "Concrete action — file path + diff if applicable"),
            long("auto_fix_applied",         "If applied, what exactly"),
            long("evidence",                 "Quoted log lines / Airtable counts / metric deltas"),

            num("impact_estimate", 2,        "$ or score impact of fixing this"),
            text("assignee",                 "alex | jorge | auto"),
            dt("due_by"),
        ],
    },
]

def main():
    created = {}
    for t in TABLES:
        code, resp = http_post("/tables", t)
        if code == 200:
            created[t["name"]] = resp["id"]
            print(f"  ✅ created {t['name']:22} → {resp['id']}")
        elif code == 422 and "DUPLICATE_TABLE_NAME" in json.dumps(resp):
            print(f"  ⚠️  skipped {t['name']:22} (already exists)")
        else:
            print(f"  ❌ failed  {t['name']:22} → HTTP {code}: {json.dumps(resp)[:200]}")
            sys.exit(1)

    print("\n=== Paste into agents/tenants/pinnacle.json airtable block ===")
    key_map = {
        "Ops_Health":   "ops_health_table_id",
        "Ops_Insights": "ops_insights_table_id",
    }
    for n, tid in created.items():
        print(f'  "{key_map[n]}": "{tid}",')

if __name__ == "__main__":
    main()
