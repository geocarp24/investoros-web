#!/usr/bin/env node
/**
 * El Escriba — copywriting / content generation orchestrator.
 * Sub-sub-agente bajo El Posicionador en el plantel R9.
 *
 * Usage:
 *   node agents/escriba/escriba.mjs --tenant <slug> --mode atp_mine|plan_week|draft_article|on_demand [options]
 *
 * Options:
 *   --article-id <id>      (draft_article) — run_id específico de Content_Queue a draftear
 *   --title <string>       (on_demand)     — title forzado
 *   --target-keyword <s>   (on_demand)     — keyword primary forzado
 *   --dry-run              preview sin subprocess / Airtable / Telegram / WP
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

const VALID_MODES = ["atp_mine", "plan_week", "draft_article", "on_demand"];

function parseArgs(argv) {
  const args = { mode: "plan_week", dryRun: false, tenant: null, articleId: null, title: null, targetKeyword: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant" || a === "-t") args.tenant = argv[++i];
    else if (a === "--mode" || a === "-m") args.mode = argv[++i];
    else if (a === "--article-id") args.articleId = argv[++i];
    else if (a === "--title") args.title = argv[++i];
    else if (a === "--target-keyword") args.targetKeyword = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: escriba.mjs --tenant <slug> --mode ${VALID_MODES.join("|")} [--article-id <id> | --title <s> --target-keyword <s>] [--dry-run]`);
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

function runClaude(binary, prompt, timeoutMs = 25 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ["--print", "--permission-mode", "acceptEdits", prompt], { stdio: ["ignore", "pipe", "pipe"] });
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

function contentQueueTable(cfg) {
  return cfg.airtable?.content_queue_table_id || cfg.airtable?.table_id || null;
}
function seoAuditTable(cfg) {
  return cfg.airtable?.seo_table_id || cfg.airtable?.table_id || null;
}

async function airtableFetch(cfg, tableId, params = "") {
  const base = cfg.airtable?.base_id;
  const token = process.env[cfg.airtable?.token_env || "AIRTABLE_TOKEN"];
  if (!base || !tableId || !token) return { records: [] };
  const url = `https://api.airtable.com/v0/${base}/${tableId}${params ? "?" + params : ""}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return await r.json().catch(() => ({ records: [] }));
}

async function airtableUpsert(cfg, tableId, runId, fields) {
  const base = cfg.airtable?.base_id;
  const token = process.env[cfg.airtable?.token_env || "AIRTABLE_TOKEN"];
  if (!base || !tableId || !token) { console.error("[escriba] airtable not configured; skipping"); return null; }
  const url = `https://api.airtable.com/v0/${base}/${tableId}`;
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
  const chat  = process.env[cfg.telegram?.chat_id_env   || "TELEGRAM_CHAT_ID"];
  if (!token || !chat) { console.error("[escriba] telegram not configured; skipping"); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ chat_id: chat, text, parse_mode: "Markdown" }).toString(),
    });
  } catch (e) { console.error("[escriba] telegram error:", e.message); }
}

// ===== Prompt builders per mode =====

function commonHeader(cfg, extra = "") {
  const state = cfg.markets?.[0]?.state || "";
  const cities = (cfg.markets?.[0]?.cities_primary || []).slice(0, 10).join(", ");
  const pillars = (cfg.content_goals?.topic_pillars || []).map(p => `- ${p}`).join("\n") || "(none)";
  const tone = cfg.content_goals?.tone || "professional";
  const minW = cfg.content_goals?.target_word_count_min || 900;
  const maxW = cfg.content_goals?.target_word_count_max || 1800;
  const langs = (cfg.content_goals?.languages || ["en"]).join(", ");
  return `Tenant: "${cfg.tenant_name}" (industry: ${cfg.industry})
Primary market: ${state} state-wide (cities: ${cities})
Languages to produce: ${langs}
Tone: ${tone}
Target word count per article: ${minW}–${maxW}
Topic pillars:
${pillars}
${extra ? "\n" + extra : ""}`;
}

function buildPromptAtpMine(cfg) {
  const seeds = (cfg.content_goals?.atp_mining?.seed_queries || []).map(s => `- "${s}"`).join("\n");
  return `You are El Escriba, content writer sub-agent. Modo: atp_mine.
${commonHeader(cfg)}

Task: for each seed query below, generate AnswerThePublic-style questions real people in ${cfg.markets?.[0]?.state || "the target market"} would search. For each seed: 8-12 questions distributed across Who/What/When/Where/Why/How/Comparisons/Prepositions.

Seeds:
${seeds}

For each question, output one row in markdown table:

| Pillar | Question | Intent (informational/navigational/transactional) | Estimated difficulty (low/med/high) | Content type (blog/Q&A/pillar) | Backlink potential (low/med/high) | Priority score 1-10 |

Be honest about difficulty and backlink potential. Prioritize questions that:
- Have LOCAL signal (state/city names)
- Address emotional pain (foreclosure, divorce, probate)
- Allow citable stats or step-by-step how-to (high backlink potential)
- Are under-covered by competitors

Output ONLY the table, no preamble.`;
}

function buildPromptPlanWeek(cfg, lastSeoSummary = "") {
  const articlesPerWeek = cfg.content_goals?.articles_per_week || 3;
  const types = (cfg.content_goals?.content_types || []).map(t => `${t.type} (${t.weight})`).join(", ");
  return `You are El Escriba, content writer sub-agent. Modo: plan_week.
${commonHeader(cfg)}

Articles to plan this week: ${articlesPerWeek}
Content type mix (weights): ${types}

Last SEO audit findings (from El Posicionador):
${lastSeoSummary || "(no recent audit data — use topic_pillars defaults)"}

Task: produce a content calendar for the next 7 days. ${articlesPerWeek} articles, each with:

\`\`\`
### Article N
- title: "..."
- content_type: blog_post | q_and_a_page | news_article | pillar_page
- pillar: (match one of the topic_pillars)
- target_keyword: "..."
- intent_query: "..." (the real question a searcher types)
- secondary_keywords: ...
- target_audience_segment: ...
- proposed_publish_date: YYYY-MM-DD
- rationale: 1-2 sentences why this article this week (ties to SEO gap / ATP question / seasonal opportunity)
- backlink_angle: what hook makes it citable / link-worthy
\`\`\`

Balance the mix across pillars. Prioritize highest-leverage (SEO gap fills + high backlink potential). Don't stack all articles on same pillar.

Output only the 3 article blocks, no preamble.`;
}

function buildPromptDraftArticle(cfg, article) {
  const title = article.title || "Untitled";
  const keyword = article.target_keyword || "";
  const intent = article.intent_query || "";
  const type = article.content_type || "blog_post";
  const pillar = article.pillar || "";
  const minW = cfg.content_goals?.target_word_count_min || 900;
  const maxW = cfg.content_goals?.target_word_count_max || 1800;
  const langs = cfg.content_goals?.languages || ["en"];
  const state = cfg.markets?.[0]?.state || "";
  const phone = cfg.brand?.phone || "";
  const site = cfg.website;
  const audienceSegment = article.target_audience_segment || article.target_audience_hint || "homeowners considering a fast sale";

  const langInstr = langs.includes("es")
    ? `Produce BOTH versions:\n- English version in body_md\n- Spanish version in body_md_es (rewrite natural, not machine-translated)\n`
    : `Produce English only in body_md.\n`;

  return `You are El Escriba, content writer sub-agent. Modo: draft_article.
${commonHeader(cfg)}

Draft to produce:
- title: "${title}"
- content_type: ${type}
- pillar: ${pillar}
- target_keyword: "${keyword}"
- intent_query: "${intent}"
- target_audience_segment: ${audienceSegment}
- word count: ${minW}-${maxW}
${langInstr}

SEO & content rules:
1. H1 contains target_keyword naturally (no stuffing).
2. First 150 chars answer the intent_query directly (AI Overviews love this — Google SGE, ChatGPT, Perplexity).
3. H2/H3 semantic subheadings. Mobile-first: paragraphs 2-4 lines MAX, lots of white space, scannable.
4. Include at least 3 specific, citable data points (state stats, law references, market data) with source.
5. End with a FAQ section (3-5 Qs) if content_type is blog_post, q_and_a_page, or pillar_page.
6. Insert ONE natural CTA to ${site}/get-my-offer/ contextualized to the reader's situation (not pushy).
7. Propose 3-5 internal links to other pages of ${site} (use placeholder URLs; Jorge fills in).
8. Propose 2-3 external citations to authoritative sources (gov, .edu, ${state} official sites).
9. Tone: ${cfg.content_goals?.tone || "professional"}. Real estate Wisconsin distressed homeowner voice — empathic, educational, NO investor jargon.

Output format (strict):

\`\`\`yaml
---
title: "${title}"
slug: "..."
meta_description: "..." (150-160 chars)
schema_type: Article | FAQPage | Service
target_keyword: "${keyword}"
secondary_keywords: [..., ...]
word_count_en: N
word_count_es: N  (if applicable)
suggested_internal_links:
  - /path-one/
  - /path-two/
external_citations:
  - "Title — publisher — URL"
target_audience_hint: "${audienceSegment}"
backlink_angle: "..."
schema_jsonld: |
  {
    "@context": "https://schema.org",
    ...
  }
---
\`\`\`

## BODY (English)

{full article body here — markdown with H1/H2/H3, paragraphs, bullets where natural, FAQ block if applicable, inline links, final CTA}

${langs.includes("es") ? `## BODY (Spanish)\n\n{full article body in Spanish — natural rewrite, not translation}\n` : ""}

Produce the article now. Be specific to ${state}. Cite real data (WI foreclosure stats, probate timelines, DATCP, etc.). Keep mobile readability top priority.`;
}

function buildPromptOnDemand(cfg, args) {
  // Synthesize an article plan from CLI args and fall through to draft logic.
  return buildPromptDraftArticle(cfg, {
    title: args.title || "Untitled on-demand article",
    target_keyword: args.targetKeyword || "",
    intent_query: args.title || "",
    content_type: "blog_post",
    pillar: "on_demand",
    target_audience_segment: "homeowners",
  });
}

// ===== Main =====

async function main() {
  const args = parseArgs(process.argv);
  const cfg = await loadTenant(args.tenant);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const cqTable = contentQueueTable(cfg);

  console.error(`[escriba] tenant=${cfg.tenant_id} mode=${args.mode} run_id=${runId} dry_run=${args.dryRun}`);

  // For modes other than atp_mine / on_demand, pull context from Airtable.
  let lastSeoSummary = "";
  let plannedArticle = null;

  if (args.mode === "plan_week" && !args.dryRun) {
    const seoRes = await airtableFetch(cfg, seoAuditTable(cfg),
      "filterByFormula=AND(%7Btenant_id%7D%3D%22" + encodeURIComponent(cfg.tenant_id) + "%22%2C%7Bstatus%7D%3D%22Done%22)" +
      "&sort%5B0%5D%5Bfield%5D=completed_at&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=1"
    );
    const latest = seoRes.records?.[0]?.fields || {};
    lastSeoSummary = [
      latest.top_issues ? `Issues:\n${latest.top_issues}` : "",
      latest.competitor_gaps ? `Gaps:\n${latest.competitor_gaps}` : "",
      latest.recommendations ? `Recommendations:\n${latest.recommendations}` : "",
    ].filter(Boolean).join("\n\n").slice(0, 4000);
  }

  if (args.mode === "draft_article" && args.articleId && !args.dryRun) {
    const res = await airtableFetch(cfg, cqTable, `filterByFormula=${encodeURIComponent(`{run_id}='${args.articleId}'`)}&maxRecords=1`);
    plannedArticle = res.records?.[0]?.fields || null;
    if (!plannedArticle) {
      console.error(`[escriba] article not found: ${args.articleId}`);
      process.exit(1);
    }
  }

  // Build prompt based on mode
  let prompt;
  if (args.mode === "atp_mine")       prompt = buildPromptAtpMine(cfg);
  else if (args.mode === "plan_week") prompt = buildPromptPlanWeek(cfg, lastSeoSummary);
  else if (args.mode === "draft_article") {
    const article = plannedArticle || { title: args.title, target_keyword: args.targetKeyword };
    prompt = buildPromptDraftArticle(cfg, article);
  }
  else if (args.mode === "on_demand") prompt = buildPromptOnDemand(cfg, args);

  if (args.dryRun) {
    console.log("=== DRY RUN — prompt that would be sent to claude ===");
    console.log(prompt);
    console.log("\n=== No subprocess, no Airtable, no Telegram, no WP publish. ===");
    return;
  }

  // Queue record
  await airtableUpsert(cfg, cqTable, runId, {
    tenant_id: cfg.tenant_id,
    status: "Drafting",
    content_type: args.mode === "atp_mine" ? "atp_question" : (plannedArticle?.content_type || "blog_post"),
    trigger: process.env.ESCRIBA_TRIGGER || "alex_manual",
  });

  await mkdir(OUTPUT_DIR, { recursive: true });

  let claudeOut = "";
  try {
    claudeOut = await runClaude(cfg.claude.binary_path, prompt);
  } catch (e) {
    await airtableUpsert(cfg, cqTable, runId, { status: "Rejected", review_notes: `Run failed: ${e.message}` });
    await telegramSend(cfg, `❌ *El Escriba — ${cfg.tenant_name}*\nmode: \`${args.mode}\`\nerror: \`${e.message}\``);
    process.exit(1);
  }

  const completedAt = new Date().toISOString();
  const mdPath = join(OUTPUT_DIR, `${runId}.md`);
  await writeFile(mdPath, claudeOut, "utf8");

  // Status after completion depends on mode
  let finalStatus = "Review";
  if (args.mode === "atp_mine")   finalStatus = "Research";
  if (args.mode === "plan_week")  finalStatus = "Planned";
  if (args.mode === "draft_article" || args.mode === "on_demand") finalStatus = "Review";

  const commonFields = {
    status: finalStatus,
    body_md: claudeOut.slice(0, 100000),
    review_notes: `Raw saved to ${mdPath}`,
    tokens_used: Math.round(claudeOut.length / 4), // rough estimate; real token usage tracked separately
  };

  await airtableUpsert(cfg, cqTable, runId, commonFields);

  // Telegram summary (never includes full content — just pointer)
  const label = {
    atp_mine: "📋 ATP questions minadas",
    plan_week: "📅 Content plan semanal",
    draft_article: "📝 Draft listo para review",
    on_demand: "📝 Draft on-demand listo",
  }[args.mode];

  await telegramSend(cfg,
    `${label} — *${cfg.tenant_name}*\n` +
    `mode: \`${args.mode}\`\n` +
    `run_id: \`${runId.slice(0, 8)}\`\n` +
    `Review en Airtable Content_Queue.`
  );

  console.error(`[escriba] done run_id=${runId} status=${finalStatus} bytes=${claudeOut.length}`);
}

main().catch((e) => { console.error("[escriba] FATAL:", e); process.exit(1); });
