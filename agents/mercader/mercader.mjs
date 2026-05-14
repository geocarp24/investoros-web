#!/usr/bin/env node
/**
 * El Mercader — marketing operations orchestrator.
 * Usage:
 *   node agents/mercader/mercader.mjs --tenant <slug> --mode quick_health|deep_audit|on_demand [--dry-run]
 *
 * Reads agents/tenants/<slug>.yaml, spawns claude CLI with the skills configured
 * for the mode, parses output, persists to Airtable, sends Telegram summary.
 *
 * SaaS multi-tenant per R8 — NO hardcoded tenant data.
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

// ----- CLI args -----
function parseArgs(argv) {
  const args = { mode: "quick_health", dryRun: false, tenant: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant" || a === "-t") args.tenant = argv[++i];
    else if (a === "--mode" || a === "-m") args.mode = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: mercader.mjs --tenant <slug> --mode quick_health|deep_audit|on_demand [--dry-run]");
      process.exit(0);
    }
  }
  if (!args.tenant) { console.error("ERROR: --tenant <slug> required"); process.exit(2); }
  if (!/^[a-z0-9_-]+$/.test(args.tenant)) { console.error("ERROR: tenant slug must match [a-z0-9_-]+"); process.exit(2); }
  if (!["quick_health", "deep_audit", "on_demand"].includes(args.mode)) { console.error("ERROR: invalid --mode"); process.exit(2); }
  return args;
}

// ----- Minimal YAML parser REPLACED WITH JSON (R1 surgical) -----
// Tenant configs live as agents/tenants/<slug>.json — Node parses natively, zero deps.

// ----- Tenant config loader -----
async function loadTenant(slug) {
  const p = join(TENANTS_DIR, `${slug}.json`);
  const raw = await readFile(p, "utf8");
  const cfg = JSON.parse(raw);
  const required = ["tenant_id", "website", "claude"];
  for (const k of required) if (cfg[k] == null) throw new Error(`tenant.${k} missing in ${p}`);
  return cfg;
}

// ----- Claude CLI subprocess -----
function runClaude(binary, prompt, timeoutMs = 20 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const args = ["--print", "--permission-mode", "acceptEdits", prompt];
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
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

// ----- Airtable helpers (all guarded — skip gracefully if not configured) -----
async function airtableUpsert(cfg, runId, fields) {
  const { base_id, table_id, token_env } = cfg.airtable || {};
  const token = process.env[token_env];
  if (!base_id || !table_id || !token) {
    console.error("[mercader] airtable not configured; skipping write");
    return null;
  }
  const url = `https://api.airtable.com/v0/${base_id}/${table_id}`;
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

// ----- Telegram alert -----
async function telegramSend(cfg, text) {
  const { chat_id_env, bot_token_env } = cfg.telegram || {};
  const token = process.env[bot_token_env];
  const chat = process.env[chat_id_env];
  if (!token || !chat) { console.error("[mercader] telegram not configured; skipping alert"); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ chat_id: chat, text, parse_mode: "Markdown" }).toString(),
    });
  } catch (e) { console.error("[mercader] telegram error:", e.message); }
}

// ----- Output parsing (extracts score + top issues from claude output) -----
function parseAuditOutput(text) {
  const scoreMatch = text.match(/(?:overall |total |marketing )?score[:\s]+(\d{1,3})\s*(?:\/\s*100)?/i);
  const score = scoreMatch ? Math.min(100, Math.max(0, Number.parseInt(scoreMatch[1], 10))) : null;
  const issuesBlock = (text.match(/(?:top\s+)?(?:critical\s+)?issues?[^\n]*\n([\s\S]{1,1500}?)(?:\n\s*\n|##\s|$)/i) || [])[1] || "";
  const winsBlock   = (text.match(/(?:top\s+)?(?:wins?|strengths?)[^\n]*\n([\s\S]{1,1500}?)(?:\n\s*\n|##\s|$)/i) || [])[1] || "";
  const recsBlock   = (text.match(/(?:recommendations?|next\s+steps?)[^\n]*\n([\s\S]{1,2000}?)(?:\n\s*\n|##\s|$)/i) || [])[1] || "";
  return {
    score,
    top_issues: issuesBlock.trim().slice(0, 1500),
    top_wins:   winsBlock.trim().slice(0, 1500),
    recommendations: recsBlock.trim().slice(0, 2000),
  };
}

// ----- Build claude prompt for a given mode -----
function buildPrompt(cfg, mode) {
  const skills = (cfg.skills && cfg.skills[mode]) || [];
  const site = cfg.website;
  const tenant = cfg.tenant_name;
  const competitors = (cfg.competitors || []).map(c => `- ${c.name}: ${c.url}`).join("\n") || "(none configured)";
  if (mode === "quick_health") {
    return `You are El Mercader, an always-on marketing sub-agent. Run a /market quick analysis on ${site} for tenant "${tenant}". Produce a concise report with: overall Score: N/100, Top Issues (3), Top Wins (3), Recommendations (3). Be terse — one line per bullet. Output format: plain markdown. Do NOT use other tools beyond the market-quick skill.`;
  }
  if (mode === "deep_audit") {
    return `You are El Mercader, an always-on marketing sub-agent. For tenant "${tenant}" on ${site}, run in sequence:\n1) /market audit ${site}\n2) /market competitors ${site} — competitors:\n${competitors}\n3) Aggregate both into a single client-ready report.\n\nReport format:\n# ${tenant} — Weekly Marketing Audit (${new Date().toISOString().slice(0,10)})\n\n## Overall Score: N/100\n\n## Top 3 Critical Issues\n- ...\n\n## Top 3 Wins\n- ...\n\n## Priority Recommendations\n- ...\n\n## Competitive Position\n- ...\n\nBe specific and actionable.`;
  }
  return `You are El Mercader. Run on-demand analysis for ${site}. Skills available: ${skills.join(", ") || "market-audit"}. Produce markdown report with Score, Issues, Wins, Recommendations.`;
}

// ----- Main -----
async function main() {
  const args = parseArgs(process.argv);
  const cfg = await loadTenant(args.tenant);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  console.error(`[mercader] tenant=${cfg.tenant_id} mode=${args.mode} run_id=${runId} dry_run=${args.dryRun}`);

  // Queue record in Airtable
  if (!args.dryRun) {
    await airtableUpsert(cfg, runId, {
      tenant_id: cfg.tenant_id,
      audit_type: args.mode,
      status: "Running",
      trigger: process.env.MERCADER_TRIGGER || "alex_manual",
      started_at: startedAt,
    });
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const prompt = buildPrompt(cfg, args.mode);

  if (args.dryRun) {
    console.log("=== DRY RUN — prompt that would be sent to claude ===");
    console.log(prompt);
    console.log("\n=== No subprocess spawned, no Airtable write, no Telegram send. ===");
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
    await telegramSend(cfg, `❌ *El Mercader — ${cfg.tenant_name}*\nmode: \`${args.mode}\`\nerror: \`${e.message}\``);
    process.exit(1);
  }

  const parsed = parseAuditOutput(claudeOut);
  const completedAt = new Date().toISOString();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);

  // Save raw markdown next to the run
  const mdPath = join(OUTPUT_DIR, `${runId}.md`);
  await writeFile(mdPath, claudeOut, "utf8");

  // Persist to Airtable
  const fields = {
    status: "Done",
    completed_at: completedAt,
    duration_sec: duration,
    score: parsed.score,
    top_issues: parsed.top_issues,
    top_wins: parsed.top_wins,
    recommendations: parsed.recommendations,
    summary_md: claudeOut.slice(0, 100000),
    report_url: mdPath,
  };
  await airtableUpsert(cfg, runId, fields);

  // Telegram summary
  const emoji = parsed.score == null ? "📊" : parsed.score < (cfg.alert_thresholds?.critical_score ?? 50) ? "🚨" : parsed.score < (cfg.alert_thresholds?.warn_score ?? 70) ? "⚠️" : "✅";
  const scoreLine = parsed.score == null ? "" : ` · Score: *${parsed.score}/100*`;
  const head = `${emoji} *El Mercader — ${cfg.tenant_name}*\nmode: \`${args.mode}\`${scoreLine}`;
  const body = [
    parsed.top_issues ? `\n*Top issues:*\n${parsed.top_issues.split("\n").slice(0, 6).join("\n")}` : "",
    parsed.recommendations ? `\n*Next:*\n${parsed.recommendations.split("\n").slice(0, 4).join("\n")}` : "",
  ].join("");
  await telegramSend(cfg, (head + body).slice(0, 3900));

  console.error(`[mercader] done run_id=${runId} score=${parsed.score} duration=${duration}s`);
}

main().catch((e) => { console.error("[mercader] FATAL:", e); process.exit(1); });
