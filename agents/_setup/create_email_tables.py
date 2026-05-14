#!/usr/bin/env python3
"""Provisiona las 4 tablas Email_* para El Remitente en base Pinnacle CRM."""
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

def text(name, desc=""):   return {"name": name, "type": "singleLineText", "description": desc}
def long(name, desc=""):   return {"name": name, "type": "multilineText",  "description": desc}
def url_(name, desc=""):   return {"name": name, "type": "url",            "description": desc}
def email(name, desc=""):  return {"name": name, "type": "email",          "description": desc}
def num(name, precision=0, desc=""):
    return {"name": name, "type": "number", "options": {"precision": precision}, "description": desc}
def dt(name, desc=""):
    return {"name": name, "type": "dateTime", "options": {
        "dateFormat": {"name":"iso"}, "timeFormat": {"name":"24hour"},
        "timeZone": "America/Chicago",
    }, "description": desc}

TABLES = [
    # ---------------- EMAIL_SUBSCRIBERS ----------------
    {
        "name": "Email_Subscribers",
        "description": "El Remitente subscriber list — source of truth for email audience. Linked (by email) to Contacts. Status transitions: Active -> Unsubscribed/Bounced/Complained.",
        "fields": [
            text("subscriber_id", "UUID pk"),
            text("tenant_id"),
            email("email"),
            text("status",   "Active | Unsubscribed | Bounced | Complained"),
            text("source",   "popup | webform | manual | import"),
            text("lang",     "en | es"),
            dt("subscribed_at"),
            dt("unsubscribed_at"),
            dt("last_email_sent_at"),
            long("tags", "comma-separated: foreclosure, probate, seller, landlord, etc."),
            text("unsubscribe_token", "random signed token for 1-click unsubscribe links"),
            long("notes"),
        ],
    },
    # ---------------- EMAIL_TEMPLATES ----------------
    {
        "name": "Email_Templates",
        "description": "Reusable email templates with {{placeholder}} variables. Used by El Escriba output + El Remitente broadcasts.",
        "fields": [
            text("template_id", "UUID pk"),
            text("tenant_id"),
            text("name",    "internal identifier: welcome_en | nurture_market_update | foreclosure_guide_delivery | etc."),
            text("category","welcome | nurture | promo | transactional | lead_magnet_delivery"),
            text("language","en | es"),
            text("subject_template",    "Uses {{name}}, {{city}}, etc."),
            long("preview_text_template","90 chars — shows in inbox preview"),
            long("body_html", "HTML with {{placeholders}} — mobile-first, 600px max-width, responsive"),
            long("body_text", "plain text fallback"),
            long("notes",     "usage guidance + change log"),
        ],
    },
    # ---------------- EMAIL_CAMPAIGNS ----------------
    {
        "name": "Email_Campaigns",
        "description": "Email blasts / broadcasts. Template + audience filter + schedule. Status: Draft -> Scheduled -> Sending -> Sent.",
        "fields": [
            text("campaign_id",  "UUID pk"),
            text("tenant_id"),
            text("name",         "internal label"),
            text("status",       "Draft | Scheduled | Sending | Sent | Paused | Failed"),
            text("subject"),
            long("preview_text"),
            text("template_id",  "reference to Email_Templates"),
            long("body_html",    "rendered final HTML (placeholders resolved at send time)"),
            long("body_text"),
            long("audience_filter", "Airtable filterByFormula against Email_Subscribers — e.g. AND({status}='Active', FIND('foreclosure',{tags}))"),
            dt("scheduled_at"),
            dt("sent_at"),
            num("sent_count"),
            num("open_count"),
            num("click_count"),
            num("unsubscribe_count"),
            num("bounce_count"),
            text("source_content_queue_id", "if campaign was generated from Escriba's Content_Queue entry"),
            long("notes"),
            text("trigger",      "manual | scheduled | sequence_step | on_subscribe"),
        ],
    },
    # ---------------- EMAIL_EVENTS ----------------
    {
        "name": "Email_Events",
        "description": "Per-recipient event log: queued, sent, opened, clicked, bounced, unsubscribed, complained. Feeds engagement analytics + segmentation.",
        "fields": [
            text("event_id",    "UUID pk"),
            text("tenant_id"),
            text("campaign_id"),
            email("subscriber_email"),
            text("event_type",  "queued | sent | delivered | opened | clicked | bounced | unsubscribed | complained | failed"),
            dt("event_at"),
            text("tracking_id", "short opaque string used in pixel + click URLs"),
            url_("clicked_url", "for event_type=clicked"),
            long("user_agent"),
            text("ip_hash",     "SHA256 of IP for rough uniqueness — NOT raw IP (privacy)"),
            long("metadata_json"),
        ],
    },
]

def main():
    created = {}; skipped = []
    for t in TABLES:
        code, resp = http_post("/tables", t)
        if code == 200:
            created[t["name"]] = resp["id"]
            print(f"  ✅ created {t['name']:22} → {resp['id']}")
        elif code == 422 and "DUPLICATE_TABLE_NAME" in json.dumps(resp):
            skipped.append(t["name"])
            print(f"  ⚠️  skipped {t['name']:22} (already exists)")
        else:
            print(f"  ❌ failed  {t['name']:22} → HTTP {code}: {json.dumps(resp)[:200]}")
            sys.exit(1)

    print("\n=== Paste into agents/tenants/pinnacle.json ===")
    key_map = {
        "Email_Subscribers": "email_subscribers_table_id",
        "Email_Templates":   "email_templates_table_id",
        "Email_Campaigns":   "email_campaigns_table_id",
        "Email_Events":      "email_events_table_id",
    }
    for name, tid in created.items():
        print(f'  "{key_map[name]}": "{tid}",')

if __name__ == "__main__":
    main()
