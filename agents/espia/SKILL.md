---
name: el-espia
description: Always-on daily competitor watchdog sub-agent for the R9 plantel. Scrapes competitor sites (homepage + pricing + landing pages), detects diffs vs prior scan (pricing changes, new offers, new CTAs, new pages), scores severity 0-10, and alerts Jorge when a competitor moves in a way worth reacting to.
version: 1.0
owner: ALEX
tenant: any (config in agents/tenants/<slug>.json)
cadence: daily 09:00 CT
runtime: node >= 22 + claude CLI
---

# El Espía — Daily Competitor Intelligence Sub-Agent

## Propósito
Jorge needs to know when We Buy Ugly Houses drops their offer price, when HomeVestors launches a new TV spot, when a new wholesaler enters Milwaukee. Manual stalking = expensive. Espía does it nightly.

## Modes

| Mode | Frequency | Scope | Tokens |
|---|---|---|---|
| `daily` | every 09:00 CT | all competitors from cfg.competitors — full scan + diff | 8-20K |
| `weekly_deep` | Sunday 10:00 CT | + Facebook Ad Library + Google Business Profile + review velocity | 15-30K |
| `on_demand` | manual `--competitor URL` | one-off scan | 3-8K |

## Signals tracked
- **Copy**: title_tag, h1_text, hero_copy_snippet
- **CTAs**: all button text on homepage + pricing page
- **Offers**: dollar amounts, "cash in 7 days", percentages
- **Pricing**: any visible price or offer range
- **NAP**: phone numbers, addresses (multi-location expansion signal)
- **Social**: linked social accounts (new channel = new investment)
- **Schema**: structured data changes (review score, new LocalBusiness, etc.)
- **New pages**: sitemap diff OR internal-link crawl delta
- **Removed pages**: prior-scan pages now 404
- **Ads** (weekly_deep): Facebook Ad Library active creatives

## Diff scoring (0-10 change_severity)
- 0-2: cosmetic (copy tweaks, image swaps) — log, no alert
- 3-5: moderate (new CTA variant, price adjusted, schema change) — daily digest
- 6-8: significant (offer changed, new service line, new location) — Telegram
- 9-10: critical (pricing war, new ad campaign, new market entry) — 🚨 Telegram

## Inputs
- `cfg.competitors[]` — list of {name, url}
- Prior Competitor_Intel records (for diff basis, matched by competitor_url)

## Output (Airtable Competitor_Intel — one row per competitor per scan)
Full field list in `agents/_setup/create_sprint2_tables.py`.

## Fetch strategy
1. Fetch competitor URL with User-Agent "Mozilla/5.0 (compatible; PinnacleBot/1.0)"
2. Extract: title, h1, hero paragraph, buttons, phone regex, address regex, social links
3. Word count + sitemap.xml check if available
4. Claude subprocess gets the raw extracts + prior record → generates changes_summary + recommended_action
5. Write row. If change_severity >=6 → Telegram alert.

## Respectful crawling
- 1 request per second per domain
- Cache-Bust only on scheduled runs
- No aggressive crawling beyond homepage + 2 key pages per competitor
- robots.txt honored (if /robots.txt disallows, log and skip)

## R9 compliance
- ✅ Always-on (daily cron)
- ✅ Dedicated domain (competitive intel)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (fetches mobile viewport User-Agent)
- ✅ Billing-ready (tokens_used per run)
- ✅ Audit trail (Competitor_Intel + raw_html_snippet first 10KB)

## Author log
- 2026-04-23: v1 shipped. Uses _shared/runner.mjs + native fetch. No external scraping service needed for v1.
