#!/usr/bin/env node
/**
 * El Posicionador — SEO monitoring orchestrator.
 * Usage:
 *   node agents/posicionador/posicionador.mjs --tenant <slug> --mode seo_health|seo_deep|on_demand [--dry-run]
 *
 * Reads agents/tenants/<slug>.json, spawns claude CLI with SEO skills, parses output,
 * persists to Airtable SEO_Audits, sends Telegram summary.
 *
 * Same architecture as El Mercader. SaaS multi-tenant per R8, mobile-first per R7.
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const TENANTS_DIR = join(ROOT, "agents", "tenants");
const OUTPUT_DIR = join(__dirname, "runs");

const VALID_MODES = ["seo_health", "seo_deep", "maps_deep", "on_demand"];

function parseArgs(argv) {
  const args = { mode: "seo_health", dryRun: false, tenant: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant" || a === "-t") args.tenant = argv[++i];
    else if (a === "--mode" || a === "-m") args.mode = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: posicionador.mjs --tenant <slug> --mode ${VALID_MODES.join("|")} [--dry-run]`);
      process.exit(0);
    }
  }
  if (!args.tenant) { console.error("ERROR: --tenant <slug> required"); process.exit(2); }
  if (!/^[a-z0-9_-]+$/.test(args.tenant)) { console.error("ERROR: tenant slug must match [a-z0-9_-]+"); process.exit(2); }
  if (!VALID_MODES.includes(args.mode)) { console.error(`ERROR: invalid --mode; must be one of ${VALID_MODES.join(", ")}`); process.exit(2); }
  return args;
}

async function loadTenant(slug) {
  const p = join(TENANTS_DIR, `${slug}.json`);
  const raw = await readFile(p, "utf8");
  const cfg = JSON.parse(raw);
  for (const k of ["tenant_id", "website", "claude"]) if (cfg[k] == null) throw new Error(`tenant.${k} missing in ${p}`);
  return cfg;
}

function runClaude(binary, prompt, timeoutMs = 20 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    // SEO audits need WebFetch + WebSearch + Bash (for curl/openssl probes) + Read/Write (for runs/ md files).
    // Without --allowed-tools the live network probes get rejected and the report comes back UNKNOWN.
    // Use COMMA-SEPARATED (not space) so commander doesn't slurp the prompt into the variadic <tools...> arg.
    const allowedTools = "WebFetch,WebSearch,Bash,Read,Write,Glob,Grep";
    const child = spawn(binary, [
      "--print",
      "--permission-mode", "acceptEdits",
      "--allowed-tools", allowedTools,
      "--",
      prompt,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("timeout")); }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 500)}`));
      resolve(out);
    });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

async function airtableUpsert(cfg, runId, fields) {
  // Use `seo_table_id` if defined on tenant config, else fall back to the shared `airtable.table_id`.
  const baseId = cfg.airtable?.base_id;
  const tableId = cfg.airtable?.seo_table_id || cfg.airtable?.table_id;
  const token = process.env[cfg.airtable?.token_env || "AIRTABLE_TOKEN"];
  if (!baseId || !tableId || !token) {
    console.error("[posicionador] airtable not configured (need base_id + seo_table_id + token); skipping write");
    return null;
  }
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
  const existing = await fetch(`${url}?filterByFormula=${encodeURIComponent(`{run_id}='${runId}'`)}&maxRecords=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()).catch(() => ({ records: [] }));

  if (existing.records && existing.records.length > 0) {
    const recId = existing.records[0].id;
    const r = await fetch(`${url}/${recId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields, typecast: true }),
    });
    return await r.json();
  } else {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { run_id: runId, ...fields }, typecast: true }),
    });
    return await r.json();
  }
}

async function telegramSend(cfg, text) {
  const token = process.env[cfg.telegram?.bot_token_env || "TELEGRAM_BOT_TOKEN"];
  const chat  = process.env[cfg.telegram?.chat_id_env   || "TELEGRAM_CHAT_ID"];
  if (!token || !chat) { console.error("[posicionador] telegram not configured; skipping"); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ chat_id: chat, text, parse_mode: "Markdown" }).toString(),
    });
  } catch (e) { console.error("[posicionador] telegram error:", e.message); }
}

function extractBlock(text, header) {
  // Pull the first block after a heading that matches the given regex fragment.
  const re = new RegExp(`(?:${header})[^\\n]*\\n([\\s\\S]{1,2000}?)(?:\\n\\s*\\n|\\n#{1,3}\\s|$)`, "i");
  return (text.match(re) || [,""])[1].trim();
}
function extractScore(text, label) {
  // Accepts "Overall: 82/100", "Technical Score: 73", "Local score: 91", "Content: 85 / 100"
  const re = new RegExp(`${label}[^\\n]*?(?:score|:)[:\\s]+(\\d{1,3})(?:\\s*\\/\\s*100)?`, "i");
  const m = text.match(re);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

function parseAudit(text) {
  const overall   = extractScore(text, "(?:overall|global|total|seo)") ?? null;
  const technical = extractScore(text, "technical");
  const local     = extractScore(text, "local");
  const content   = extractScore(text, "(?:content|e-?e-?a-?t)");
  return {
    overall_score:   overall,
    technical_score: technical,
    local_score:     local,
    content_score:   content,
    top_issues:       extractBlock(text, "(?:top\\s+)?(?:critical\\s+)?issues?").slice(0, 1500),
    top_wins:         extractBlock(text, "(?:top\\s+)?(?:wins?|strengths?)").slice(0, 1500),
    recommendations:  extractBlock(text, "(?:recommendations?|next\\s+steps?|priority\\s+actions?)").slice(0, 2000),
    mobile_cwv:       extractBlock(text, "(?:core\\s+web\\s+vitals?|mobile\\s+cwv|LCP|CLS|INP)").slice(0, 800),
    local_ranks:      extractBlock(text, "(?:local\\s+ranks?|geo-?grid|ranking\\s+by\\s+city)").slice(0, 1500),
    competitor_gaps:  extractBlock(text, "(?:competitor\\s+gaps?|competitive\\s+position)").slice(0, 1500),
    schema_coverage:  extractBlock(text, "(?:schema(?:\\s+markup)?|structured\\s+data)").slice(0, 800),
  };
}

function buildPrompt(cfg, mode) {
  const site     = cfg.website;
  const tenant   = cfg.tenant_name;
  const industry = cfg.industry || "generic";
  const market   = (cfg.markets && cfg.markets[0]) || {};
  const state    = market.state || "";
  const citiesArr = market.cities_primary || market.cities || [];
  const citiesList = citiesArr.length ? citiesArr.join(", ") : "(none configured)";
  const regional  = cfg.regional_scope || {};
  const regionalSecondary = (regional.secondary || []).join(", ") || "(none)";
  const engines   = (cfg.search_engines || ["google", "bing", "ai-overviews", "chatgpt-search", "perplexity"]).join(", ");
  const targetRank = (cfg.seo_goals && cfg.seo_goals.per_page_target_rank) || 1;
  const primaryPriority   = (cfg.seo_goals && cfg.seo_goals.primary_priority)   || `${state} state-wide local SEO`;
  const secondaryPriority = (cfg.seo_goals && cfg.seo_goals.secondary_priority) || "Regional US";
  const competitors = (cfg.competitors || []).map(c => `- ${c.name}: ${c.url}`).join("\n") || "(none configured)";

  const commonContext = `
Tenant:       "${tenant}" (industry: ${industry})
Site:         ${site}
Primary goal: rank EVERY page at position #${targetRank} on EVERY search engine below.
Engines:      ${engines}
PRIMARY scope (weight ${regional.primary_weight ?? 0.75}):   ${primaryPriority}
  State:        ${state}
  Target cities (state-wide, not metro-only): ${citiesList}
SECONDARY scope (weight ${regional.secondary_weight ?? 0.25}): ${secondaryPriority}
  Neighboring states for regional 'Wisconsin intent' queries: ${regionalSecondary}
Mobile-first: mobile traffic dominates real estate search (60-70%+). Mobile CWV + mobile rank = primary signal.`;

  if (mode === "seo_health") {
    return `You are El Posicionador, always-on SEO sub-agent. Scope every 3 days: state-wide multi-engine rank health check for tenant.

${commonContext}

Tasks for this run (priority order):
1) /seo sitemap ${site} — enumerate ALL indexed pages (we want every single one at #${targetRank})
2) /seo audit ${site} — overall health score (mobile-weighted)
3) /seo local ${site} — GBP health + citation NAP consistency + reviews velocity (primary lever for WI state-wide visibility)
4) Check Core Web Vitals mobile (LCP/CLS/INP) — any regression vs last baseline
5) Quick per-page rank probe for top 10 pages across engines listed above: where does each page rank today for its primary intent query? Note any page not in top 3 on any engine.

Output format (concise markdown, terse bullets):

# ${tenant} — SEO Health Check (${new Date().toISOString().slice(0,10)})

## Overall Score: N/100

## Pages Inventoried
- Total pages in sitemap: N
- Pages currently at rank #1 on primary engine (Google): X/N
- Pages NOT in top 3 on primary engine: Y  ← target for next week

## Mobile CWV
- LCP / CLS / INP with PASS/WARN/FAIL each

## Local Health (Primary)
- GBP status
- NAP consistency
- Review velocity vs last check

## Top 3 Critical Issues (mobile + local priority)
- ...

## Top 3 Wins
- ...

## 3 Priority Recommendations (to push more pages to #${targetRank})
- ...

Scores 0-100. Do NOT drift into deep content analysis — this is the every-3-days health check.`;
  }

  if (mode === "seo_deep") {
    return `You are El Posicionador, always-on SEO sub-agent. Weekly comprehensive state-wide multi-engine SEO deep audit.

${commonContext}

Run in sequence, covering ALL pages of the site and ALL engines in the list:

1) /seo sitemap ${site} — inventory every indexable page
2) /seo audit ${site} — site-level overall
3) /seo technical ${site} — crawlability, indexability, rendering, schema, mobile CWV, structured data, JS rendering, internationalization
4) /seo local ${site} — GBP, citations NAP, reviews, local citations (primary: ${state} state-wide)
5) /seo maps ${site} — geo-grid rank tracking across ALL these cities: ${citiesList}
6) /seo content ${site} — E-E-A-T quality + AI citation readiness (GEO/AEO for AI Overviews, ChatGPT search, Perplexity, Google SGE)
7) /seo drift ${site} — regression vs last week's baseline
8) For each of the top 10 pages: probe rank on each engine (${engines}) for its primary intent query. Flag any page not at #${targetRank}.
9) /seo schema ${site} — validate schema.org coverage (LocalBusiness, FAQPage, Review, Service, Organization)
10) Competitor gap analysis against:
${competitors}

Aggregate into single client-ready report:

# ${tenant} — Weekly SEO Audit (${new Date().toISOString().slice(0,10)})

## Executive Summary
- Pages at target rank (#${targetRank}): X/N
- Pages that moved up this week: A
- Pages that moved down this week: B
- Primary-market ${state} visibility: score /100
- Regional US visibility (${regionalSecondary}): score /100

## Overall Score: N/100
## Technical Score: N/100
## Local Score: N/100
## Content Score: N/100

## Mobile Core Web Vitals
- LCP / CLS / INP with PASS/WARN/FAIL and delta vs last week

## Per-Page Rank Inventory (primary engine + AI engines)
| Page URL | Intent query | Google | AI Overviews | Bing | ChatGPT | Perplexity |
|---|---|---|---|---|---|---|
- Table for top 10 pages.

## Local Ranks by City (geo-grid, ${state} state-wide)
- Milwaukee / Madison / Green Bay / Kenosha / Racine / ... — rank per primary query

## Regional US Check (from ${regionalSecondary} origins)
- Does "Wisconsin cash home buyers" show us in top 3 from IL/MN/IA/MI searches?

## Top Critical Issues
## Top Wins
## Priority Recommendations (ordered — what moves the most pages to #${targetRank} fastest)
## Competitor Gaps
## Schema Coverage

Be specific, quantified, actionable. Mobile signals weighted heavier. Cite every number.`;
  }

  if (mode === "maps_deep") {
    return `You are El Posicionador, always-on SEO sub-agent. Modo: maps_deep — enfoque EXCLUSIVO en Google Maps + Google Business Profile (GBP) + local citations + review velocity. Runs every 3 days, separate from general seo_health.

${commonContext}

Run in sequence:
1) /seo local ${site} — GBP audit: name, category, description, services listed, hours, service area config, photos fresh, Posts this week, Q&A answered
2) /seo maps ${site} — geo-grid rank tracking across ALL ${state} cities: ${citiesList}. For each city, check rank on the 3 primary intent queries (e.g., "cash home buyers <city>", "sell my house fast <city>", "we buy houses <city>").
3) Citations NAP consistency audit:
   - Is Name + Address + Phone IDENTICAL across: Yelp, BBB, Apple Maps, Bing Places, Foursquare, Wisconsin REALTORS Association, Milwaukee Business Journal directory, and top 20 general directories?
   - Flag any inconsistency (different phone formats, abbreviated street names, wrong zip)
4) Review velocity analysis:
   - Total Google reviews count + delta vs last maps_deep run
   - Response rate to reviews (responded within 48h / 7d / never)
   - Rating distribution + weighted average
   - Competitor comparison: how many reviews do ${(cfg.competitors || []).map(c => c.name).join(", ") || "top competitors"} have?
5) GBP Posts frequency check: when was the last GBP Post published? Recommended cadence: weekly minimum
6) Q&A proactivity: are there user questions on GBP profile unanswered? Should we add our own FAQ-style Q&As?
7) Photo freshness: are photos uploaded within the last 30 days? GBP favors fresh media

Output format (strict markdown):

# ${tenant} — Google Maps Deep Audit (${new Date().toISOString().slice(0,10)})

## GBP Health Score: N/100
## Local Visibility Score: N/100

## GBP Profile Completeness
| Field | Status | Action needed |
|---|---|---|
- Name / Category / Description / Services / Hours / Service area / Photos / Posts / Q&A

## NAP Consistency
- Sources audited: N
- Inconsistencies found: N (list each: source, what differs, suggested fix)

## Geo-Grid Rank (${state} state-wide)
| City | "cash home buyers" rank | "sell my house fast" rank | "we buy houses" rank |
|---|---|---|---|
- Row per city in: ${citiesList}

## Review Velocity
- Total Google reviews: N (delta +X vs last audit)
- Average rating: X.X
- Response rate: X%
- Competitors: [name — count reviews — avg rating]
- Review request opportunities: list deals closed in last 30d without review request sent

## Action Priorities (ranked — what moves local rank most in next 3 days)
1. ...
2. ...
3. ...

Mobile-first: GBP impressions are 80%+ mobile. Mobile photo UX + mobile directions clicks weighted heavily.`;
  }

  // on_demand fallback
  const skills = (cfg.skills && cfg.skills.seo_deep) || ["seo-audit"];
  return `You are El Posicionador. On-demand SEO for ${site} (tenant: ${tenant}). Skills: ${skills.join(", ")}. Multi-engine rank check + mobile CWV + state-wide local. Produce scored markdown report.`;
}

async function main() {
  const args = parseArgs(process.argv);
  const cfg = await loadTenant(args.tenant);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  console.error(`[posicionador] tenant=${cfg.tenant_id} mode=${args.mode} run_id=${runId} dry_run=${args.dryRun}`);

  if (!args.dryRun) {
    await airtableUpsert(cfg, runId, {
      tenant_id: cfg.tenant_id,
      audit_type: args.mode,
      status: "Running",
      trigger: process.env.POSICIONADOR_TRIGGER || "alex_manual",
      started_at: startedAt,
    });
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const prompt = buildPrompt(cfg, args.mode);

  if (args.dryRun) {
    console.log("=== DRY RUN — prompt that would be sent to claude ===");
    console.log(prompt);
    console.log("\n=== No subprocess, no Airtable, no Telegram. ===");
    return;
  }

  let claudeOut = "";
  try {
    claudeOut = await runClaude(cfg.claude.binary_path, prompt);
  } catch (e) {
    await airtableUpsert(cfg, runId, {
      status: "Failed",
      completed_at: new Date().toISOString(),
      summary_md: `Run failed: ${e.message}`,
    });
    await telegramSend(cfg, `❌ *El Posicionador — ${cfg.tenant_name}*\nmode: \`${args.mode}\`\nerror: \`${e.message}\``);
    process.exit(1);
  }

  const parsed = parseAudit(claudeOut);
  const completedAt = new Date().toISOString();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);

  const mdPath = join(OUTPUT_DIR, `${runId}.md`);
  await writeFile(mdPath, claudeOut, "utf8");

  await airtableUpsert(cfg, runId, {
    status: "Done",
    completed_at: completedAt,
    duration_sec: duration,
    ...parsed,
    summary_md: claudeOut.slice(0, 100000),
    report_url: mdPath,
  });

  // Alert emoji picker
  const thr = cfg.alert_thresholds || {};
  const score = parsed.overall_score;
  const emoji = score == null ? "🔍" : score < (thr.critical_score ?? 50) ? "🚨" : score < (thr.warn_score ?? 70) ? "⚠️" : "✅";

  const scoreLine = [
    score != null ? `Overall: *${score}/100*` : null,
    parsed.technical_score != null ? `Tech: ${parsed.technical_score}` : null,
    parsed.local_score != null ? `Local: ${parsed.local_score}` : null,
    parsed.content_score != null ? `Content: ${parsed.content_score}` : null,
  ].filter(Boolean).join(" · ");

  const head = `${emoji} *El Posicionador — ${cfg.tenant_name}*\nmode: \`${args.mode}\`\n${scoreLine}`;
  const body = [
    parsed.mobile_cwv ? `\n*Mobile CWV:*\n${parsed.mobile_cwv.split("\n").slice(0, 4).join("\n")}` : "",
    parsed.top_issues ? `\n*Top issues:*\n${parsed.top_issues.split("\n").slice(0, 5).join("\n")}` : "",
    parsed.recommendations ? `\n*Next:*\n${parsed.recommendations.split("\n").slice(0, 4).join("\n")}` : "",
  ].join("");

  await telegramSend(cfg, (head + body).slice(0, 3900));

  console.error(`[posicionador] done run_id=${runId} overall=${score} duration=${duration}s`);
}

main().catch((e) => { console.error("[posicionador] FATAL:", e); process.exit(1); });
