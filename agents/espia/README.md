# El Espía — Daily Competitor Watchdog Sub-Agent

R9 plantel member. Scrapes competitor websites daily, detects diffs vs prior scan (pricing, offers, CTAs, new pages), rates change severity 0-10, alerts Jorge when significant moves happen.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Spec + 3 modes + signals tracked |
| `espia.mjs` | Orchestrator (thin wrapper on `_shared/runner.mjs`) |
| `runs/` | MD per run |

Tabla Airtable: `Competitor_Intel` en base `[REDACTED_AIRTABLE_BASE_ID]` — ID `[REDACTED_AIRTABLE_TABLE_ID]` (en `pinnacle.json.airtable.competitor_intel_table_id`).

## Modos

- `daily`        — cron 09:00 CT, scan all cfg.competitors (8-20K tokens, 3-6 min)
- `weekly_deep`  — Sunday 10:00 CT, + Facebook Ad Library + GBP + review velocity (15-30K)
- `on_demand`    — manual one-off, `--competitor URL`

## Competitors (current cfg.pinnacle)

- We Buy Ugly Houses Wisconsin
- HomeVestors Milwaukee
- Sell My House Fast Milwaukee

Add more to `agents/tenants/pinnacle.json.competitors[]`.

## Signals

- title, h1, hero copy
- CTAs (buttons + action links)
- phones, addresses (multi-location signal)
- social links
- pricing dollar amounts
- offer keywords ("7 days", "as-is", "no fees")
- schema JSON-LD blocks
- word count
- raw HTML first 10KB

## Severity scale

| Score | Meaning | Alert |
|---|---|---|
| 0-2 | cosmetic | silent |
| 3-5 | moderate | 🟡 digest |
| 6-8 | significant | ⚠️ Telegram |
| 9-10 | critical | 🚨 immediate |

## Dry-run

```bash
node agents/espia/espia.mjs --tenant pinnacle --mode daily --dry-run
node agents/espia/espia.mjs --tenant pinnacle --mode on_demand --competitor https://www.webuyuglyhouses.com/wisconsin --dry-run
```

## Real run

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
node agents/espia/espia.mjs --tenant pinnacle --mode daily
```

## Cron

```cron
0 9 * * *  cd /path/to/alex-real-estate-system && node agents/espia/espia.mjs --tenant pinnacle --mode daily
0 10 * * 0 cd /path/to/alex-real-estate-system && node agents/espia/espia.mjs --tenant pinnacle --mode weekly_deep
```

## Respectful crawling

- User-Agent identifies as PinnacleBot with contact URL
- 1 request per second per domain
- No aggressive recursive crawl (homepage + 2 key pages max)
- robots.txt honored

## R9 compliance

- ✅ Always-on (daily cron)
- ✅ Dedicated domain (competitive intel)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (native fetch can send mobile UA)
- ✅ Billing-ready (tokens_used per run)
- ✅ Audit trail (Competitor_Intel + raw_html_snippet)

## Author log

- 2026-04-23: v1 shipped. 8vo agente del plantel R9 (gap agent #3). Uses shared runner + native fetch (no external scraping API needed).
