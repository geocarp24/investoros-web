# El Analista — Weekly Exec Dashboard Sub-Agent

R9 plantel member. Digests ALL other agent outputs + CRM pipeline + revenue into ONE exec brief Jorge reads every Monday 7am CT.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Spec + 3 modes + input aggregation |
| `analista.mjs` | Orchestrator (thin wrapper on `_shared/runner.mjs`) |
| `runs/` | MD per run |

Tabla Airtable: `Weekly_Dashboards` en base `[REDACTED_AIRTABLE_BASE_ID]` — ID `[REDACTED_AIRTABLE_TABLE_ID]` (en `pinnacle.json.airtable.weekly_dashboards_table_id`).

## Modos

- `weekly`  — cron cada lunes 07:00 CT, ISO week actual (10-20K tokens, 3-6 min)
- `ad_hoc`  — regenera semana específica con `--week 2026-W17`
- `preview` — muestra métricas + prompt sin llamar claude (dry-run equiv)

## Inputs aggregated (cross-table)

- Marketing_Audits (Mercader)
- SEO_Audits (Posicionador)
- Ad_Performance (Cazador)
- Content_Queue (Escriba)
- Email_Campaigns + Email_Events (Remitente)
- Competitor_Intel (Espía)
- Compliance_Audits (Auditor)
- Lead_Scores (Clasificador)
- Leads, Deals, Contacts (CRM core)

## Dry-run

```bash
node agents/analista/analista.mjs --tenant pinnacle --mode preview
node agents/analista/analista.mjs --tenant pinnacle --mode weekly --dry-run
node agents/analista/analista.mjs --tenant pinnacle --mode ad_hoc --week 2026-W17 --dry-run
```

## Real run

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
node agents/analista/analista.mjs --tenant pinnacle --mode weekly
```

## Cron

```cron
0 7 * * 1 cd /path/to/alex-real-estate-system && node agents/analista/analista.mjs --tenant pinnacle --mode weekly
```

## Telegram format

📊 tenant name · week W17 · N leads · M closed · $$$
+ executive_summary (3 paragraphs)
+ headline_wins (top 3)
+ headline_concerns (top 3)

## R9 compliance

- ✅ Always-on (weekly cron)
- ✅ Dedicated domain (exec reporting)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (brief designed for phone, short lines)
- ✅ Billing-ready (tokens_used + source costs rollup)
- ✅ Audit trail (Weekly_Dashboards + pdf_url optional)

## Author log

- 2026-04-23: v1 shipped. 7mo agente del plantel R9 (gap agent #2). Uses shared runner.
