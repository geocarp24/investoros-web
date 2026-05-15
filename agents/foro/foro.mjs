#!/usr/bin/env node
/**
 * El Foro — Reddit community engagement agent (SKELETON, dry-run by default).
 *
 * Spec: agents/foro/SKILL.md
 *
 * Status (2026-05-15): Skeleton — generates value-add reply drafts via claude --print,
 * writes them to Airtable Reddit_Threads table for human review + manual posting.
 *
 * NEVER auto-posts to Reddit. Drafts only.
 *
 * Usage:
 *   node agents/foro/foro.mjs --tenant <slug> --mode monitor [--dry-run]
 *   node agents/foro/foro.mjs --tenant <slug> --mode original_post [--dry-run]
 *   node agents/foro/foro.mjs --tenant <slug> --mode followup --thread-id <rec> [--dry-run]
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

const VALID_MODES = ["monitor", "original_post", "followup"];

function parseArgs(argv) {
  const args = { mode: "monitor", dryRun: false, tenant: null, threadId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant" || a === "-t") args.tenant = argv[++i];
    else if (a === "--mode" || a === "-m") args.mode = argv[++i];
    else if (a === "--thread-id") args.threadId = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: foro.mjs --tenant <slug> --mode monitor|original_post|followup [--dry-run]");
      process.exit(0);
    }
  }
  return args;
}

async function loadTenant(slug) {
  const path = join(TENANTS_DIR, `${slug}.json`);
  return JSON.parse(await readFile(path, "utf-8"));
}

/**
 * Fetch new threads from a subreddit (public JSON API, no auth required).
 * Returns array of {url, title, body, score, num_comments, age_hours}.
 */
async function fetchSubredditNew(subreddit, limit = 25) {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GeoCarpentry-Foro/1.0 (research only, no auto-post)" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const now = Date.now() / 1000;
    return (data?.data?.children ?? []).map((c) => ({
      url: `https://reddit.com${c.data.permalink}`,
      title: c.data.title,
      body: (c.data.selftext ?? "").slice(0, 400),
      score: c.data.score,
      num_comments: c.data.num_comments,
      age_hours: Math.round((now - c.data.created_utc) / 3600),
      subreddit: subreddit,
    }));
  } catch (e) {
    console.error(`[foro] fetch ${subreddit} failed:`, e.message);
    return [];
  }
}

function scoreThread(t, cfg) {
  const intent = cfg.foro?.intent_keywords ?? [];
  const geo = cfg.foro?.geo_modifiers ?? [];
  const haystack = (t.title + " " + t.body).toLowerCase();
  const intentHits = intent.filter((k) => haystack.includes(k.toLowerCase())).length;
  const geoHits = geo.filter((k) => haystack.includes(k.toLowerCase())).length;
  const subWeight = (cfg.foro?.subreddits ?? []).find((s) => s.name.toLowerCase() === t.subreddit.toLowerCase())?.weight ?? 1;
  const recencyBonus = t.age_hours < 12 ? 2 : t.age_hours < 48 ? 1 : 0.5;
  return intentHits * 3 + geoHits * 4 + recencyBonus * subWeight;
}

function runClaude(binary, prompt, timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const allowedTools = "WebFetch,WebSearch,Read,Write,Glob,Grep";
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

function buildPromptMonitor(cfg, threads) {
  const top = threads.slice(0, 10);
  const tenantBlurb = `${cfg.tenant_name} (${cfg.industry}, market: ${cfg.markets?.[0]?.cities_primary?.slice(0, 5)?.join(", ") ?? "Northeast Wisconsin"})`;
  const tone = cfg.foro?.tone ?? "warm, helpful neighbor, specific & detailed, no fluff, no marketing language";
  return `You are El Foro, Reddit community engagement sub-agent for ${tenantBlurb}.

You have ${top.length} high-intent threads to consider for value-add replies. For EACH thread, draft a reply (2-4 paragraphs, max 500 chars per paragraph) that:
- Answers the question with specifics (cost ranges, permit specifics, decision frameworks)
- References Wisconsin / Northeast WI context when relevant (geo-modified replies rank higher in Google Voice + Reddit's own search)
- Does NOT mention ${cfg.tenant_name} or push any product
- Sounds like a helpful neighbor (tone: ${tone})

Format:

\`\`\`
### Thread N — r/{subreddit}
URL: {url}
Title: {title}
Excerpt: {first 100 chars body}
Intent score: {score}/10
---
draft_text:
"...3-4 paragraph reply..."
---
mentions_geo: false  // always false for reply drafts unless thread directly asks "anyone in NE WI?"
recommended_action: reply | skip | monitor_only
rationale: "...1 sentence why this is worth Jefe's time..."
\`\`\`

Threads to draft for:
${top.map((t, i) => `${i + 1}. r/${t.subreddit}: "${t.title}" (score=${t.score}, comments=${t.num_comments}, age=${t.age_hours}h)
   URL: ${t.url}
   Excerpt: ${t.body.slice(0, 200)}`).join("\n\n")}

Output the ${top.length} blocks, no preamble.`;
}

function buildPromptOriginalPost(cfg) {
  return `You are El Foro. Draft ONE original Reddit thread for ${cfg.tenant_name} to post in r/Wisconsin OR r/GreenBay this week.

Goal: value-bomb that earns 50+ upvotes + 20+ comments + 2-3 DMs from interested homeowners.

Format:
\`\`\`
subreddit: r/Wisconsin | r/GreenBay (pick one + explain why)
title: "..." (max 100 chars, hooky, no clickbait)
body: "..." (3-6 paragraphs, helpful, specific data, ends with open-ended question to drive comments)
opening_replies: 3 anticipated user questions + drafts of Jefe's helpful replies (this is how AMAs go from 5 upvotes to 50)
risk_check: any subreddit rules this could violate? any phrasing that smells promotional?
\`\`\`

Tone: ${cfg.foro?.tone ?? "warm helpful neighbor, specific, no fluff"}

Topics from seed bank (pick the freshest / most timely for May 2026):
- 10 things from 50 Brown County kitchen remodels
- Why WI winters destroy badly-built decks (and how to spot a bad install)
- Stock vs custom cabinets 2026 — honest contractor breakdown
- Permit process for home additions in Brown County (with real timeline numbers)
- Should you DIY your deck or hire a pro? (with specific cost & risk breakdown)
- Or invent a better topic that fits Geo's expertise this month.

Output the single block, no preamble.`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.tenant) { console.error("ERROR: --tenant required"); process.exit(2); }
  if (!VALID_MODES.includes(args.mode)) {
    console.error(`ERROR: invalid --mode (use: ${VALID_MODES.join(", ")})`); process.exit(2);
  }

  const cfg = await loadTenant(args.tenant);
  if (!cfg.foro) {
    console.error(`ERROR: tenant ${args.tenant} has no 'foro' config block`); process.exit(2);
  }
  if (cfg.foro.enabled !== true && !args.dryRun) {
    console.error(`ERROR: foro not enabled (set foro.enabled=true or use --dry-run)`); process.exit(2);
  }

  const runId = randomUUID();
  console.log(`[foro] tenant=${args.tenant} mode=${args.mode} run_id=${runId} dry_run=${args.dryRun}`);

  let prompt;
  if (args.mode === "monitor") {
    console.log(`[foro] fetching threads from ${cfg.foro.subreddits.length} subreddits...`);
    const all = [];
    for (const sub of cfg.foro.subreddits) {
      const threads = await fetchSubredditNew(sub.name, 25);
      all.push(...threads);
    }
    console.log(`[foro] fetched ${all.length} threads`);
    const scored = all.map((t) => ({ ...t, _score: scoreThread(t, cfg) })).sort((a, b) => b._score - a._score);
    prompt = buildPromptMonitor(cfg, scored);
  } else if (args.mode === "original_post") {
    prompt = buildPromptOriginalPost(cfg);
  } else if (args.mode === "followup") {
    if (!args.threadId) { console.error("ERROR: --thread-id required"); process.exit(2); }
    console.log("[foro] followup mode: TODO — fetch record from Airtable, generate next reply");
    process.exit(0);
  }

  if (args.dryRun) {
    console.log("=== DRY RUN — prompt that would be sent to claude ===\n");
    console.log(prompt);
    console.log("\n=== No subprocess, no Airtable. ===");
    return;
  }

  const binary = cfg.claude?.binary_path ?? "claude";
  const output = await runClaude(binary, prompt);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outFile = join(OUTPUT_DIR, `${runId}.md`);
  await writeFile(outFile, output, "utf-8");
  console.log(`[foro] output saved to ${outFile}`);
  console.log("[foro] TODO: parse output → write records to Reddit_Threads Airtable table");
  console.log(`[foro] done run_id=${runId} mode=${args.mode}`);
}

main().catch((e) => { console.error("[foro] FATAL:", e.message); process.exit(1); });
