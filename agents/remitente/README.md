# El Remitente — Email Agent (Airtable-Native)

**100% in-house. Zero external email services.** Hostinger SMTP + Airtable = todo el stack.

Parte del plantel R9. Maneja subscribers, campaigns, templates, events, welcome flow, drip sequences, weekly reports.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Anthropic skill spec + 6 modes + deliverability hardening + security rules |
| `remitente.mjs` | Node orchestrator (ejecutable, multi-mode) |
| `../../hostinger/agents/pinnacle_mail.php` | Hostinger endpoint — send + track_open + track_click + unsubscribe |
| `../_setup/create_email_tables.py` | Idempotent script that provisioned the 4 Airtable tables |
| `runs/` | Per-run output logs |

## Las 4 tablas Airtable (ya creadas)

| Table | ID | Records typical |
|---|---|---|
| `Email_Subscribers` | `[REDACTED_AIRTABLE_TABLE_ID]` | 1 row por email (status: Active/Unsubscribed/Bounced/Complained) |
| `Email_Templates` | `[REDACTED_AIRTABLE_TABLE_ID]` | Reusable templates con {{placeholders}} |
| `Email_Campaigns` | `[REDACTED_AIRTABLE_TABLE_ID]` | Broadcasts (Draft→Scheduled→Sending→Sent) |
| `Email_Events` | `[REDACTED_AIRTABLE_TABLE_ID]` | Per-recipient event log (sent/opened/clicked/bounced/...) |

## Modos

| Mode | Cron frequency | Purpose |
|---|---|---|
| `seed_templates` | one-off | Sembrar 4 templates base (welcome_en/es, nurture_market_update_en/es) |
| `draft_campaign` | on-demand | Redacta draft usando El Escriba's Content_Queue + topic + audience filter |
| `schedule_send` | on-demand | Cambia campaign status=Scheduled con scheduled_at |
| `process_welcome` | daily 14:00 UTC | Busca Active subscribers nuevos → les manda welcome_<lang> |
| `process_drip` | daily 14:30 UTC | Tick diario de sequences activas (v2 — stub por ahora) |
| `weekly_report` | Lunes 15:00 UTC | Open/click/unsub stats 7d → Telegram |
| `on_demand` | ALEX manual | Alias de draft_campaign |

## Local testing (dry-run)

```bash
node agents/remitente/remitente.mjs --tenant pinnacle --mode draft_campaign --topic "..." --dry-run
```

## Real run

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
node agents/remitente/remitente.mjs --tenant pinnacle --mode seed_templates   # primera vez
node agents/remitente/remitente.mjs --tenant pinnacle --mode draft_campaign --topic "Wisconsin foreclosure update — October 2026" --audience "AND({status}='Active',FIND('foreclosure',{tags}))"
node agents/remitente/remitente.mjs --tenant pinnacle --mode weekly_report
```

## Cron (a agregar en Hostinger cuando Jorge apruebe)

```cron
# Cada 5 min — send 1 scheduled campaign (si hay alguno)
*/5 * * * * curl -sS -X POST -H "X-Alex-Secret: $ALEX_SECRET" "https://pinnaclegroupwi.com/agents/pinnacle_mail.php?action=send_campaign" > /dev/null 2>&1

# Daily 14:00 UTC — welcome flow para nuevos subscribers
0 14 * * * cd /path/to/alex-real-estate-system && node agents/remitente/remitente.mjs --tenant pinnacle --mode process_welcome

# Daily 14:30 UTC — drip sequence tick (v2)
30 14 * * * cd /path/to/alex-real-estate-system && node agents/remitente/remitente.mjs --tenant pinnacle --mode process_drip

# Lunes 15:00 UTC — weekly report
0 15 * * 1 cd /path/to/alex-real-estate-system && node agents/remitente/remitente.mjs --tenant pinnacle --mode weekly_report
```

## Lo que YA está desplegado

- ✅ 4 tablas Airtable creadas + cableadas en `pinnacle.json`
- ✅ `hostinger/agents/pinnacle_mail.php` escrito + syntax OK + listo para deploy via workflow
- ✅ `remitente.mjs` con 3 modos ready + dry-run verified
- ✅ Templates base EN+ES en el código del orchestrator

## Lo que FALTA para ir a producción

### 1. Deploy del `pinnacle_mail.php`

Va a ir automático cuando pushes a master (workflow `deploy-hostinger.yml` ya deploya `hostinger/agents/*`). En la próxima sincronización.

### 2. Deliverability (Jorge verifica desde Hostinger cPanel + DNS)

- [ ] **SPF** — verificar TXT `pinnaclegroupwi.com` incluye `include:_spf.hostinger.com`
- [ ] **DKIM** — cPanel → Email Deliverability → activar para `pinnaclegroupwi.com`
- [ ] **DMARC** — agregar TXT en `_dmarc.pinnaclegroupwi.com`:
  ```
  v=DMARC1; p=none; rua=mailto:deals@pinnaclegroupwi.com
  ```

Sin DKIM, los emails caen en spam de Gmail/Yahoo. Es crítico.

### 3. Popup integration (one edit a pinnacle_public.php)

El popup actualmente guarda en Airtable Contacts. Le agrego un mirror write a Email_Subscribers con status=Active + source=popup. Cuando me des luz verde, una surgical edit + deploy via workflow.

### 4. Seed templates

```bash
node agents/remitente/remitente.mjs --tenant pinnacle --mode seed_templates
```
Corre una vez — crea los 4 templates base en Airtable. Jorge los puede editar después desde Airtable UI.

### 5. Agregar cron entries al `deploy-hostinger.yml` workflow

Mismo patrón que `fer_seguimiento` / `fer_morning_brief`. Surgical edit al YAML cuando Jorge apruebe la sección cron.

## Pipeline end-to-end esperado

```
1. Popup capta subscriber → Airtable Email_Subscribers status=Active
2. Daily cron process_welcome → detecta new Active sin last_email_sent_at → crea Campaign eph. status=Scheduled → PHP cron (5min) la envía
3. Subscriber recibe welcome email + link al sitio + unsubscribe link
4. Jorge semanalmente: "corré draft_campaign sobre Foreclosure October" → ALEX invoca → draft en Email_Campaigns status=Draft
5. Jorge revisa draft en Airtable → cambia status=Scheduled + scheduled_at → PHP cron envía
6. Subscribers abren → pixel → event logged
7. Subscribers clickean → redirect → event logged
8. Lunes: weekly_report → Telegram con open rate %
9. Si alguien unsubscribe → PHP marca subscriber status=Unsubscribed + nunca más le llega nada
```

## Security recap

- `send_campaign` privilegiado (X-Alex-Secret header obligatorio)
- Unsubscribe tokens HMAC-SHA256 no-falsificables
- IP hasheada (SHA256), nunca plain
- No arbitrary HTML injection — templates son curados (Airtable) o generados por Claude con prompts restrictivos
- Nunca envía a subscriber con status != Active
- Rate limit hard-coded en PHP (max 500/hora via loop cap)

## R9 compliance

- ✅ Always-on (cron)
- ✅ Dedicated domain (email marketing)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (all templates 600px max, 2-4 lines paragraphs)
- ✅ Billing-ready (tokens_used + sent_count per campaign)
- ✅ Audit trail (Email_Events log everything)
- ⚠ Deployment pending (steps 1-5 above)

## Author log

- 2026-04-23: v1 shipped. 4to sub-agente del plantel R9. Cuarto patrón consistente (después de Mercader/Posicionador/Escriba) → consolida el ROI de extraer a `_shared/runner.mjs` en la próxima iteración.
