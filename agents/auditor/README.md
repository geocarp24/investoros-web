# El Auditor — Weekly Compliance Sweep Sub-Agent

R9 plantel member. Audits the stack against WI wholesaler law + TCPA + CAN-SPAM + Fair Housing + GDPR + ADA. Surfaces lawsuit exposure before lawsuits happen.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Spec + 3 modes + 6 regulations covered |
| `auditor.mjs` | Orchestrator (thin wrapper on `_shared/runner.mjs`) |
| `runs/` | MD per run |

Tabla Airtable: `Compliance_Audits` en base `[REDACTED_AIRTABLE_BASE_ID]` — ID `[REDACTED_AIRTABLE_TABLE_ID]` (en `pinnacle.json.airtable.compliance_audits_table_id`).

## Modos

- `weekly`    — cron viernes 10:00 CT, sweep completo (12-25K tokens, 5-10 min)
- `reg_focus` — `--reg tcpa|can_spam|fair_housing|gdpr|wi_wholesaler|ada_web` para deep-dive una sola regulación
- `incident`  — post-event, ejemplo: "tenemos demanda TCPA threatened"

## Regulaciones auditadas

| Regulación | $ Exposición típica |
|---|---|
| WI wholesaler law (Act 205 2024) | license revocation + civil suit |
| TCPA (SMS) | $500–$1,500 per text × class members |
| CAN-SPAM (email) | $51,744 per email (2024 FTC cap) |
| Fair Housing | $16k–$79k per violation + HUD complaint |
| GDPR | 4% global revenue or €20M |
| ADA web (WCAG 2.1 AA) | $16k median settlement per demand letter |

## Dry-run

```bash
node agents/auditor/auditor.mjs --tenant pinnacle --mode weekly --dry-run
node agents/auditor/auditor.mjs --tenant pinnacle --mode reg_focus --reg tcpa --dry-run
node agents/auditor/auditor.mjs --tenant pinnacle --mode incident --dry-run
```

## Real run

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
node agents/auditor/auditor.mjs --tenant pinnacle --mode weekly
```

## Cron

```cron
0 10 * * 5 cd /path/to/alex-real-estate-system && node agents/auditor/auditor.mjs --tenant pinnacle --mode weekly
```

## Alertas Telegram

- 🚨 overall < 50 OR any critical issue → "LAWSUIT RISK + top critical items"
- ⚠️ overall 50-69 → "gaps + warnings list"
- ✅ overall ≥70 → "compliant, silent digest"

## R9 compliance

- ✅ Always-on (weekly cron)
- ✅ Dedicated domain (compliance)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (audits both viewport sizes)
- ✅ Billing-ready (tokens_used + lawyer-cost-avoided estimate)
- ✅ Audit trail (evidence_snippets quoted verbatim)

## Author log

- 2026-04-23: v1 shipped. 9no agente del plantel R9 (gap agent #4, último del Sprint 2). Uses shared runner.
