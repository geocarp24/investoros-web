# El Supervisor — Autonomous Ops Watchdog

R9 plantel **meta-agente**. Monitorea a todos los demás agentes + infraestructura + pipelines + data quality. Auto-repara lo trivial. Alerta a Jorge via Telegram solo cuando necesita decisión humana. En `evolve` mode aprende de patrones y propone fixes permanentes.

Objetivo directo de Jorge (2026-04-23): *"sistema autonomista e inteligente que sepa evolucionar por sí mismo sin que yo tenga que estar detrás de ello"*.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Spec completa con filosofía, 5 layers de checks, auto-repair, alert tiers |
| `supervisor.mjs` | Orchestrator |
| `runs/` | MD por run (summary + todas las métricas) |

Tablas Airtable: `Ops_Health` `[REDACTED_AIRTABLE_TABLE_ID]` + `Ops_Insights` `[REDACTED_AIRTABLE_TABLE_ID]` en base `[REDACTED_AIRTABLE_BASE_ID]`.

## Modos

| Mode | Cadencia | Qué hace | Tokens |
|---|---|---|---|
| `heartbeat` | cada 15 min | probe endpoints, Airtable, Telegram, OpenPhone · log freshness · pipeline counters | 1-3K (sin Claude) |
| `deep` | cada 1 h | + ghost detection + auto-repair + drift metrics | 5-12K |
| `evolve` | weekly Sat 07:00 CT | 7-day pattern recognition vía Claude · Ops_Insights writes · Telegram digest | 15-30K |
| `incident` | on-demand / auto-trigger desde heartbeat red | forensic deep-dive con Claude | 5-15K |

## Qué chequea (5 layers)

1. **Infra**: 4 cron endpoints Hostinger respondiendo HEAD + Airtable/OpenPhone/Telegram/Anthropic keys funcionando + DNS (DKIM/DMARC/SPF) en evolve
2. **R9 agents**: cadence adherence, score trajectories, token spikes
3. **Pipeline**: ghost contacts, bottlenecks (New>100 stuck), Hot leads no contactados <1h, Fer inbound coverage
4. **Data quality**: duplicates, Airtable 422 errors, email bounce rate
5. **Business metrics**: SMS volume baseline, conversion rate, score divergences

## Auto-repairs (no humano necesario)

- Ghost reset: contactos stuck ≥2d → "To Be Contacted" + steps/fechas limpios (max 25/run)
- Cron re-trigger: endpoint stale >4h en ventana → POST manual (max 1 por endpoint/hora)
- Rate limit backoff: OpenPhone 429 → exponential backoff
- Schema drift log: Airtable 422 → log + skip, NO loop

## Alert tiers (Telegram)

| Severity | Cuando | Formato |
|---|---|---|
| 🚨 CRITICAL | API key revoked, cron dead >6h, revenue-lost hot lead, security event | instant |
| ⚠️ WARN | single agent failed, token spike, score drop | hourly digest |
| 🟡 NOTICE | auto-repairs aplicados, drift menor | daily 8am CT digest |
| ✅ GREEN | todo OK | silent log only |

## Dry-run

```bash
node agents/supervisor/supervisor.mjs --tenant pinnacle --mode heartbeat --dry-run
node agents/supervisor/supervisor.mjs --tenant pinnacle --mode deep --dry-run
node agents/supervisor/supervisor.mjs --tenant pinnacle --mode evolve --dry-run
```

## Real run

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
export QUO_API_KEY=...
node agents/supervisor/supervisor.mjs --tenant pinnacle --mode heartbeat
```

## Cron (Hostinger cPanel — pending Jorge)

```cron
*/15 * * * * cd /path/to && node agents/supervisor/supervisor.mjs --tenant pinnacle --mode heartbeat
0 * * * *    cd /path/to && node agents/supervisor/supervisor.mjs --tenant pinnacle --mode deep
0 7 * * 6    cd /path/to && node agents/supervisor/supervisor.mjs --tenant pinnacle --mode evolve
```

NOTA: el Supervisor corre en el cron host que ejecute Node (VPS o local). El resto de crons Hostinger PHP son monitoreados por el Supervisor pero no se ejecutan en el mismo host.

## Evolve mode — el corazón del sistema auto-evolutivo

Cada sábado 7am CT:
1. Lee 7 días de Ops_Health (168+ heartbeats + deep runs)
2. Cuenta top 10 errores + top 5 warnings recurrentes
3. Claude genera hipótesis de causa raíz + fix concreto (file path + diff) + impacto
4. Fix trivial + seguro → **auto-aplica** + log a Ops_Insights con status=auto-applied
5. Fix complejo → Ops_Insights status=open + Telegram digest al Jefe
6. Reporte semanal MD → PDF → Telegram Jorge (domingo 8am opcional)

## R9 compliance

- ✅ Always-on (heartbeat 15 min — más frecuente de todo el plantel)
- ✅ Dedicated domain (meta-ops)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first alerts
- ✅ Billing-ready (tokens por mode)
- ✅ Audit trail (cada check, cada auto-fix, cada alerta → Ops_Health)
- ✅ Self-improving (evolve mode writes fixes, some auto-apply)

## Author log

- 2026-04-23: v1 shipped. 10mo agente del plantel R9. Crítico para visión "sistema autónomo" de Jorge. Uses shared runner.
