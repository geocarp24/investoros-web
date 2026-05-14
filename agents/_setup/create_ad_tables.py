#!/usr/bin/env python3
"""Provisiona Ad_Performance Airtable table para El Cazador."""
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
        return e.code, json.loads(e.read().decode())

def text(n, d=""):  return {"name": n, "type": "singleLineText",  "description": d}
def long(n, d=""):  return {"name": n, "type": "multilineText",   "description": d}
def url_(n, d=""):  return {"name": n, "type": "url",             "description": d}
def num(n, p=0, d=""):
    return {"name": n, "type": "number", "options": {"precision": p}, "description": d}
def dt(n, d=""):
    return {"name": n, "type": "dateTime", "options": {
        "dateFormat": {"name":"iso"}, "timeFormat": {"name":"24hour"},
        "timeZone": "America/Chicago",
    }, "description": d}

TABLES = [
    {
        "name": "Ad_Performance",
        "description": "El Cazador audit history + spend tracking across Google Ads / Meta / TikTok / LinkedIn / Microsoft / Apple / YouTube. Uses claude-ads skill suite.",
        "fields": [
            text("run_id",   "UUID pk"),
            text("tenant_id"),
            text("audit_type", "ads_health | ads_deep | on_demand"),
            text("status",     "Queued | Running | Done | Failed"),
            text("trigger",    "cron | alex_manual | api"),
            dt("started_at"),
            dt("completed_at"),
            num("duration_sec"),
            text("platform",   "google | meta | tiktok | linkedin | microsoft | apple | youtube | multi"),

            # --- Performance metrics ---
            num("overall_score",    0, "0-100 overall ads quality"),
            num("spend_last_7d",    2, "USD"),
            num("spend_last_30d",   2),
            num("conversions_7d",   0),
            num("conversions_30d",  0),
            num("cpl_7d",           2, "Cost per lead"),
            num("cpl_30d",          2),
            num("ctr_avg",          4, "CTR avg % (0.0-1.0)"),
            num("cpc_avg",          2, "USD"),
            num("roas",             2, "Return on ad spend"),
            num("quality_score_avg", 1, "Google Quality Score 1-10"),

            # --- Analysis output ---
            num("score_delta",      0, "vs previous run"),
            long("top_issues",      "Budget waste, underperforming creatives, broken tracking, etc."),
            long("top_wins",        "What's working (keep/scale)"),
            long("recommendations", "Prioritized actions"),
            long("platform_breakdown", "Per-platform summary if multi"),
            long("creative_analysis"),
            long("audience_analysis"),
            long("landing_page_issues"),
            long("competitor_intel"),

            # --- Source data ---
            long("source_data_snapshot", "Raw data provided (exports/screenshots/pasted metrics)"),
            url_("report_url"),
            num("tokens_used"),
        ],
    }
]

def main():
    for t in TABLES:
        code, resp = http_post("/tables", t)
        if code == 200:
            print(f"  ✅ created {t['name']:18} → {resp['id']}")
            print(f"\n  ads_table_id -> \"{resp['id']}\"")
        elif code == 422 and "DUPLICATE_TABLE_NAME" in json.dumps(resp):
            print(f"  ⚠️  skipped {t['name']:18} (already exists)")
        else:
            print(f"  ❌ failed  {t['name']:18} → HTTP {code}: {json.dumps(resp)[:200]}")
            sys.exit(1)

if __name__ == "__main__":
    main()
