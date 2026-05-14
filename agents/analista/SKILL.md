---
name: el-analista
description: Always-on weekly executive dashboard sub-agent for the R9 plantel. Unifies outputs from Mercader + Posicionador + Escriba + Remitente + Cazador + Clasificador + Espía + Auditor plus CRM pipeline and revenue into a 3-paragraph executive brief Jorge reads Monday 7am CT.
version: 1.0
owner: ALEX
tenant: any (config in agents/tenants/<slug>.json)
cadence: weekly Monday 07:00 CT
runtime: node >= 22 + claude CLI
---

# El Analista — Weekly Executive Dashboard Sub-Agent

## Propósito
Jorge no tiene tiempo de leer 8 reports cada lunes. El Analista los digiere todos + el CRM pipeline + revenue y produce UN solo brief:
- 3 wins, 3 concerns, 3 action items
- Pipeline metrics (leads, deals closed, revenue, velocity)
- Marketing rollup (SEO, ads, email, content, GBP)
- Competitor movements (from Espía)
- Compliance flags (from Auditor)

## Modes

| Mode | Frequency | Scope | Tokens |
|---|---|---|---|
| `weekly` | every Monday 07:00 CT | full dashboard, ISO week N | 10-20K |
| `ad_hoc`  | on_demand `--week 2026-W17` | regenerate specific week | 10-20K |
| `preview` | any time | dry-run the prompt with current data | 0 |

## Inputs aggregated
- `Marketing_Audits` latest Mercader score
- `SEO_Audits` latest Posicionador
- `Ad_Performance` latest Cazador
- `Content_Queue` drafts published this week (Escriba)
- `Email_Campaigns` + `Email_Events` opens/clicks this week (Remitente)
- `Competitor_Intel` top change events this week (Espía)
- `Compliance_Audits` latest (Auditor)
- `Lead_Scores` hot/warm counts this week (Clasificador)
- `Leads` new this week, by source
- `Deals` closed/lost this week + $ revenue
- `Contacts` new vs existing

## Output (Airtable Weekly_Dashboards row)
Full field list in `agents/_setup/create_sprint2_tables.py`.

Headline fields surfaced in Telegram:
- `executive_summary_md` (3 short paragraphs)
- `headline_wins` (top 3 bullets)
- `headline_concerns` (top 3 bullets)
- `action_items` (top 3 priorities for next week)
- `revenue_this_week`
- `pipeline_velocity_days`

## R9 compliance
- ✅ Always-on (weekly cron)
- ✅ Dedicated domain (exec reporting / analyst)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (brief designed to read on phone Monday morning)
- ✅ Billing-ready (tokens_used per run + source costs rollup optional)
- ✅ Audit trail (Weekly_Dashboards row + optional PDF)

## Author log
- 2026-04-23: v1 shipped. Uses _shared/runner.mjs.
