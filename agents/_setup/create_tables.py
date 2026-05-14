#!/usr/bin/env python3
"""
Provisiona las 5 tablas Airtable para los R9 agents en base Pinnacle CRM.
Idempotente: si la tabla ya existe (name conflict), salta.
"""
import json
import os
import sys
import urllib.request
import urllib.error

TOKEN=[REDACTED]("AIRTABLE_TOKEN") or "[REDACTED_AIRTABLE_PAT]"
BASE_ID = "[REDACTED_AIRTABLE_BASE_ID]"   # Pinnacle CRM
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

def http_post(path, body):
    req = urllib.request.Request(
        f"https://api.airtable.com/v0/meta/bases/{BASE_ID}{path}",
        data=json.dumps(body).encode(),
        headers=HEADERS,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def text(name, desc=""):        return {"name": name, "type": "singleLineText",  "description": desc}
def long(name, desc=""):        return {"name": name, "type": "multilineText",   "description": desc}
def url_(name, desc=""):        return {"name": name, "type": "url",             "description": desc}
def num(name, precision=0, desc=""):
    return {"name": name, "type": "number", "options": {"precision": precision}, "description": desc}
def dt(name, desc=""):
    return {"name": name, "type": "dateTime", "options": {
        "dateFormat": {"name":"iso"},
        "timeFormat": {"name":"24hour"},
        "timeZone":   "America/Chicago",
    }, "description": desc}

TABLES = [
    # ---------------- MARKETING AUDITS ----------------
    {
        "name": "Marketing_Audits",
        "description": "El Mercader audit history (weekly deep + 3-day health check). One row per run.",
        "fields": [
            text("run_id", "UUID pk"),
            text("tenant_id"),
            text("audit_type", "quick_health | deep_audit | on_demand"),
            text("status", "Queued | Running | Done | Failed"),
            text("trigger", "cron | alex_manual | api"),
            dt("started_at"),
            dt("completed_at"),
            num("duration_sec"),
            num("score", 0, "0-100 overall"),
            num("score_delta", 0, "Change vs previous run"),
            long("top_issues"),
            long("top_wins"),
            long("recommendations"),
            long("summary_md"),
            url_("report_url"),
            num("tokens_used"),
        ],
    },
    # ---------------- SEO AUDITS ----------------
    {
        "name": "SEO_Audits",
        "description": "El Posicionador audit history (every 3d seo_health + maps_deep, weekly seo_deep).",
        "fields": [
            text("run_id"),
            text("tenant_id"),
            text("audit_type", "seo_health | seo_deep | maps_deep | on_demand"),
            text("status"),
            text("trigger"),
            dt("started_at"),
            dt("completed_at"),
            num("duration_sec"),
            num("overall_score",   0, "0-100"),
            num("technical_score", 0),
            num("local_score",     0),
            num("content_score",   0),
            long("mobile_cwv", "LCP/CLS/INP with PASS/WARN/FAIL"),
            num("score_delta", 0),
            long("top_issues"),
            long("top_wins"),
            long("recommendations"),
            long("local_ranks", "Rank per city"),
            long("competitor_gaps"),
            long("schema_coverage"),
            long("summary_md"),
            url_("report_url"),
            num("tokens_used"),
        ],
    },
    # ---------------- CONTENT QUEUE ----------------
    {
        "name": "Content_Queue",
        "description": "El Escriba content drafts + plan entries. Sub-sub-agent bajo El Posicionador.",
        "fields": [
            text("run_id"),
            text("tenant_id"),
            text("status",       "Research | Planned | Drafting | Review | Approved | Scheduled | Published | Rejected"),
            text("content_type", "blog_post | q_and_a_page | news_article | pillar_page | service_page | atp_question"),
            text("pillar"),
            text("title"),
            text("slug"),
            text("target_keyword"),
            long("secondary_keywords"),
            text("intent_query"),
            long("meta_description"),
            text("schema_type"),
            long("schema_jsonld"),
            long("body_md"),
            long("body_md_es"),
            num("word_count"),
            long("suggested_internal_links"),
            long("external_citations"),
            text("target_audience_hint"),
            text("source_seo_gap_run_id"),
            text("source_atp_question_id"),
            {"name": "proposed_publish_date", "type": "date", "options": {"dateFormat": {"name":"iso"}}},
            num("wp_post_id"),
            url_("published_url"),
            long("review_notes"),
            num("tokens_used"),
            text("trigger"),
        ],
    },
    # ---------------- GMB QUEUE ----------------
    {
        "name": "GMB_Queue",
        "description": "El Cartografo pending write-ops to Google Business Profile. Human-in-the-loop.",
        "fields": [
            text("queue_id"),
            text("tenant_id"),
            text("operation", "publish_post | respond_review | upload_photo | update_hours | update_description | answer_qa"),
            long("payload_json"),
            text("status", "Draft | PendingApproval | Approved | Executing | Done | Rejected | Failed"),
            dt("approval_requested_at"),
            dt("approved_at"),
            dt("executed_at"),
            long("api_response"),
            num("tokens_used"),
        ],
    },
    # ---------------- GMB AUDIT LOG ----------------
    {
        "name": "GMB_Audit_Log",
        "description": "Forensic trail of every GBP API call (writes + prohibited attempts). Anti-ban forensics.",
        "fields": [
            text("log_id"),
            text("tenant_id"),
            text("queue_id",  "Reference to GMB_Queue.queue_id"),
            text("operation"),
            long("before_state"),
            long("after_state"),
            num("api_status_code"),
            text("approved_by"),
        ],
    },
]

def main():
    created = {}
    skipped = []
    for t in TABLES:
        code, resp = http_post("/tables", t)
        if code == 200:
            created[t["name"]] = resp["id"]
            print(f"  ✅ created {t['name']:20} → {resp['id']}")
        elif code == 422 and "DUPLICATE_TABLE_NAME" in json.dumps(resp):
            skipped.append(t["name"])
            print(f"  ⚠️  skipped {t['name']:20} (already exists)")
        else:
            print(f"  ❌ failed  {t['name']:20} → HTTP {code}: {json.dumps(resp)[:200]}")
            sys.exit(1)

    # Build summary for pinnacle.json airtable block
    print("\n=== Paste into agents/tenants/pinnacle.json airtable section ===")
    key_map = {
        "Marketing_Audits":     "table_id",
        "SEO_Audits":           "seo_table_id",
        "Content_Queue":        "content_queue_table_id",
        "GMB_Queue":            "gmb_queue_table_id",
        "GMB_Audit_Log":        "gmb_audit_log_table_id",
    }
    for name, tid in created.items():
        print(f'  "{key_map.get(name, name)}": "{tid}",')

if __name__ == "__main__":
    main()
