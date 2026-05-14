#!/usr/bin/env node
/**
 * El Cazador — ads audit orchestrator (Airtable-native, uses claude-ads skills).
 * Sub-agente del plantel R9. Cadencia cada 3 días + semanal lunes.
 *
 * Usage:
 *   node agents/cazador/cazador.mjs --tenant <slug> --mode ads_health|ads_deep|on_demand [--platform P] [--data STRING] [--dry-run]
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

const VALID_MODES = ["ads_health", "ads_deep", "on_demand"];
const VALID_PLATFORMS = ["google", "meta", "tiktok", "linkedin", "microsoft", "apple", "youtube", "multi"];

function parseArgs(argv) {
  const a = { mode: "ads_health", dryRun: false, tenant: null, platform: "multi", data: "" };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--tenant" || k === "-t") a.tenant = argv[++i];
    else if (k === "--mode" || k === "-m") a.mode = argv[++i];
    else if (k === "--platform" || k === "-p") a.platform = argv[++i];
    else if (k === "--data" || k === "-d") a.data = argv[++i];
    else if (k === "--dry-run") a.dryRun = true;
    else if (k === "--help" || k === "-h") {
      console.log(`Usage: cazador.mjs --tenant <slug> --mode ${VALID_MODES.join("|")} [--platform ${VALID_PLATFORMS.join("|")}] [--data "spend $X CPL $Y ..."] [--dry-run]`);
      process.exit(0);
    }
  }
  if (!a.tenant) { console.error("ERROR: --tenant required"); process.exit(2); }
  if (!/^[a-z0-9_-]+$/.test(a.tenant)) { console.error("ERROR: invalid tenant slug"); process.exit(2); }
  if (!VALID_MODES.includes(a.mode)) { console.error(`ERROR: invalid --mode`); process.exit(2); }
  if (!VALID_PLATFORMS.includes(a.platform)) { console.error(`ERROR: invalid --platform`); process.exit(2); }
  return a;
}

async function loadTenant(slug) {
  const p = join(TENANTS_DIR, `${slug}.json`);
  const raw = await readFile(p, "utf8");
  const cfg = JSON.parse(raw);
  for (const k of ["tenant_id", "website", "claude"]) if (cfg[k] == null) throw new Error(`tenant.${k} missing`);
  return cfg;
}

function runClaude(binary, prompt, timeoutMs = 25 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ["--print", "--permission-mode", "acceptEdits", prompt], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("timeout")); }, timeoutMs);
    child.stdout.on("data", d => out += d);
    child.stderr.on("data", d => err += d);
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new Error(`claude exit ${code}: ${err.slice(0, 300)}`)); });
    child.on("error", e => { clearTimeout(timer); reject(e); });
  });
}

async function airtableUpsert(cfg, runId, fields) {
  const base = cfg.airtable?.base_id;
  const table = cfg.airtable?.ads_table_id || cfg.airtable?.table_id;
  const token = process.env[cfg.airtable?.token_env || "AIRTABLE_TOKEN"];
  if (!base || !table || !token) { console.error("[cazador] airtable not configured; skipping write"); return null; }
  const url = `https://api.airtable.com/v0/${base}/${table}`;
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
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { run_id: runId, ...fields }, typecast: true }),
  });
  return await r.json();
}

async function telegramSend(cfg, text) {
  const token = process.env[cfg.telegram?.bot_token_env || "TELEGRAM_BOT_TOKEN"];
  const chat = process.env[cfg.telegram?.chat_id_env || "TELEGRAM_CHAT_ID"];
  if (!token || !chat) { console.error("[cazador] telegram not configured"); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ chat_id: chat, text, parse_mode: "Markdown" }).toString(),
    });
  } catch (e) { console.error("[cazador] telegram error:", e.message); }
}

function extractScore(text, label) {
  const re = new RegExp(`${label}[^\\n]*?(?:score|:)[:\\s]+(\\d{1,3})(?:\\s*\\/\\s*100)?`, "i");
  const m = text.match(re);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

function extractBlock(text, header) {
  const re = new RegExp(`(?:${header})[^\\n]*\\n([\\s\\S]{1,2500}?)(?:\\n\\s*\\n|\\n#{1,3}\\s|$)`, "i");
  return (text.match(re) || [, ""])[1].trim();
}

function extractNumber(text, label) {
  const re = new RegExp(`${label}[^\\n]*?[:$]?\\s*\\$?\\s*(\\d+(?:\\.\\d+)?)`, "i");
  const m = text.match(re);
  return m ? parseFloat(m[1]) : null;
}

function parseAuditOutput(text) {
  return {
    overall_score:      extractScore(text, "(?:overall|ads?\\s+quality|total)"),
    score_delta:        null,
    top_issues:         extractBlock(text, "(?:top\\s+)?(?:critical\\s+)?issues?").slice(0, 2000),
    top_wins:           extractBlock(text, "(?:top\\s+)?(?:wins?|strengths?)").slice(0, 2000),
    recommendations:    extractBlock(text, "(?:recommendations?|next\\s+steps?|priority\\s+actions?)").slice(0, 2500),
    platform_breakdown: extractBlock(text, "(?:platform\\s+breakdown|per[-\\s]?platform)").slice(0, 2000),
    creative_analysis:  extractBlock(text, "(?:creative\\s+(?:analysis|quality)|ad\\s+creatives?)").slice(0, 1800),
    audience_analysis:  extractBlock(text, "(?:audience\\s+(?:analysis|targeting))").slice(0, 1800),
    landing_page_issues:extractBlock(text, "(?:landing\\s+page|lpo|post-click)").slice(0, 1500),
    competitor_intel:   extractBlock(text, "(?:competitor\\s+(?:intel|gaps|analysis))").slice(0, 1800),
    spend_last_7d:      extractNumber(text, "spend[_\\s]?(?:last[_\\s]?)?7d?"),
    spend_last_30d:     extractNumber(text, "spend[_\\s]?(?:last[_\\s]?)?30d?"),
    conversions_7d:     extractNumber(text, "conversions[_\\s]?(?:last[_\\s]?)?7d?"),
    conversions_30d:    extractNumber(text, "conversions[_\\s]?(?:last[_\\s]?)?30d?"),
    cpl_7d:             extractNumber(text, "cpl[_\\s]?(?:last[_\\s]?)?7d?"),
    cpl_30d:            extractNumber(text, "cpl[_\\s]?(?:last[_\\s]?)?30d?"),
    ctr_avg:            extractNumber(text, "ctr"),
    cpc_avg:            extractNumber(text, "cpc"),
    roas:               extractNumber(text, "roas"),
    quality_score_avg:  extractNumber(text, "quality\\s+score"),
  };
}

function buildPrompt(cfg, args) {
  const site = cfg.website;
  const tenant = cfg.tenant_name;
  const industry = cfg.industry || "real-estate";
  const competitors = (cfg.competitors || []).map(c => `- ${c.name}: ${c.url}`).join("\n") || "(none configured)";
  const state = cfg.markets?.[0]?.state || "";
  const cities = (cfg.markets?.[0]?.cities_primary || []).slice(0, 5).join(", ");
  const dataInput = args.data ? `\n\nData provided by Jorge (use this for analysis):\n${args.data}` : "\n\n(No data input provided — analyze based on website + competitive intel only.)";

  const header = `Tenant: "${tenant}" (${industry})
Website: ${site}
Primary market: ${state} state-wide (${cities})
Competitors:\n${competitors}
Platform focus: ${args.platform}${dataInput}

Mobile-first: mobile ad experience + mobile landing page weighted heavy (60-70%+ of real estate traffic).`;

  if (args.mode === "ads_health") {
    return `You are El Cazador, always-on ads audit sub-agent. Modo: ads_health (every 3 days quick check).

${header}

Skills to invoke (pick based on platform):
- If platform=multi or google: /ads google ${site}
- If platform=meta: /ads meta ${site}
- If no platform data but website only: /ads landing ${site} + /ads competitor ${site} (competitive pulse)
- /ads dna ${site} — brand consistency check

Output format (strict markdown, concise):

# ${tenant} — Ads Health Check (${new Date().toISOString().slice(0,10)})

## Overall Score: N/100

## Key Metrics (if data provided)
- spend_last_7d: $N
- conversions_7d: N
- cpl_7d: $N
- ctr: N%

## Top 3 Critical Issues (mobile + budget priority)
- ...

## Top 3 Wins
- ...

## 3 Priority Recommendations
- ...

## Drift vs Last Check
- (note any CPL spike, CTR drop, spend acceleration)

Scores 0-100. Be specific. Budget waste detection priority.`;
  }

  if (args.mode === "ads_deep") {
    return `You are El Cazador, always-on ads audit sub-agent. Modo: ads_deep (weekly comprehensive).

${header}

Run full /ads audit pipeline with parallel subagents across all 7 platforms. Use industry template "real-estate".

Skills to invoke in sequence:
1) /ads audit ${site} — orchestrator (250+ checks, 6 parallel subagents)
2) /ads landing ${site} — LPO depth
3) /ads competitor ${site} — with competitors listed above
4) /ads budget — allocation review if spend data provided
5) /ads math — CPA/ROAS/CPL modeling
6) /ads creative — cross-platform creative quality
7) /ads test — propose 3 A/B tests for next week

Output structure (strict):

# ${tenant} — Weekly Ads Deep Audit (${new Date().toISOString().slice(0,10)})

## Executive Summary
- Overall Score: N/100
- Spend 7d / 30d: $N / $N
- Conversions 7d / 30d: N / N
- CPL trend: stable/up/down vs last week
- Critical alerts: N

## Per-Platform Breakdown
### Google Ads (if applicable)
- Score: N/100
- Spend: $N | Conv: N | CPL: $N | CTR: N% | QS avg: N/10
- Top issue / Top win / Action

### Meta (Facebook + Instagram)
- Score: N/100
- Spend: $N | Conv: N | CPL: $N | CTR: N% | Freq: N
- Top issue / Top win / Action

### TikTok / LinkedIn / Microsoft / Apple / YouTube
- (Include if relevant)

## Creative Analysis
- Best performing creatives (keep/scale)
- Underperforming creatives (pause/iterate)
- Creative fatigue signals
- Compliance flags (real-estate specific: Fair Housing, claims, etc.)

## Audience Analysis
- Best audiences (keep/expand)
- Underperforming audiences (narrow/exclude)
- Lookalike opportunities

## Landing Page Issues (CRO priority)
- Mobile LCP/CLS/INP
- Form friction points
- CTA clarity
- Above-the-fold signal match

## Competitor Intel
- Where competitors (${(cfg.competitors || []).map(c => c.name).join(", ")}) are outperforming
- Ad creative patterns observed
- Offer/pricing differences
- Budget estimate based on share-of-voice

## A/B Test Plan (next week)
1. Hypothesis + variant setup for creative
2. Hypothesis + variant setup for audience
3. Hypothesis + variant setup for landing/CTA

## Priority Recommendations (ordered by impact × ease)
1. ...
2. ...
3. ...
4. ...
5. ...

Be specific, quantified, actionable. All scores 0-100. Mobile signals weighted heavier.`;
  }

  // on_demand
  return `You are El Cazador. On-demand ads analysis for tenant "${tenant}", platform=${args.platform}.
${header}

Invoke skill chain appropriate to platform:
- google → /ads google ${site}
- meta → /ads meta ${site}
- tiktok → /ads tiktok ${site}
- linkedin → /ads linkedin ${site}
- microsoft → /ads microsoft ${site}
- apple → /ads apple ${site}
- youtube → /ads youtube ${site}

Produce scored markdown: Overall Score, Metrics Snapshot, Top Issues, Top Wins, Recommendations, Mobile CWV of landing.`;
}

async function main() {
  const args = parseArgs(process.argv);
  const cfg = await loadTenant(args.tenant);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  console.error(`[cazador] tenant=${cfg.tenant_id} mode=${args.mode} platform=${args.platform} run_id=${runId} dry_run=${args.dryRun}`);

  const prompt = buildPrompt(cfg, args);

  if (args.dryRun) {
    console.log("=== DRY RUN — prompt that would be sent to claude ===");
    console.log(prompt);
    console.log("\n=== No subprocess, no Airtable, no Telegram. ===");
    return;
  }

  await airtableUpsert(cfg, runId, {
    tenant_id: cfg.tenant_id,
    audit_type: args.mode,
    status: "Running",
    trigger: process.env.CAZADOR_TRIGGER || "alex_manual",
    started_at: startedAt,
    platform: args.platform,
    source_data_snapshot: args.data?.slice(0, 5000) || "",
  });

  await mkdir(OUTPUT_DIR, { recursive: true });

  let claudeOut = "";
  try {
    claudeOut = await runClaude(cfg.claude.binary_path, prompt);
  } catch (e) {
    await airtableUpsert(cfg, runId, {
      status: "Failed",
      completed_at: new Date().toISOString(),
    });
    await telegramSend(cfg, `❌ *El Cazador — ${cfg.tenant_name}*\nmode: \`${args.mode}\`\nerror: \`${e.message}\``);
    process.exit(1);
  }

  const parsed = parseAuditOutput(claudeOut);
  const completedAt = new Date().toISOString();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);

  const mdPath = join(OUTPUT_DIR, `${runId}.md`);
  await writeFile(mdPath, claudeOut, "utf8");

  await airtableUpsert(cfg, runId, {
    status: "Done",
    completed_at: completedAt,
    duration_sec: duration,
    ...parsed,
    report_url: mdPath,
  });

  // Alert emoji
  const thr = cfg.alert_thresholds || {};
  const score = parsed.overall_score;
  let emoji = "🎯";
  let flag = "";
  if (score != null) {
    if (score < (thr.critical_score ?? 50)) { emoji = "🚨"; flag = "CRITICAL"; }
    else if (score < (thr.warn_score ?? 70)) { emoji = "⚠️"; flag = "WARN"; }
    else { emoji = "✅"; flag = "OK"; }
  }
  // Budget waste sentinel
  if (parsed.spend_last_7d && parsed.spend_last_7d > 100 && (parsed.conversions_7d || 0) === 0) {
    emoji = "🚨"; flag = "BUDGET WASTE";
  }

  const bits = [
    score != null ? `score: *${score}/100* (${flag})` : null,
    parsed.spend_last_7d != null ? `spend 7d: $${parsed.spend_last_7d}` : null,
    parsed.cpl_7d != null ? `CPL: $${parsed.cpl_7d}` : null,
    parsed.ctr_avg != null ? `CTR: ${parsed.ctr_avg}%` : null,
  ].filter(Boolean).join(" · ");

  const head = `${emoji} *El Cazador — ${cfg.tenant_name}*\nmode: \`${args.mode}\` platform: \`${args.platform}\`\n${bits}`;
  const body = [
    parsed.top_issues ? `\n*Top issues:*\n${parsed.top_issues.split("\n").slice(0, 5).join("\n")}` : "",
    parsed.recommendations ? `\n*Next:*\n${parsed.recommendations.split("\n").slice(0, 4).join("\n")}` : "",
  ].join("");

  await telegramSend(cfg, (head + body).slice(0, 3900));

  console.error(`[cazador] done run_id=${runId} score=${score} duration=${duration}s`);
}

main().catch(e => { console.error("[cazador] FATAL:", e); process.exit(1); });
