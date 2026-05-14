# El Cazador — Ads Audit Sub-Agent

Último del plantel R9 core. Audita paid advertising (Google + Meta + TikTok + LinkedIn + Microsoft + Apple + YouTube). Mismo patrón Mercader/Posicionador/Escriba/Remitente.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Spec + 3 modes + Ad_Performance schema |
| `cazador.mjs` | Orchestrator Node ejecutable |
| `../_setup/create_ad_tables.py` | Script provisionó `Ad_Performance` (ya corrido) |
| `runs/` | Output MD por run |

## Airtable

`Ad_Performance` table en base `[REDACTED_AIRTABLE_BASE_ID]` — ID `[REDACTED_AIRTABLE_TABLE_ID]` (ya cableada en `pinnacle.json.airtable.ads_table_id`).

## Modos

- `ads_health` — cada 3 días, quick check (3-6K tokens, 2-3 min)
- `ads_deep` — lunes semanales, 250+ checks 7 plataformas (20-40K tokens, 10-20 min)
- `on_demand` — ALEX manual con `--platform` + opcional `--data`

## Levels de input

| Nivel | Input | Análisis disponible |
|---|---|---|
| 1 | Solo website URL | Landing page CRO + competitive intel pública |
| 2 | URL + métricas pegadas ("spend $X CPL $Y") | + budget/trend analysis |
| 3 | URL + CSV exports completos | + campaign/ad-set/creative granular |

Nivel 1 funciona para Pinnacle hasta que arranquen paid campaigns. Nivel 2-3 cuando Jorge empiece a invertir en Meta/Google Ads.

## Local testing (dry-run)

```bash
node agents/cazador/cazador.mjs --tenant pinnacle --mode ads_health --dry-run
node agents/cazador/cazador.mjs --tenant pinnacle --mode ads_deep --dry-run
node agents/cazador/cazador.mjs --tenant pinnacle --mode on_demand --platform meta --data "spend $320 conv 8 CPL $40 CTR 1.8%" --dry-run
```

## Real run

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
node agents/cazador/cazador.mjs --tenant pinnacle --mode ads_health
```

Requiere claude CLI autenticado + clean environment (no nested session).

## Cron (pending Jorge approval)

```cron
0 14 */3 * * cd /path/to/alex-real-estate-system && node agents/cazador/cazador.mjs --tenant pinnacle --mode ads_health
0 15 * * 1   cd /path/to/alex-real-estate-system && node agents/cazador/cazador.mjs --tenant pinnacle --mode ads_deep
```

## Alertas Telegram (automáticas)

- ✅ score ≥70 + CPL estable → brief OK
- ⚠️ score 50-70 OR drift 10-20% → top 3 issues
- 🚨 score <50 OR CPL drift >20% OR tracking broken → urgent con "pause recommended"
- 🚨 **Budget waste sentinel:** spend_7d > $100 + conversions_7d == 0 → alerta inmediata

## R9 compliance

- ✅ Always-on (cron)
- ✅ Dedicated domain (paid ads)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (Meta + TikTok + landing mobile weighted)
- ✅ Billing-ready (tokens_used per run, platform metrics tracked)
- ✅ Audit trail (Ad_Performance table logs todo)
- ⚠ Deployment pending (cron host + claude login)

## Author log

- 2026-04-23: v1 shipped. **5to sub-agente del plantel R9 core**. Completa: Mercader + Posicionador + Escriba + Remitente + Cazador. Sub-agentes especializados: Cartógrafo (GMB, OAuth paused). Existente: Fer (SMS outbound + review requests).

**Plantel R9 completo al cierre día 2026-04-23.**
