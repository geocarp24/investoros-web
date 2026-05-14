/**
 * agents/_shared/runner.mjs — shared runtime for R9 sub-agents.
 *
 * Factored out from Mercader/Posicionador/Escriba/Remitente/Cazador
 * which all shared ~75% of the same plumbing. New agents (Clasificador,
 * Analista, Espia, Auditor) use this directly as thin wrappers.
 *
 * Exposes:
 *   parseArgs(argv, validModes, extraFlags?)  — CLI flag parser
 *   loadTenant(slug)                          — reads agents/tenants/<slug>.json
 *   runClaude(binary, prompt, timeoutMs?)     — spawns claude --print subprocess
 *   airtableFetch(cfg, tableKey, params?)     — GET records
 *   airtableUpsert(cfg, tableKey, runId, fields)  — PATCH by run_id OR POST new
 *   airtableCreate(cfg, tableKey, fields)     — POST new
 *   telegramSend(cfg, text)                   — Markdown msg
 *   extractScore(text, labelRegex)            — pulls "label score: N/100"
 *   extractNumber(text, labelRegex)           — pulls "label: $N"
 *   extractBlock(text, headerRegex)           — section after markdown header
 *   genRunId()                                — UUID v4
 *
 * Every R9 agent should call main() with a config object, not implement its
 * own orchestration from scratch.
 */
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
export const TENANTS_DIR = join(ROOT, "agents", "tenants");

// ===== CLI parsing =====
export function parseArgs(argv, validModes, extraFlags = {}) {
  const a = { mode: validModes[0], dryRun: false, tenant: null };
  for (const k of Object.keys(extraFlags)) a[k] = extraFlags[k];

  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--tenant" || k === "-t") a.tenant = argv[++i];
    else if (k === "--mode" || k === "-m") a.mode = argv[++i];
    else if (k === "--dry-run") a.dryRun = true;
    else if (k === "--help" || k === "-h") {
      console.log(`Usage: <script>.mjs --tenant <slug> --mode ${validModes.join("|")} [--dry-run] ${Object.keys(extraFlags).map(f => `[--${f.replace(/[A-Z]/g,m => "-"+m.toLowerCase())} X]`).join(" ")}`);
      process.exit(0);
    } else if (k.startsWith("--")) {
      // Auto-map --some-flag to extraFlags.someFlag (camelCase)
      const clean = k.replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (clean in a) a[clean] = argv[++i];
    }
  }

  if (!a.tenant) { console.error("ERROR: --tenant <slug> required"); process.exit(2); }
  if (!/^[a-z0-9_-]+$/.test(a.tenant)) { console.error("ERROR: tenant slug must match [a-z0-9_-]+"); process.exit(2); }
  if (!validModes.includes(a.mode)) { console.error(`ERROR: --mode must be one of ${validModes.join(", ")}`); process.exit(2); }
  return a;
}

// ===== Tenant config =====
export async function loadTenant(slug) {
  const p = join(TENANTS_DIR, `${slug}.json`);
  const raw = await readFile(p, "utf8");
  const cfg = JSON.parse(raw);
  for (const k of ["tenant_id", "website", "claude"]) {
    if (cfg[k] == null) throw new Error(`tenant.${k} missing in ${p}`);
  }
  return cfg;
}

// ===== Claude CLI subprocess =====
export function runClaude(binary, prompt, timeoutMs = 25 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ["--print", "--permission-mode", "acceptEdits", prompt], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("timeout")); }, timeoutMs);
    child.stdout.on("data", (d) => out += d);
    child.stderr.on("data", (d) => err += d);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 500)}`));
      resolve(out);
    });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

// ===== Airtable helpers =====
function atTableId(cfg, tableKey) {
  // tableKey examples: "table_id" (Marketing_Audits), "seo_table_id", "ads_table_id",
  // "content_queue_table_id", "email_campaigns_table_id", etc.
  return cfg.airtable?.[tableKey] || cfg.airtable?.table_id || null;
}

export async function airtableFetch(cfg, tableKey, params = "") {
  const base = cfg.airtable?.base_id;
  const table = atTableId(cfg, tableKey);
  const token = process.env[cfg.airtable?.token_env || "AIRTABLE_TOKEN"];
  if (!base || !table || !token) return { records: [] };
  const url = `https://api.airtable.com/v0/${base}/${table}${params ? "?" + params : ""}`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return await r.json();
  } catch {
    return { records: [] };
  }
}

export async function airtableCreate(cfg, tableKey, fields) {
  const base = cfg.airtable?.base_id;
  const table = atTableId(cfg, tableKey);
  const token = process.env[cfg.airtable?.token_env || "AIRTABLE_TOKEN"];
  if (!base || !table || !token) {
    console.error(`[shared] airtable not configured for tableKey=${tableKey}; skipping`);
    return null;
  }
  const r = await fetch(`https://api.airtable.com/v0/${base}/${table}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return await r.json();
}

export async function airtableUpdate(cfg, tableKey, recordId, fields) {
  const base = cfg.airtable?.base_id;
  const table = atTableId(cfg, tableKey);
  const token = process.env[cfg.airtable?.token_env || "AIRTABLE_TOKEN"];
  if (!base || !table || !token) return null;
  const r = await fetch(`https://api.airtable.com/v0/${base}/${table}/${recordId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return await r.json();
}

// Upsert by matching run_id (common pattern across agents).
export async function airtableUpsert(cfg, tableKey, runId, fields) {
  const base = cfg.airtable?.base_id;
  const table = atTableId(cfg, tableKey);
  const token = process.env[cfg.airtable?.token_env || "AIRTABLE_TOKEN"];
  if (!base || !table || !token) {
    console.error(`[shared] airtable not configured for tableKey=${tableKey}; skipping upsert`);
    return null;
  }
  const existing = await airtableFetch(cfg, tableKey,
    `filterByFormula=${encodeURIComponent(`{run_id}='${runId}'`)}&maxRecords=1`);
  if (existing.records && existing.records.length > 0) {
    return airtableUpdate(cfg, tableKey, existing.records[0].id, fields);
  }
  return airtableCreate(cfg, tableKey, { run_id: runId, ...fields });
}

// ===== Telegram =====
export async function telegramSend(cfg, text) {
  const token = process.env[cfg.telegram?.bot_token_env || "TELEGRAM_BOT_TOKEN"];
  const chat = process.env[cfg.telegram?.chat_id_env || "TELEGRAM_CHAT_ID"];
  if (!token || !chat) {
    console.error("[shared] telegram not configured; skipping");
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        chat_id: chat,
        text: text.slice(0, 3900),
        parse_mode: "Markdown",
      }).toString(),
    });
  } catch (e) {
    console.error("[shared] telegram error:", e.message);
  }
}

// ===== Output parsers =====
export function extractScore(text, labelRegex) {
  const re = new RegExp(`${labelRegex}[^\\n]*?(?:score|:)[:\\s]+(\\d{1,3})(?:\\s*\\/\\s*100)?`, "i");
  const m = text.match(re);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

export function extractNumber(text, labelRegex) {
  const re = new RegExp(`${labelRegex}[^\\n]*?[:$]?\\s*\\$?\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
  const m = text.match(re);
  return m ? parseFloat(m[1]) : null;
}

export function extractBlock(text, headerRegex, maxLen = 2500) {
  const re = new RegExp(`(?:${headerRegex})[^\\n]*\\n([\\s\\S]{1,${maxLen + 500}}?)(?:\\n\\s*\\n|\\n#{1,3}\\s|$)`, "i");
  return ((text.match(re) || [, ""])[1] || "").trim().slice(0, maxLen);
}

// ===== Utilities =====
export function genRunId() {
  return randomUUID();
}

export function isoNow() {
  return new Date().toISOString();
}

// ===== Generic "main loop" for agents that follow the standard pattern =====
// Agent just provides: validModes + buildPrompt(cfg, args) + parseOutput(text)
//                    + (optional) persistRun(cfg, runId, fields) + buildTelegramMsg(cfg, parsed, runId)
// This main() wires everything up.
export async function standardMain({
  agentName,
  validModes,
  extraFlags,
  buildPrompt,
  parseOutput,
  tableKey,
  telegramFormatter,
}) {
  const args = parseArgs(process.argv, validModes, extraFlags);
  const cfg = await loadTenant(args.tenant);
  const runId = genRunId();
  const startedAt = isoNow();

  console.error(`[${agentName}] tenant=${cfg.tenant_id} mode=${args.mode} run_id=${runId} dry_run=${args.dryRun}`);

  const prompt = await buildPrompt(cfg, args);

  if (args.dryRun) {
    console.log(`=== DRY RUN [${agentName}] — prompt that would be sent to claude ===`);
    console.log(prompt);
    console.log("\n=== No subprocess, no Airtable, no Telegram. ===");
    return;
  }

  if (tableKey) {
    await airtableUpsert(cfg, tableKey, runId, {
      tenant_id: cfg.tenant_id,
      audit_type: args.mode,
      status: "Running",
      trigger: process.env[`${agentName.toUpperCase()}_TRIGGER`] || "alex_manual",
      started_at: startedAt,
    });
  }

  let out = "";
  try {
    out = await runClaude(cfg.claude.binary_path, prompt);
  } catch (e) {
    if (tableKey) {
      await airtableUpsert(cfg, tableKey, runId, {
        status: "Failed",
        completed_at: isoNow(),
      });
    }
    await telegramSend(cfg, `❌ *${agentName} — ${cfg.tenant_name}*\nmode: \`${args.mode}\`\nerror: \`${e.message}\``);
    process.exit(1);
  }

  const parsed = parseOutput ? parseOutput(out) : {};
  const completedAt = isoNow();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);

  if (tableKey) {
    await airtableUpsert(cfg, tableKey, runId, {
      status: "Done",
      completed_at: completedAt,
      duration_sec: duration,
      ...parsed,
    });
  }

  const msg = telegramFormatter ? telegramFormatter(cfg, args, parsed, runId) : `✅ *${agentName}* — ${cfg.tenant_name} — mode \`${args.mode}\` done in ${duration}s`;
  await telegramSend(cfg, msg);

  console.error(`[${agentName}] done run_id=${runId} duration=${duration}s`);
  return { runId, parsed, raw: out };
}
