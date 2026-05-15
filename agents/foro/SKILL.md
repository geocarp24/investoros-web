# El Foro — Reddit Community Engagement Agent

**Status:** Skeleton (2026-05-15) — agent generates DRAFT replies + monitoring queue only; never auto-posts. Jefe reviews each draft before submitting via Reddit web UI.

## Purpose

Identify Reddit threads where Geo Carpentry can provide genuine value (kitchen remodel cost questions, deck permits, contractor recommendations) in target subreddits. Generate value-add reply drafts. Track engagement → identify high-intent prospects → move them to Airtable Leads.

## Strategy

Reddit's culture is **anti-promotion**. Heavy-handed self-promotion gets shadowbanned. The approach:

- **10:1 ratio** — 10 helpful, no-self-mention answers for every 1 reply that mentions Geo Carpentry
- **Build karma first** — Jefe needs 100+ karma in target subs before any post mentions the business
- **Long-form helpful** — replies are 2-4 paragraphs with specifics, not 1-line plugs
- **City + region context** — Reddit voice search is huge for "X near me" queries; Geo intel matters
- **Disclosure when relevant** — "Disclosure: I run a small carpentry shop in NE Wisconsin" only when directly asked

## Target subreddits

- r/HomeImprovement (1.5M members, US-wide, high traffic)
- r/Wisconsin (500K, geo-relevant)
- r/GreenBay (50K, ultra-local)
- r/RealEstate (1M, B2C homeowners researching pre/post-purchase remodel)
- r/HomeOwners (200K, broad)
- r/Carpentry (smaller, more pro-pro than B2C — useful for industry presence)
- r/DIY (5M, occasional cross-pollination on "should I DIY or hire")

## What Foro does

1. **Monitor pull** — using Reddit's public JSON API (no auth required for reading), fetches new threads from target subs matching intent keywords (`kitchen remodel cost`, `deck permit`, `contractor recommendations`, geo terms like `Green Bay` / `Wisconsin` / `Brown County`)
2. **Score by intent** — ranks threads by: recency × subreddit weight × keyword match × thread engagement (upvotes / comment count). Top 10 drafted per run.
3. **Draft reply** — for each high-intent thread, generates a value-add reply in the tenant's tone, 2-4 paragraphs, with specific helpful info (cost ranges, permit links, decision frameworks). Draft stored in Airtable `Reddit_Threads` table, status=`Draft`.
4. **Original content suggestions** — 1x/sem, suggest a "value-bomb" thread for Jefe to post in r/Wisconsin or r/GreenBay (e.g., "10 things we learned doing 50 kitchens in Brown County — AMA"). Drafts the post + opening AMA replies.
5. **Track engagement** — once Jefe posts, agent monitors thread for replies and DMs; if user shows lead intent ("dm me your number" / "can you quote my kitchen"), create Airtable Lead with Source=Reddit.

## What Foro does NOT do

- ❌ Auto-post any reply or thread (Reddit will detect + shadowban)
- ❌ Vote, downvote, or mass-comment
- ❌ Create multiple accounts ("sock puppets" = permaban)
- ❌ Cross-post identical content to multiple subs ("spam" flag)
- ❌ DM users uninvited
- ❌ Use marketing-y language in any reply

## Tech architecture

- Same pattern as other R9 agents: `foro.mjs` shells to `claude --print` for draft generation
- Reads tenant config block `foro`
- Fetches Reddit data via `https://www.reddit.com/r/<sub>/new.json` (public, no auth required, rate-limited 60 req/min — well within our needs)
- Writes drafts to Airtable `Reddit_Threads` table
- Telegram alert when batch of drafts ready

## Required tenant config block

```json
"foro": {
  "enabled": false,
  "subreddits": [
    {"name": "HomeImprovement", "weight": 1.0},
    {"name": "Wisconsin", "weight": 1.5},
    {"name": "GreenBay", "weight": 2.0},
    {"name": "RealEstate", "weight": 0.8},
    {"name": "HomeOwners", "weight": 0.9}
  ],
  "intent_keywords": [
    "kitchen remodel cost", "deck permit", "contractor recommendations",
    "bathroom renovation", "home addition", "carpenter near me",
    "framing cost", "trim installation", "finish carpentry"
  ],
  "geo_modifiers": [
    "wisconsin", "green bay", "brown county", "ne wisconsin", "northeast wi",
    "appleton", "oshkosh", "howard wi", "de pere", "sheboygan"
  ],
  "weekly_target_drafts": 10,
  "monthly_original_post_drafts": 1,
  "tone": "warm, helpful neighbor, specific & detailed, no fluff, no marketing language",
  "ratio_helpful_to_self_mention": 10,
  "karma_threshold_for_self_mention": 100
}
```

## Required Airtable table

**`Reddit_Threads`** (in tenant's base):

| Field | Type | Notes |
|---|---|---|
| run_id | singleLineText | UUID per batch |
| tenant_id | singleLineText | |
| status | singleSelect | Draft / Posted / Replied / Engaged / Lead / Shadowbanned / Skipped |
| action_type | singleSelect | reply / original_post / dm / monitor_only |
| subreddit | singleLineText | |
| thread_url | url | |
| thread_title | singleLineText | |
| thread_body_excerpt | multilineText | first 300 chars of OP |
| thread_age_hours | number | for staleness check |
| upvotes | number | snapshot at draft time |
| comments_count | number | snapshot at draft time |
| intent_score | number | computed by Foro |
| draft_text | multilineText | the reply or original post text |
| mentions_geo | checkbox | true if this draft references the tenant |
| posted_at | dateTime | when Jefe submitted (manual) |
| post_url | url | Reddit comment/post link |
| engagement | multilineText | upvotes, replies received, DMs |
| lead_id | singleLineText | linked Airtable Lead if convo got to intent |
| notes | multilineText | |

## CLI

```bash
node agents/foro/foro.mjs --tenant geo-carpentry --mode monitor --dry-run   # prints what threads would be drafted
node agents/foro/foro.mjs --tenant geo-carpentry --mode monitor             # generates 10 drafts → Airtable
node agents/foro/foro.mjs --tenant geo-carpentry --mode original_post       # generates 1 OP idea
node agents/foro/foro.mjs --tenant geo-carpentry --mode followup --thread-id <rec>   # next reply after engagement
```

## Anti-shadowban defenses (built into Foro)

- **Karma check** — Foro reads Jefe's Reddit username's karma via API; refuses to generate `mentions_geo=true` drafts if karma < threshold
- **Sub-specific tone** — replies for r/Carpentry use different style than r/HomeImprovement
- **Throttle** — never drafts >10 replies per day, never >2 in same subreddit per day
- **Detection** — if reply gets 0 upvotes after 24 hr OR negative score, agent flags as `Shadowbanned` and skips that pattern next run

## When to activate

Activate only when:
1. Jefe has a Reddit account with 30+ days history and 50+ karma
2. Jefe commits to 10 min/day reviewing + posting drafts (the value of Foro is the volume × quality of drafts, not auto-posting)
3. We've manually validated one reply gets >5 upvotes (proves the tone is right)

## Original post ideas (seed bank — to be drafted in `original_post` mode)

- "10 things I learned doing 50 kitchens in Brown County — AMA" (r/Wisconsin or r/GreenBay)
- "Why Wisconsin winters destroy decks that aren't built right (and how to spot a bad install)" (r/HomeImprovement, geo flair)
- "Stock vs custom cabinets in 2026 — honest contractor breakdown" (r/HomeImprovement)
- "Permit process for home additions in Brown County — a real-world walkthrough" (r/Wisconsin)
- "Should you DIY your deck or hire a pro? A carpenter's honest take" (r/DIY, r/HomeImprovement crosspost)
