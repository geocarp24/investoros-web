# El Mercader — Marketing Operations Sub-Agent

Always-on marketing monitoring for multi-tenant real-estate SaaS. Tenant zero: Pinnacle Holdings (`pinnaclegroupwi.com`).

Part of plantel R9: **El Oráculo** (predictor) + **El Mercader** (marketing ops) + **El Posicionador** (SEO) + **El Cazador** (Ads).

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Anthropic-format skill spec (frontmatter + workflow). Lives under `~/.claude/skills/mercader/` when registered globally |
| `mercader.mjs` | Node orchestrator. Reads tenant YAML → spawns `claude` CLI → parses output → Airtable + Telegram |
| `runs/` | Auto-created. Stores raw MD output per run (retention per tenant config) |
| `../tenants/pinnacle.json` | Tenant zero config |
| `../tenants/_template.yaml` | Template for new tenants |

## Modes

### `quick_health` (every 3 days, per R9)
Lightweight `/market quick` — detects critical changes. <3K tokens, 1-2 min.

### `deep_audit` (weekly Mondays, per R9)
Full `/market audit` + `/market competitors` + optional `/market report-pdf`. 20-40K tokens, 5-15 min. Client-ready PDF.

### `on_demand`
Triggered by ALEX on Jorge's request.

## Local testing (dry-run — no subprocess, no Airtable, no Telegram)

```bash
node agents/mercader/mercader.mjs --tenant pinnacle --mode quick_health --dry-run
node agents/mercader/mercader.mjs --tenant pinnacle --mode deep_audit --dry-run
```

Prints the exact prompt that would be sent to `claude`. Use this to verify the prompt is right before spending tokens.

## Real run (spawns claude CLI — costs tokens)

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
node agents/mercader/mercader.mjs --tenant pinnacle --mode quick_health
```

Requires:
1. `claude` CLI authenticated (`claude login`)
2. The 3 env vars above
3. `airtable.table_id` set in `agents/tenants/pinnacle.yaml` (create the Marketing_Audits table first — see schema in `SKILL.md`)

## Known limitation: nested Claude CLI

If you run this FROM INSIDE a Claude Code session, the `claude` subprocess may fail silently (auth / stdin-pipe conflict). Run from a **clean terminal** or **VPS cron**.

**Verified working environments:**
- Standalone terminal (local laptop with `claude` authed)
- VPS cron job (requires `claude login` on the VPS first)

**NOT working:**
- Nested inside ALEX Claude Code session (same issue El Oráculo hit with MiroFish)

## Deployment — Hostinger cron (recommended)

Once the Marketing_Audits Airtable table exists + table_id is in pinnacle.yaml + claude CLI is authed on the target host:

```cron
# Every 3 days at 08:00 CST (14:00 UTC) — quick health check
0 14 */3 * * cd /path/to/alex-real-estate-system && node agents/mercader/mercader.mjs --tenant pinnacle --mode quick_health >> /var/log/mercader.log 2>&1

# Every Monday at 09:00 CST (15:00 UTC) — deep audit
0 15 * * 1 cd /path/to/alex-real-estate-system && node agents/mercader/mercader.mjs --tenant pinnacle --mode deep_audit >> /var/log/mercader.log 2>&1
```

## Adding a new tenant

1. Copy `agents/tenants/_template.yaml` to `agents/tenants/<slug>.yaml`
2. Fill in `tenant_id`, `website`, `brand`, `competitors`, `airtable.base_id`, `airtable.table_id`
3. Test: `node agents/mercader/mercader.mjs --tenant <slug> --mode quick_health --dry-run`
4. If prompt looks right: real run. If not: tweak YAML.
5. Add cron entries on host.

No code changes required — all new-tenant onboarding is YAML (R8 SaaS-ready).

## R9 compliance

- ✅ Always-on (cron-driven)
- ✅ Dedicated to one domain (marketing ops)
- ✅ Writes audit history to Airtable (billing + SaaS reporting)
- ✅ Alerts Telegram on thresholds
- ✅ Tenant-aware (R8)
- ✅ On-demand invokable by ALEX
- ⚠ Deployment pending (VPS or Hostinger cron)

## Pending before production

1. **Jorge approval:** create Airtable `Marketing_Audits` table (schema in SKILL.md), paste `table_id` into `pinnacle.yaml`
2. **Host decision:** Hostinger PHP cron wrapper OR VPS service
3. **Claude CLI auth** on that host
4. **Smoke test** `--dry-run` first, then real `quick_health`, then `deep_audit`

## Author log

- 2026-04-23: v1 draft by ALEX as first of R9 sub-agents.
