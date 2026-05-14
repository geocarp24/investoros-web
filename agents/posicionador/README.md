# El Posicionador — SEO Monitoring Sub-Agent

Always-on SEO monitoring for multi-tenant real-estate SaaS. Tenant zero: Pinnacle Holdings (`pinnaclegroupwi.com`).

Part of plantel R9: **El Oráculo** (predictor) + **El Mercader** (marketing ops) + **El Posicionador** (SEO) + **El Cazador** (Ads).

Mobile-first priority (R7) — mobile CWV weighted heavier than desktop in all modes. Local SEO priority for Pinnacle WI market.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Anthropic-format skill spec |
| `posicionador.mjs` | Node orchestrator — same architecture as `mercader.mjs` |
| `runs/` | Auto-created. Stores raw MD output per run |
| `../tenants/pinnacle.json` | Tenant zero config |

## Modes

### `seo_health` (every 3 days Mon/Thu/Sun, per R9)
Lightweight `/seo audit` overview. <5K tokens, 2-4 min. Detects regressions (delta vs previous audit).

### `seo_deep` (weekly Mondays, per R9)
Full audit: `/seo audit` + `/seo technical` + `/seo local` + `/seo maps` + `/seo content`. 15-35K tokens, 8-20 min. Produces scored, geo-granular report.

### `on_demand`
Triggered by ALEX on Jorge's request.

## Local testing (dry-run — no subprocess, no Airtable, no Telegram)

```bash
node agents/posicionador/posicionador.mjs --tenant pinnacle --mode seo_health --dry-run
node agents/posicionador/posicionador.mjs --tenant pinnacle --mode seo_deep   --dry-run
```

## Real run (spawns claude CLI — costs tokens)

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
node agents/posicionador/posicionador.mjs --tenant pinnacle --mode seo_health
```

Requires:
1. `claude` CLI authenticated (`claude login`)
2. 3 env vars above set
3. `airtable.seo_table_id` set in tenant JSON (or fallback `airtable.table_id`) — create `SEO_Audits` table first with schema from SKILL.md
4. Run from a **clean environment** (not nested inside another Claude Code session)

## Schema decisions — `seo_table_id` vs `table_id`

Since El Mercader uses `airtable.table_id` for `Marketing_Audits` and El Posicionador needs its own table `SEO_Audits`, the tenant JSON can have BOTH:

```json
{
  "airtable": {
    "base_id": "[REDACTED_AIRTABLE_BASE_ID]",
    "table_id":      "tbl_marketing_audits_id",   // El Mercader writes here
    "seo_table_id":  "tbl_seo_audits_id",         // El Posicionador writes here
    "ads_table_id":  "tbl_ad_performance_id",     // El Cazador (future)
    "token_env":     "AIRTABLE_TOKEN"
  }
}
```

If `seo_table_id` is missing, El Posicionador falls back to `table_id` (shared table, not ideal but non-blocking).

## Deployment — cron (when Jorge approves)

```cron
# Every 3 days at 08:00 CST (14:00 UTC) — SEO health check
0 14 */3 * * cd /path/to/alex-real-estate-system && node agents/posicionador/posicionador.mjs --tenant pinnacle --mode seo_health >> /var/log/posicionador.log 2>&1

# Every Monday at 09:00 CST (15:00 UTC) — SEO deep audit
0 15 * * 1 cd /path/to/alex-real-estate-system && node agents/posicionador/posicionador.mjs --tenant pinnacle --mode seo_deep >> /var/log/posicionador.log 2>&1
```

## Adding a new tenant

Same pattern as El Mercader — copy `_template.json`, add `seo_table_id` pointing to that tenant's SEO_Audits table. No code changes.

## R9 compliance

- ✅ Always-on (cron schedule from R9)
- ✅ Dedicated to one domain (SEO)
- ✅ Audit history in Airtable (billing + SaaS reporting)
- ✅ Alerts Telegram on thresholds + regressions (≥10 point drop)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first priority (R7)
- ✅ Invokable on-demand by ALEX
- ⚠ Deployment pending (cron host + claude auth + SEO_Audits table)

## Pending before production

1. **Jorge approval:** create `SEO_Audits` Airtable table with schema from `SKILL.md` → paste `table_id` into `pinnacle.json.airtable.seo_table_id`
2. **Same host decision as El Mercader** (shared cron + claude auth)
3. **Smoke test:** `--dry-run` → real `seo_health` → real `seo_deep`

## Author log

- 2026-04-23: v1 draft by ALEX as second of R9 sub-agents. Same pattern as El Mercader (DRY shared lib refactor deferred until El Cazador lands).
