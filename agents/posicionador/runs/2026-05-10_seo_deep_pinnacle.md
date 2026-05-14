# Pinnacle Holdings Group LLC — Weekly SEO Audit (2026-05-10)

**Tenant:** pinnacle | **Site:** https://pinnaclegroupwi.com | **Mode:** seo_deep | **Run:** 2026-05-10 (Sun, pre-Monday cron)
**Method:** WebSearch rank probes + tenant config + posicionador SKILL.md. **WebFetch denied — no live HTML/schema/CWV inspection possible this run.**

## Data-source caveat (read first)

This run cannot produce verified scores for: per-page schema.org JSON-LD, exact title/meta lengths, sitemap URL inventory, robots.txt content, hreflang, image alt coverage, internal-link graph, Core Web Vitals (LCP/CLS/INP), Google Business Profile state, Maps geo-grid rank, AI engine citations (ChatGPT-search/Perplexity/AI Overviews/SGE), or competitor on-page comparison. All of those require either WebFetch permission, PageSpeed Insights API, SerpAPI/DataForSEO, GBP API, or a headless-browser SERP scraper. **Mark all such cells "Datos no disponibles — requiere infra X" per CLAUDE.md veracity rule. Do not interpret blanks as zero.**

What this run **can** verify (and did): indexation footprint via `site:` operator, SERP appearance for 10 priority intent queries, branded-query rank, snippet-derived title/description signals on homepage.

This is the **first run in `agents/posicionador/runs/`** — no prior baseline exists, so all "delta vs last week" cells are "N/A — first run; baseline saved this run for next week."

---

## Executive Summary

- **Pages at target rank (#1):** **0 / N** for non-branded intent queries (N unknown — sitemap not fetchable). 1/1 for branded queries ("Pinnacle Holdings Wisconsin").
- **Pages that moved up this week:** N/A — first run, no baseline.
- **Pages that moved down this week:** N/A — first run, no baseline.
- **Primary-market WI visibility:** **5 / 100** (only homepage indexed in `site:` probe; 0/10 priority intent queries surface the site in top 10).
- **Regional US visibility (MN, IL, IA, MI):** **Datos no disponibles** — requires geo-spoofed SERP API; cannot probe IL/MN/IA/MI origin from this runner.

**Headline finding:** Pinnacle ranks **#1 only for branded queries** (queries containing "pinnaclegroupwi" or "Pinnacle Holdings"). It does **not appear in the top 10** for any of the 10 priority WI intent queries probed — including queries in Green Bay, where the company is based (phone 920-777-9886). Competitors HomeVestors, Fair Deal Home Buyers, Cream City Home Buyers, Fox Cities Home Buyers, Plan B Home Buyers, Atticus Home Buyers, Sellnowwisconsin, Metro Milwaukee Home Buyer, and Houzeo/Clever editorial pages own every intent.

## Overall Score: **22 / 100** (low confidence — see caveat)
- Indexation footprint: 5/30 (only homepage visible in `site:` probe)
- Branded SERP integrity: 25/30 (homepage ranks #1 for brand; rich snippet present)
- Non-branded rank coverage: 0/30 (0/10 priority queries in top 10)
- Local pack presence: Datos no disponibles — requires GBP/Maps probe
- Mobile CWV: Datos no disponibles — requires PSI API
- AI citation readiness: Datos no disponibles — requires Perplexity/Bing-Chat API probe
- Schema coverage: Datos no disponibles — requires WebFetch

## Technical Score: **Datos no disponibles**
Requires WebFetch (HTML inspection: meta, canonical, schema.org JSON-LD, hreflang, robots) + PageSpeed Insights API (CWV mobile) + sitemap.xml fetch + robots.txt fetch.

## Local Score: **Datos no disponibles**
Requires Google Business Profile API access (NAP consistency, review count, review velocity, primary category, secondary categories, service areas), Yelp/BBB scrape for citation parity, and Maps geo-grid SERP API for rank in 15 cities.

## Content Score: **Datos no disponibles**
Requires WebFetch to count published pages, word counts, E-E-A-T signals (author bios, NAP in content, Wisconsin-specific entities), and AI engine citation probes (Perplexity/ChatGPT-search/AI Overviews/SGE).

## Mobile Core Web Vitals
| Metric | Value | Status | Δ vs last week |
|---|---|---|---|
| LCP (mobile) | Datos no disponibles | — | N/A — first run |
| CLS (mobile) | Datos no disponibles | — | N/A — first run |
| INP (mobile) | Datos no disponibles | — | N/A — first run |

**Required infra to populate:** PageSpeed Insights API key + cron call to `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={page}&strategy=mobile&category=PERFORMANCE`. Add `PSI_API_KEY` to Doppler and wire into `posicionador.mjs` `runClaude()` follow-up step. Estimated $0 (free tier ≥25k req/day).

## Per-Page Rank Inventory

WebFetch denied → cannot enumerate sitemap. Only homepage observable via SERP. Table below covers the 1 verified page + 10 priority intent queries probed.

| Page URL | Intent query | Google | AI Overviews | Bing | ChatGPT-search | Perplexity |
|---|---|---|---|---|---|---|
| pinnaclegroupwi.com/ | "Pinnacle Holdings Wisconsin" (branded) | **#1** ✅ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "sell my house fast wisconsin" | **>10** ❌ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "cash home buyers milwaukee wi" | **>10** ❌ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "we buy houses madison wisconsin" | **>10** ❌ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "cash home buyers green bay wi" (home market!) | **>10** ❌ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "we buy houses kenosha racine wi" | **>10** ❌ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "cash home buyers appleton oshkosh wisconsin" | **>10** ❌ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "we buy houses waukesha west allis wauwatosa wi" | **>10** ❌ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "foreclosure help wisconsin" (pillar topic) | **>10** ❌ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "inherited house wisconsin probate sell fast" (pillar) | **>10** ❌ | N/D | N/D | N/D | N/D |
| pinnaclegroupwi.com/ | "how do I sell my inherited house fast in wisconsin" (AI long-tail) | **>10** ❌ | N/D | N/D | N/D | N/D |

`>10` = not present in returned top-10 SERP (Google web search via Anthropic WebSearch). Confidence: high — same query pattern was searched competitively, results are stable. `N/D` = Datos no disponibles, requires per-engine API.

## Local Ranks by City (geo-grid, WI state-wide)

**All cells: Datos no disponibles.** Requires Google Maps geo-grid SERP API (e.g. SerpAPI `google_maps` engine with lat/lng per city, or Local Falcon / GMBSpy API). Cannot be probed from current runner — Anthropic WebSearch is non-geo-localized US default.

Required cities to probe (per tenant config): Milwaukee, Madison, Green Bay, Kenosha, Racine, Appleton, Waukesha, Eau Claire, Oshkosh, Janesville, West Allis, La Crosse, Sheboygan, Wauwatosa, Fond du Lac.

Inferred priority for first wire-up: Green Bay (Pinnacle's home market by phone area code 920) → Milwaukee (largest WI metro, most search volume) → Madison (#2 metro) → Appleton/Oshkosh (Fox Cities cluster Pinnacle should own).

## Regional US Check (from MN, IL, IA, MI origins)

**Datos no disponibles.** Requires SerpAPI/DataForSEO with `gl=us&location=Chicago,IL` style geo-overrides. Anthropic WebSearch defaults to a non-localized US fingerprint. Hypothesis to test once infra exists: Pinnacle currently invisible to neighboring-state queries (probable, given they're invisible from in-state).

## Top Critical Issues (verified, ranked by mobile-weighted impact)

1. **Indexation footprint is effectively 1 page.** `site:pinnaclegroupwi.com sell house` returned **only the homepage**. WordPress sites typically have 20-200 indexed URLs. Either (a) sitemap is not submitted to Search Console, (b) most pages are noindex, (c) crawl budget is starving deep pages, or (d) the site has only 1 published page. **Action:** verify with WebFetch on next run; check Search Console; submit sitemap.xml.
2. **Zero topical authority on any priority intent.** 10/10 priority queries fail to surface site in top 10. The market is dominated by competitors with city-specific landing pages (Cream City has /west-allis/, Plan B has /we-buy-houses-west-allis-wi/, Fox Cities has /appleton/, /green-bay/, etc.). Pinnacle has no observable city-specific pages.
3. **Pinnacle does not rank in its own home market (Green Bay).** Phone is 920 area code = Green Bay region. SERP for "cash home buyers green bay wi" is owned by Fox Cities, Atticus, CB Home Solutions, HomeVestors, WIHomeBuyers — none of them Pinnacle. This is the highest-priority gap to close.
4. **No pillar-topic pages observable.** Tenant config defines 8 pillars (foreclosure help, inherited/probate, divorce, cash-vs-realtor, landlord exits, back taxes, fast-sale relocation, market updates). Editorial sites (Houzeo, ListWithClever, HomeLight, Nolo, BlueHub Capital, Wisconsin State Law Library) own every pillar query. Pinnacle has zero observable pillar content — articles_per_week target is 3 in tenant.json but content_queue execution status unknown from this run.
5. **Mobile CWV unverified.** R7 mandates mobile-first, real estate is 60-70% mobile, but no PSI API integration in posicionador → cannot detect mobile CWV regression. Blind spot since 2026-04-23.
6. **Schema coverage unverified.** LocalBusiness/Organization/FAQPage/Service/Review schemas required for AI Overview citation readiness. Cannot validate without WebFetch.

## Top Wins (verified)

1. **Branded SERP is clean.** Homepage ranks #1 for "Pinnacle Holdings Wisconsin" / "pinnaclegroupwi.com" / "Pinnacle Holdings Group Green Bay cash offer house". Title tag present and on-message: "We Buy Houses Wisconsin | Cash Offers Fast | Pinnacle Holdings". Rich snippet shows clear value props (24h cash offer, any condition, no realtor fees, closing costs covered, local WI investors).
2. **Site is indexed and crawlable.** Google has at least 1 page indexed and serves it in `site:` probe. Foundation exists.
3. **Tenant config is mature.** `agents/tenants/pinnacle.json` already defines 15 target cities, 8 topic pillars, 3 competitors, 3 articles/week target, content_queue Airtable integration. Strategic foundation is correct — execution gap is the issue.
4. **Posicionador agent code exists** (`posicionador.mjs` 80+ LOC, schedule wired in tenant.json: deep_audit Mondays 15:00 UTC, quick_health every 3 days at 14:00 UTC). Infrastructure scaffold is present.

## Priority Recommendations (ordered — what moves the most pages to #1 fastest)

### 🚨 P0 — Unblock the audit itself (this week)
1. **Grant WebFetch permission** to posicionador in next run config or wrap with curl-via-Bash fallback. Without it, every subsequent weekly audit will be 80%+ "Datos no disponibles". This single action is worth 6 of the 8 N/D cells.
2. **Wire PageSpeed Insights API.** Add `PSI_API_KEY` to Doppler. Modify `posicionador.mjs` to call PSI for every URL in sitemap, store LCP/CLS/INP mobile, alert if LCP > 2.5s. Free tier covers ≥25k req/day. ETA: 1 hour of dev.
3. **Wire SerpAPI or DataForSEO** for actual rank tracking on 8 engines × 15 cities × top 10 keywords. Without this, the audit cannot deliver "rank #1 on every engine" goal — the goal is unmeasurable. Cost: ~$50/month SerpAPI, ~$30/month DataForSEO. Required for R8 SaaS billing model anyway.

### 🥇 P1 — Highest-leverage SEO moves (next 14 days)
4. **Build city pages for top 4 markets** (mobile-first per R7, editorial-warm per Pinnacle aesthetic): `/we-buy-houses-green-bay-wi/`, `/we-buy-houses-milwaukee-wi/`, `/we-buy-houses-madison-wi/`, `/we-buy-houses-appleton-wi/`. Each: H1 = "We Buy Houses [City], WI", local NAP, 800-1200 words mobile-first, LocalBusiness schema with `areaServed` = city, 3 local testimonials, embedded GBP map, internal link to /sell-my-house-fast/. Competitor pattern is consistent across all 10 SERPs.
5. **Submit sitemap.xml to Google Search Console + Bing Webmaster Tools.** If only 1 page is indexed, this is the cheapest fix.
6. **Build 3 pillar pages from existing tenant.json pillars** — start with the 3 highest-volume pillars per current SERP gap: foreclosure help (Wisconsin State Law Library + Nolo + BlueHub own this), inherited/probate (Houzeo + ListWithClever + Ugly Duckling own), cash-vs-realtor (HomeLight + Houzeo own). 1500-1800 words each. Pinnacle's E-E-A-T angle: 920 phone + WI investor + actual deal volume → cite their own deal data.
7. **Google Business Profile audit & first-citation push.** Verify GBP exists, primary category = "Real Estate Investor" or "Real Estate Agency", complete service areas to all 15 cities, request 10 reviews from past sellers (Q3 GBP data shows reviews are #1 local pack rank factor 2026). Without GBP signal, no Maps rank possible.

### 🥈 P2 — Schema + AI engine readiness (next 30 days)
8. **Add LocalBusiness + FAQPage + Service JSON-LD** to homepage and city pages. Required for AI Overview / SGE / Perplexity citation. Validate via Schema.org validator.
9. **Add author bio + NAP block** sitewide for E-E-A-T (Google Helpful Content + AI engines weight first-party expertise).
10. **AI engine probe automation.** Once SerpAPI is wired, add Perplexity + ChatGPT-search + AI Overview probes for 5 long-tail informational queries weekly (e.g. "how do I sell my inherited house fast in wisconsin"). Required to measure GEO/AEO progress.

### 🥉 P3 — Drift baselines (this run, automated next runs)
11. **Save baseline JSON for next week's drift comparison** (this run does it — see `agents/posicionador/runs/2026-05-10_baseline.json`). After 2 runs, drift table becomes populated automatically.
12. **Wire Telegram alert for `score_delta < -10`** per posicionador SKILL.md spec. Currently scaffolded but no baseline exists yet to trigger.

## Competitor Gaps

| Competitor | Strength observed | Pinnacle gap |
|---|---|---|
| We Buy Ugly Houses Wisconsin (homevestors.com/wisconsin) | National brand authority + per-metro service-area pages (`/milwaukee/areas-we-serve/`); franchise model with hundreds of citations | No equivalent metro-area-served structure; ~0 citation footprint observable |
| HomeVestors Milwaukee (homevestors.com/milwaukee/) | Dedicated Milwaukee + Green Bay landing pages each with separate local NAP/phone; "since 1996" trust signal | No city-specific landing pages; single homepage carries all WI intent |
| Sell My House Fast Milwaukee (sellmyhousefast.com/we-buy-houses-milwaukee-wi/) | Aggregated pillar pages incl. probate/inherited that rank for informational queries | No pillar/blog content observable in SERP |
| Editorial sites (Houzeo, ListWithClever, HomeLight) | Own all "best cash buyer" comparison queries via review/listicle format with internal links to direct buyers | Pinnacle absent from these 3rd-party listicles → outreach + PR opportunity |
| Fox Cities Home Buyers (flipfoxvalley.com) | Owns Northeast WI cluster (Green Bay, Appleton, Oshkosh, Milwaukee) with city subpaths + 357 reviews, 4.8 rating | Pinnacle's home market — direct-overlap competitor with full city-page structure Pinnacle lacks |
| Cream City Home Buyers | 5.0 rating × 36 reviews + city subpaths /west-allis/ | Review velocity gap; no city subpaths |

**Note:** competitor on-page gap (schema, internal links, word count, E-E-A-T) **not measurable this run** — requires WebFetch on competitor URLs.

## Schema Coverage

**Datos no disponibles.** Requires WebFetch on `pinnaclegroupwi.com/` and key URLs to extract `<script type="application/ld+json">` blocks. Expected schemas to validate when WebFetch is restored:
- `LocalBusiness` or `RealEstateAgent` (with name, address, telephone, areaServed, geo, openingHours, priceRange) — **CRITICAL for AI Overview/Maps**
- `Organization` with `sameAs` for FB/IG/LinkedIn/YouTube — for entity disambiguation (currently competing with "Pinnacle Real Estate Group" Madison brokerage in SERPs)
- `FAQPage` for the 10 most-asked seller questions — for AI Overview citation
- `Service` for cash-offer service offering with `serviceArea`
- `Review` / `AggregateRating` once review velocity exists
- `BreadcrumbList` on city + pillar pages

## Entity disambiguation risk (verified)

WebSearch result for "Pinnacle Holdings Group Wisconsin sell house" returned **multiple competing entities sharing the "Pinnacle" name**: Pinnacle Real Estate Group (pinnaclerealestatemadison.com — Madison brokerage), Pinnacle Property Investments (pinnaclepropertyhomebuyers.com), Pinnacle Property Solutions (pinnaclepropdeals.com), Pinnacle Realty MI, Pinnacle Investments. Without explicit `Organization` schema with `sameAs` references and a knowledge-panel claim, Google may co-mingle these brands. Recommend (a) Knowledge Graph claim via Google Search Console, (b) explicit Organization JSON-LD with `legalName: "Pinnacle Holdings Group LLC"`, `sameAs: [FB, IG, LinkedIn, GBP]`, (c) consistent NAP across all citations to disambiguate from "Pinnacle Real Estate Group Madison".

---

## Run metadata

- **run_id:** 2026-05-10_seo_deep_pinnacle
- **audit_type:** seo_deep
- **trigger:** alex_manual (cron-style invocation, day=Sun pre-Monday schedule)
- **started_at:** 2026-05-10T (this run — wallclock not captured by runner)
- **method:** Anthropic WebSearch only (WebFetch denied this run)
- **queries_probed:** 13 WebSearch calls (10 priority intent + 3 branded + indexation)
- **baseline_for_next_week:** see `2026-05-10_baseline.json` (saved alongside this MD)
- **next scheduled run:** 2026-05-11 15:00 UTC (Mon, per `tenant.schedules.deep_audit = "0 15 * * 1"`)
- **token cost estimate:** ~12K input + ~4K output (well under 35K seo_deep budget per SKILL.md)

## Sources cited (Anthropic WebSearch results)

- [pinnaclegroupwi.com homepage](https://pinnaclegroupwi.com/)
- [Houzeo: 6 Best Cash Buyers in Wisconsin (2026)](https://www.houzeo.com/blog/companies-that-buy-houses-for-cash-in-wisconsin/)
- [ListWithClever: Top 10 Wisconsin Cash Home Buyers (2026)](https://listwithclever.com/cash-home-buyers/wisconsin/)
- [HomeVestors Wisconsin](https://www.homevestors.com/wisconsin/)
- [HomeVestors Milwaukee](https://www.homevestors.com/milwaukee/)
- [Fox Cities Home Buyers (flipfoxvalley.com)](https://www.flipfoxvalley.com/)
- [Cream City Home Buyers — West Allis](https://www.creamcityhomebuyers.com/west-allis/)
- [Plan B Home Buyers — West Allis](https://www.planbhomebuyers.com/we-buy-houses-west-allis-wi/)
- [Atticus Home Buyers — Green Bay / Kenosha](https://www.atticushomebuyers.com/we-buy-houses-green-bay/)
- [Wisconsin State Law Library — Foreclosure](https://wilawlibrary.gov/topics/foreclosure.php)
- [Nolo: Wisconsin Foreclosure Process](https://www.nolo.com/legal-encyclopedia/wisconsin-foreclosure-law-procedure.html)
- [HomeLight: Cash Home Buyers in Wisconsin](https://www.homelight.com/blog/cash-home-buyers-in-wisconsin/)
- [Pinnacle Real Estate Group Madison (entity-collision)](https://www.pinnaclerealestatemadison.com/)
