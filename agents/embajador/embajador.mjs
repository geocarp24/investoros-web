#!/usr/bin/env node
/**
 * El Embajador — LinkedIn B2B outreach agent (SKELETON, dry-run by default).
 *
 * Spec: agents/embajador/SKILL.md
 *
 * Status (2026-05-15): Skeleton — generates drafts via claude --print,
 * writes them to Airtable LinkedIn_Outreach table for human review + manual send.
 *
 * NEVER auto-sends LinkedIn actions. The `--activate` flag is reserved for
 * future automation only AFTER Jefe validates one manual cycle works.
 *
 * Usage:
 *   node agents/embajador/embajador.mjs --tenant <slug> --mode prepare_batch [--dry-run]
 *   node agents/embajador/embajador.mjs --tenant <slug> --mode followup --record-id <rec> [--dry-run]
 *   node agents/embajador/embajador.mjs --tenant <slug> --mode audit_pipeline [--dry-run]
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

const VALID_MODES = ["prepare_batch", "followup", "audit_pipeline"];

function parseArgs(argv) {
  const args = { mode: "prepare_batch", dryRun: false, tenant: null, recordId: null, activate: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant" || a === "-t") args.tenant = argv[++i];
    else if (a === "--mode" || a === "-m") args.mode = argv[++i];
    else if (a === "--record-id") args.recordId = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--activate") args.activate = true; // reserved — never sends now
    else if (a === "--help" || a === "-h") {
      console.log("Usage: embajador.mjs --tenant <slug> --mode prepare_batch|followup|audit_pipeline [--dry-run]");
      process.exit(0);
    }
  }
  return args;
}

async function loadTenant(slug) {
  const path = join(TENANTS_DIR, `${slug}.json`);
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw);
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

function buildPromptPrepareBatch(cfg) {
  const e = cfg.embajador ?? {};
  const cities = cfg.markets?.[0]?.cities_primary?.slice(0, 8)?.join(", ") ?? "Northeast Wisconsin";
  const valueProps = (e.value_props ?? []).map((v) => `- ${v}`).join("\n");
  const personalizationSignals = (e.personalization_signals ?? []).map((s) => `- ${s}`).join("\n");

  return `You are El Embajador, LinkedIn B2B outreach sub-agent. Generate a batch of 10 ranked connection-request drafts for ${cfg.tenant_name} (${cfg.industry}).

Target ICP: real estate investors, property managers, architects, interior designers in ${cities} (the tenant's primary market).

For EACH prospect (10 total), output a record block:

\`\`\`
### Prospect N
- target_name: "(use a realistic placeholder — Jefe will replace with real prospect found via LinkedIn search)"
- target_role: "...role..."
- target_company: "...company..."
- target_city: "...one of the cities above..."
- target_linkedin_url: "https://www.linkedin.com/in/PLACEHOLDER"
- personalization_hook: "...1-2 sentences why this prospect is a good fit (signal: ${personalizationSignals.split("\n")[0]?.replace(/^- /, "") ?? "shared market"})..."
- draft_text: "..." (max 200 chars, no pitch, value-first, in the tenant's tone: ${e.tone ?? "warm-professional, value-first, never salesy"})
- recommended_followup: "what to do Day 3 / Day 7 / Day 14 if they connect"
\`\`\`

Geo Carpentry value props to draw from:
${valueProps}

CRITICAL RULES for draft_text:
- NEVER mention pricing or push-sell
- NEVER use "Hi {name}, I'd love to connect to talk about..." templates
- DO reference something specific (city, sector, problem they posted about)
- DO offer asymmetric value before asking for anything
- DO sound human, write at 8th-grade reading level

Output the 10 blocks, no preamble.`;
}

function buildPromptFollowup(cfg, record) {
  return `You are El Embajador. A prospect connected. Generate the next-step draft for the nurture sequence (step ${record.sequence_step + 1}).

Prospect:
- name: ${record.target_name}
- role: ${record.target_role}
- company: ${record.target_company}
- city: ${record.target_city}
- previous personalization: ${record.personalization_hook}

Next step type:
- Step 1 (Day 3): like + value comment on one of their recent posts (you don't know post yet — give Jefe the search prompt + draft comment template)
- Step 2 (Day 7): value comment on relevant industry post (draft 3 alternatives Jefe can pick from based on what they're posting)
- Step 3 (Day 14): DM with case study (draft full message, max 600 chars, include "no pressure" close)
- Step 4 (Day 30): soft meeting offer (draft message, propose 20-min call, give 2 calendar options)

Output a single block:
\`\`\`
action_type: like | comment | dm | meeting_offer
draft_text: "..."
recommended_attachment: "(URL or 'none')"
notes: "..."
\`\`\`

Tone: same warm-professional, never salesy, never pushy.`;
}

function buildPromptAudit(cfg) {
  return `You are El Embajador. Audit the current LinkedIn pipeline and report:
1. Prospects in each status (Draft / Pending Action / Connected / etc.)
2. Stuck records (Pending Action > 7 days = nudge Jefe)
3. Engagement quality (replied vs ghosted ratio)
4. 3 recommendations for next week's batch focus

Output concise markdown report, no preamble.`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.tenant) {
    console.error("ERROR: --tenant required"); process.exit(2);
  }
  if (!VALID_MODES.includes(args.mode)) {
    console.error(`ERROR: invalid --mode (use one of: ${VALID_MODES.join(", ")})`); process.exit(2);
  }
  if (args.activate) {
    console.error("REFUSED: --activate is reserved (Embajador NEVER auto-sends LinkedIn actions per SKILL.md). Drafts only.");
    process.exit(3);
  }

  const cfg = await loadTenant(args.tenant);
  if (!cfg.embajador) {
    console.error(`ERROR: tenant ${args.tenant} has no 'embajador' config block (see SKILL.md)`); process.exit(2);
  }
  if (cfg.embajador.enabled !== true && !args.dryRun) {
    console.error(`ERROR: embajador not enabled for ${args.tenant} (set embajador.enabled=true in tenant.json or use --dry-run)`); process.exit(2);
  }

  const runId = randomUUID();
  console.log(`[embajador] tenant=${args.tenant} mode=${args.mode} run_id=${runId} dry_run=${args.dryRun}`);

  let prompt;
  if (args.mode === "prepare_batch") {
    prompt = buildPromptPrepareBatch(cfg);
  } else if (args.mode === "followup") {
    if (!args.recordId) { console.error("ERROR: --record-id required for followup"); process.exit(2); }
    // In real impl: fetch record from Airtable
    const stubRecord = { target_name: "?", target_role: "?", target_company: "?", target_city: "?", personalization_hook: "?", sequence_step: 0 };
    prompt = buildPromptFollowup(cfg, stubRecord);
  } else if (args.mode === "audit_pipeline") {
    prompt = buildPromptAudit(cfg);
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
  console.log(`[embajador] output saved to ${outFile}`);
  console.log("[embajador] TODO: parse output → write records to LinkedIn_Outreach Airtable table");
  console.log(`[embajador] done run_id=${runId} mode=${args.mode}`);
}

main().catch((e) => { console.error("[embajador] FATAL:", e.message); process.exit(1); });
