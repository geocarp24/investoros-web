# El Embajador — LinkedIn B2B Outreach Agent

**Status:** Skeleton (2026-05-15) — agents code generates DRAFT actions only; activation requires explicit `--activate` flag + human review of each batch.

## Purpose

Generate value-add LinkedIn outreach drafts for B2B aliados in the tenant's market. Geo Carpentry: real estate investors, property managers, architects, interior designers across Northeast Wisconsin. Pinnacle (cross-pollination): wholesalers + flippers who need contractors for rehabs.

**Critical:** LinkedIn aggressively bans automation. Embajador is **semi-automated** — it prepares queues, the human (Jefe) ships the action manually with 1-click. We never automate connection requests, messages, or profile views.

## What Embajador does

1. **ICP search prep** — given a tenant config (industry, market, ICP roles), generates LinkedIn search URLs the human can paste + execute manually. Output: ranked target list with personalization hooks.
2. **Connection request draft** — for each prospect, drafts a personalized connection note (max 200 chars, value-first, no pitch). Output stored in Airtable `LinkedIn_Outreach` table with status=`Draft`.
3. **Nurture drip planning** — sequences:
   - Day 0: connection request (drafted)
   - Day 3: like/comment 1 post of theirs (target post URL captured)
   - Day 7: value comment on relevant post (draft comment text)
   - Day 14: DM with case study (draft message + recommended attachment)
   - Day 30: meeting offer (drafted)
   Stored as separate records, status=`Pending Action`.
4. **Track engagement** — when Jefe reports back ("they connected" / "they replied"), update status; agent generates next-step draft.

## What Embajador does NOT do

- ❌ Auto-send connection requests or DMs (LinkedIn ToS violation + ban risk)
- ❌ Scrape profiles at scale (LinkedIn legal action territory)
- ❌ Use unofficial LinkedIn APIs (Sales Navigator scrapers, etc.)
- ❌ Generate drafts that mention pricing, push-sell, or feel templated

## Tech architecture

- Same pattern as Posicionador / Escriba: `embajador.mjs` shells to `claude --print` for draft generation
- Reads tenant config `agents/tenants/<slug>.json` — block `embajador`
- Writes to Airtable `LinkedIn_Outreach` table
- Optional: Telegram alert when batch ready for human review

## Required tenant config block

```json
"embajador": {
  "enabled": false,
  "icp_search_queries": [
    "real estate investor OR property manager Green Bay Wisconsin",
    "interior designer OR architect Northeast Wisconsin",
    "house flipper Brown County WI"
  ],
  "weekly_target_connects": 10,
  "weekly_target_engagements": 20,
  "personalization_signals": [
    "shared school or city",
    "mutual connection",
    "recent post engagement",
    "specific project they posted"
  ],
  "tone": "warm-professional, value-first, never salesy, bilingual EN/ES on request",
  "value_props": [
    "I run a remodel/construction shop in Northeast WI — happy to be a contractor resource for your investor network.",
    "Bilingual team (EN/ES) — useful for diverse markets.",
    "12+ years in Northeast WI — know local code, permits, suppliers."
  ]
}
```

## Required Airtable table

**`LinkedIn_Outreach`** (in tenant's base):

| Field | Type | Notes |
|---|---|---|
| run_id | singleLineText | UUID per generated batch |
| tenant_id | singleLineText | |
| status | singleSelect | Draft / Pending Action / Connected / Engaged / Replied / Booked / Ghosted / Lost |
| action_type | singleSelect | connect / like / comment / dm / meeting_offer |
| target_name | singleLineText | |
| target_role | singleLineText | |
| target_company | singleLineText | |
| target_city | singleLineText | |
| target_linkedin_url | url | |
| draft_text | multilineText | the actual text to paste |
| personalization_hook | multilineText | why they were targeted |
| recommended_attachment | url | case study link if any |
| sequence_step | number | 0-4 (connection → meeting) |
| sequence_parent_id | singleLineText | links nurture sequence steps |
| created_at | dateTime | |
| action_taken_at | dateTime | when Jefe actually clicked send |
| outcome | singleLineText | free-form |
| notes | multilineText | |

## CLI

```bash
node agents/embajador/embajador.mjs --tenant geo-carpentry --mode prepare_batch --dry-run
node agents/embajador/embajador.mjs --tenant geo-carpentry --mode prepare_batch     # writes drafts to Airtable
node agents/embajador/embajador.mjs --tenant geo-carpentry --mode followup --record-id rec123    # generate next-step draft
```

Modes:
- `prepare_batch` — generate 10 new connection drafts
- `followup` — given a connected prospect, generate next-step draft (Day 3 / 7 / 14 / 30)
- `audit_pipeline` — review current pipeline, recommend who needs attention

## NEVER

- Never call LinkedIn API directly (no LinkedIn API access on free tier; paid Sales Navigator API requires partner agreement).
- Never browse LinkedIn programmatically via Puppeteer/Playwright (high ban risk).
- Never send messages on Jefe's behalf — drafts ONLY.

## When to activate

Activate only when:
1. Geo Carpentry has 5+ Google reviews + portfolio with real photos (otherwise prospects look you up and you have no proof)
2. Jefe has at least 200 LinkedIn connections + 30-day posting cadence (otherwise looks like a spam account)
3. We've validated 1 manual outreach cycle (Jefe sends 3 messages, gets 1 reply) — proves the messaging works
