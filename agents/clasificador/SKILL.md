---
name: el-clasificador
description: Always-on lead scoring sub-agent for the R9 plantel. Scores every inbound lead 0–100 (urgency + distress + property + timeline + motivation), classifies heat (Hot/Warm/Cold/Disqualify), proposes owner + action, and writes to Airtable Lead_Scores. Feeds Fer prioritization so hot leads get called first.
version: 1.0
owner: ALEX
tenant: any (config in agents/tenants/<slug>.json)
cadence: every 2h quick scan OR on_demand per-lead
runtime: node >= 22 + claude CLI
---

# El Clasificador — Lead Scoring Sub-Agent

## Propósito
Ranks inbound leads to tell Fer / Jorge WHO TO CALL FIRST. Real estate investment is a speed-to-lead game: a pre-foreclosure homeowner 7 days from sheriff sale gets different urgency than a wholesaler fishing for comps.

## Modes

| Mode | Frequency | Scope | Tokens |
|---|---|---|---|
| `score_batch` | every 2h cron | ALL leads with `scored_at` null OR stale (>72h) | 5–15K |
| `score_one` | on_demand / webhook from popup | single lead by `--lead-id` | 800–2K |
| `rescore_hot` | nightly | reassess all currently-Hot leads (urgency decay check) | 3–8K |

## Inputs
- Lead record: full fields from `Leads` table (Airtable)
- Optional: Contact linked record (property details)
- Optional: Notes & Activity history (if any)
- Tenant config: markets, state rules (WI wholesaler law relevant)

## Scoring axes (0-100 each, weighted composite)
1. **urgency_score** — time pressure: foreclosure auction date, eviction, divorce filing, job relocation deadline, tax sale
2. **distress_score** — financial/life distress severity: bankruptcy, code violations, liens, condemned property, medical bills, estate/probate
3. **property_score** — asset attractiveness: ARV potential minus rehab cost, location tier (Milwaukee MSA premium, rural discount), zoning
4. **timeline_score** — how fast they NEED to close (7 days vs 90+ days)
5. **motivation_score** — psychological readiness: already talking to competitors / already moved out / emotional detachment / cash-in-hand urgency

Weights (default, tenant-overridable):
- urgency 0.30 · distress 0.25 · property 0.20 · timeline 0.15 · motivation 0.10

## Heat classification
- `🔥 Hot`     → overall >= 75 (call within 15 min)
- `🌡 Warm`    → 55–74 (call within 24h, nurture SMS)
- `❄️ Cold`    → 30–54 (nurture weekly, email drip)
- `🚫 Disqualify` → < 30 (bot test, wrong market, tire kicker, litigation)

## Suggested actions
- `call_now` (Hot + urgency > 80)
- `sms_urgent` (Hot + timeline < 30 days)
- `follow_up_48h` (Warm)
- `nurture_weekly` (Cold + still interested)
- `disqualify` (bots, competitors, wrong market, < 30 overall)

## Owner routing
- `fer` (Pinnacle SMS/review agent — handles sms_urgent + follow_up_48h)
- `human_rep` (Jorge — call_now Hot leads)
- `drop` (disqualify)

## Output (Airtable Lead_Scores row)
All fields in `Lead_Scores` table per `agents/_setup/create_sprint2_tables.py`.

## WI-specific intelligence
- Pre-foreclosure → Sheriff sale date is public record. Pull from Wisconsin CCAP if available.
- Probate → Register in Probate filings (public). High motivation + long timeline (6-12 months).
- Divorce → Family Court filings (public, $). Moderate urgency.
- Wholesale disclosure law (WI 2024): wholesalers must disclose + have contract. Factor into distress scoring if lead is wholesaler-generated.

## Alerts (Telegram)
- 🔥 New Hot lead → "LEAD HOT: [name] score N/100 — call within 15 min"
- ⚠️ Score delta > 20 vs prior → "Lead [name] heated up/cooled down"
- Daily rollup at 8am CT → "Last 24h: X Hot, Y Warm, Z new"

## R9 compliance
- ✅ Always-on (cron every 2h)
- ✅ Dedicated domain (lead scoring)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (popup form feeds lead → scored within 2h max)
- ✅ Billing-ready (tokens_used tracked)
- ✅ Audit trail (Lead_Scores.score_delta + summary_md)

## Author log
- 2026-04-23: v1 shipped. Uses agents/_shared/runner.mjs helpers.
