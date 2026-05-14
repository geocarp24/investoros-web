# El Clasificador — Lead Scoring Sub-Agent

Always-on R9 plantel member. Scores inbound leads so Jorge+Fer know who to call first.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Spec + 3 modes + 5 scoring axes + heat thresholds |
| `clasificador.mjs` | Orchestrator (thin wrapper on `_shared/runner.mjs`) |
| `runs/` | MD per run |

Tabla Airtable: `Lead_Scores` en base `[REDACTED_AIRTABLE_BASE_ID]` — ID `[REDACTED_AIRTABLE_TABLE_ID]` (ya cableada en `pinnacle.json.airtable.lead_scores_table_id`).

## Modos

- `score_batch` — cron cada 2h, pulls 25 más recientes de `Leads` (5-15K tokens, 2-5 min)
- `score_one`   — on_demand, `--lead-id recXYZ` para un solo lead (800-2K, <1 min)
- `rescore_hot` — nightly, reevalúa leads actualmente en Hot por urgencia-decay (3-8K)

## Scoring axes + pesos

| Axis | Weight | What it measures |
|---|---|---|
| urgency | 0.30 | Time pressure: foreclosure date, eviction, tax sale |
| distress | 0.25 | Life/financial severity: liens, probate, code violations |
| property | 0.20 | ARV minus rehab, location tier, zoning |
| timeline | 0.15 | How fast they NEED to close |
| motivation | 0.10 | Psychological readiness |

## Dry-run

```bash
node agents/clasificador/clasificador.mjs --tenant pinnacle --mode score_batch --dry-run
node agents/clasificador/clasificador.mjs --tenant pinnacle --mode score_one --lead-id recXYZ --dry-run
node agents/clasificador/clasificador.mjs --tenant pinnacle --mode rescore_hot --dry-run
```

## Real run

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
node agents/clasificador/clasificador.mjs --tenant pinnacle --mode score_batch
```

## Cron (pending host decision)

```cron
# Every 2 hours, score any unscored or stale leads
0 */2 * * * cd /path/to/alex-real-estate-system && node agents/clasificador/clasificador.mjs --tenant pinnacle --mode score_batch

# Nightly 8pm CT, rescore currently-Hot leads (urgency decay)
0 20 * * * cd /path/to/alex-real-estate-system && node agents/clasificador/clasificador.mjs --tenant pinnacle --mode rescore_hot
```

## Alertas Telegram

- 🔥 hot>0 → "LEAD HOT: top 3 record IDs with scores"
- 🌡 warm>0 only → daily rollup
- 🎯 none Hot → silent weekly summary

## R9 compliance

- ✅ Always-on (cron 2h)
- ✅ Dedicated domain (lead scoring)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (popup → scored within 2h max)
- ✅ Billing-ready (tokens_used per run)
- ✅ Audit trail (Lead_Scores.score_delta + summary_md + individual rows per lead)

## Author log

- 2026-04-23: v1 shipped. 6to agente del plantel R9 (gap agent #1). Uses shared runner.
