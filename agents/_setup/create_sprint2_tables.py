#!/usr/bin/env python3
"""Provisiona las 4 tablas Sprint 2: Lead_Scores, Weekly_Dashboards, Competitor_Intel, Compliance_Audits."""
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
        with urllib.request.urlopen(req, timeout=30) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read().decode())

def text(n, d=""):   return {"name": n, "type": "singleLineText",  "description": d}
def long(n, d=""):   return {"name": n, "type": "multilineText",   "description": d}
def url_(n, d=""):   return {"name": n, "type": "url",             "description": d}
def num(n, p=0, d=""):
    return {"name": n, "type": "number", "options": {"precision": p}, "description": d}
def dt(n, d=""):
    return {"name": n, "type": "dateTime", "options": {"dateFormat": {"name":"iso"},
        "timeFormat": {"name":"24hour"}, "timeZone": "America/Chicago"}, "description": d}

TABLES = [
    # ---------------- LEAD_SCORES (El Clasificador) ----------------
    {
        "name": "Lead_Scores",
        "description": "El Clasificador — per-lead scoring: urgency + distress + property + timeline. Feeds Fer prioritization (llama hot leads primero).",
        "fields": [
            text("run_id"),
            text("tenant_id"),
            text("lead_id",              "Reference a Leads.<record_id>"),
            text("contact_id",           "Reference a Contacts.<record_id> (si está linkeado)"),
            text("status",               "Queued | Running | Done | Failed"),
            text("trigger",              "cron | alex_manual | api"),
            dt("scored_at"),
            num("overall_score", 0, "0-100 composite"),
            text("heat",                 "🔥 Hot | 🌡 Warm | ❄️ Cold | 🚫 Disqualify"),
            num("urgency_score", 0,      "0-100 — time pressure (foreclosure date, eviction, etc)"),
            num("distress_score", 0,     "0-100 — financial/life distress severity"),
            num("property_score", 0,     "0-100 — attractiveness of the asset (ARV minus rehab)"),
            num("timeline_score", 0,     "0-100 — how fast they need to close"),
            num("motivation_score", 0,   "0-100 — psychological readiness to sell"),
            long("rationale",            "Why this score: reasoning chain"),
            long("red_flags",            "Reasons to deprioritize (investor competitor, litigation, liens)"),
            long("green_flags",          "Reasons to prioritize (clear title, motivated seller, fast close)"),
            text("suggested_action",     "call_now | sms_urgent | follow_up_48h | nurture_weekly | disqualify"),
            text("suggested_owner",      "fer | human_rep | drop"),
            num("score_delta", 0,        "Change vs last scoring of this same lead"),
            long("summary_md"),
            num("tokens_used"),
        ],
    },
    # ---------------- WEEKLY_DASHBOARDS (El Analista) ----------------
    {
        "name": "Weekly_Dashboards",
        "description": "El Analista — weekly exec dashboard unifying outputs from all R9 agents + CRM pipeline + revenue. One row per week.",
        "fields": [
            text("run_id"),
            text("tenant_id"),
            text("week_iso",             "e.g. 2026-W17 (ISO week)"),
            dt("week_start"),
            dt("week_end"),
            text("status"),
            text("trigger"),
            dt("started_at"),
            dt("completed_at"),
            num("duration_sec"),

            # --- Pipeline metrics ---
            num("new_leads",             0, "Leads added this week"),
            num("qualified_leads",       0),
            num("deals_closed",          0),
            num("deals_lost",            0),
            num("revenue_this_week",     2),
            num("pipeline_velocity_days",1, "Avg days lead→close"),

            # --- Marketing rollup ---
            num("marketing_audit_score", 0, "Latest Mercader"),
            num("seo_score",             0, "Latest Posicionador overall"),
            num("ads_score",             0, "Latest Cazador"),
            num("emails_sent",           0),
            num("email_open_rate",       1, "%"),
            num("email_click_rate",      1, "%"),
            num("content_published",     0, "Escriba drafts approved this week"),
            num("gbp_posts_published",   0),
            num("reviews_received",      0),
            num("organic_rank_1_pages",  0, "Pages at #1 this week (from Posicionador)"),

            # --- Narrative ---
            long("headline_wins",        "Top 3 wins (bullet list)"),
            long("headline_concerns",    "Top 3 concerns"),
            long("action_items",         "Priorities for next week"),
            long("competitor_movements", "Top competitor changes (from Espía)"),
            long("compliance_flags",     "Top compliance issues (from Auditor)"),
            long("executive_summary_md", "3-paragraph exec brief"),
            url_("pdf_url",              "Generated PDF report"),
            num("tokens_used"),
        ],
    },
    # ---------------- COMPETITOR_INTEL (El Espía) ----------------
    {
        "name": "Competitor_Intel",
        "description": "El Espía — daily competitor scans. One row per competitor per scan. Detects pricing, ad, content, offer changes.",
        "fields": [
            text("run_id"),
            text("tenant_id"),
            text("competitor_name"),
            url_("competitor_url"),
            text("status"),
            text("trigger"),
            dt("scanned_at"),
            num("duration_sec"),

            # --- Snapshot ---
            text("title_tag"),
            long("h1_text"),
            long("hero_copy_snippet"),
            num("word_count"),
            long("cta_buttons",          "Comma list of CTAs observed"),
            long("pricing_observed"),
            long("offers_observed"),
            long("phone_numbers"),
            long("addresses"),
            long("social_links"),
            long("ad_copy_samples",      "If Espía also scrapes Facebook Ad Library"),
            long("new_pages_detected"),
            long("removed_pages_detected"),
            long("schema_changes"),

            # --- Diff vs last scan ---
            long("changes_summary",      "What changed vs last scan of same competitor"),
            num("change_severity",       0, "0-10 — how meaningful is the change"),
            long("recommended_action",   "What Pinnacle should do in response"),

            # --- Raw ---
            long("raw_html_snippet",     "First 10KB of raw HTML"),
            url_("screenshot_url"),
            num("tokens_used"),
        ],
    },
    # ---------------- COMPLIANCE_AUDITS (El Auditor) ----------------
    {
        "name": "Compliance_Audits",
        "description": "El Auditor — weekly compliance sweep. WI wholesaler + TCPA (SMS) + CAN-SPAM (email) + Fair Housing + GDPR.",
        "fields": [
            text("run_id"),
            text("tenant_id"),
            text("status"),
            text("trigger"),
            dt("started_at"),
            dt("completed_at"),
            num("duration_sec"),

            # --- Scores per regulation ---
            num("overall_score", 0,      "0-100 composite"),
            num("wi_wholesaler_score", 0,"Wisconsin real estate wholesaler compliance (license, disclosure, P&S contracts)"),
            num("tcpa_score", 0,         "TCPA SMS compliance (opt-in consent, clear STOP handling, no auto-dialer without consent)"),
            num("can_spam_score", 0,     "CAN-SPAM email (physical address, unsubscribe, no deceptive subject, prompt unsub)"),
            num("fair_housing_score", 0, "Fair Housing Act (no discriminatory language, equal access)"),
            num("gdpr_score", 0,         "GDPR (if EU visitors — cookie consent, data export/delete rights)"),
            num("adaweb_score", 0,       "ADA web accessibility (a11y-audit wrapper)"),

            # --- Findings ---
            long("critical_issues",      "Issues that need immediate fix (lawsuit exposure)"),
            long("warnings",             "Moderate issues — fix this month"),
            long("passing",              "What's currently compliant"),
            long("recommendations"),
            long("evidence_snippets",    "Quoted text from site/emails/SMS as evidence"),
            num("score_delta", 0),
            long("summary_md"),
            url_("report_url"),
            num("tokens_used"),
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
        "Lead_Scores":         "lead_scores_table_id",
        "Weekly_Dashboards":   "weekly_dashboards_table_id",
        "Competitor_Intel":    "competitor_intel_table_id",
        "Compliance_Audits":   "compliance_audits_table_id",
    }
    for n, tid in created.items():
        print(f'  "{key_map[n]}": "{tid}",')

if __name__ == "__main__":
    main()
