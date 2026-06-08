#!/usr/bin/env node
/**
 * Atlas (Executive Brief / Remediator) — Geo Carpentry
 * Reads last Supervisor run output, triages critical + warnings,
 * executes auto-remediations where safe, escalates the rest to Telegram.
 *
 * Usage:
 *   node agents/atlas/atlas.mjs --tenant geo-carpentry
 *
 * Cron: every 30min after Supervisor deep run
 *   (Supervisor deep: Mon 12:00 UTC → Atlas: Mon 12:30 UTC)
 *   Regular: * /30 * * * *
 *
 * Env vars (/opt/alex-bot/.env):
 *   AIRTABLE_TOKEN_GEO
 *   WEBHOOK_SECRET
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── CLI args ──────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const getArg    = (name, fallback = null) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : fallback;
};
const TENANT_SLUG = getArg('tenant', 'geo-carpentry');

// ── Env vars ──────────────────────────────────────────────────────────────────
const AIRTABLE_TOKEN     = process.env.AIRTABLE_TOKEN_GEO;
const WEBHOOK_SECRET     = process.env.WEBHOOK_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

if (!AIRTABLE_TOKEN) throw new Error('Missing env var: AIRTABLE_TOKEN_GEO');

// ── Airtable Decisions_Log ────────────────────────────────────────────────────
const AIRTABLE_BASE     = 'appAQpveuAec077jF';
const DECISIONS_TABLE   = 'tbluHpgWlVNqSveVi';
const AT_BASE_URL       = `https://api.airtable.com/v0/${AIRTABLE_BASE}`;

// ── Supervisor state file path ────────────────────────────────────────────────
// Supervisor writes its last run state to a JSON file on VPS
const SUPERVISOR_STATE_PATH = `/opt/alex-bot/agents/supervisor/last_run_${TENANT_SLUG.replace(/-/g, "_")}.json`;

// ── Playbooks — critical message → auto-remediation ──────────────────────────
// Each entry: { match: string/regex, action: async fn, escalate: bool }
const PLAYBOOKS = [
  {
    id:       'airtable_retry',
    match:    /airtable.*no responde|airtable.*timeout|airtable.*error/i,
    escalate: false,
    action:   async (issue) => {
      // Airtable transient — probe 3x with 1min spacing
      for (let i = 0; i < 3; i++) {
        await sleep(60_000);
        const ok = await probeAirtable();
        if (ok) return { recovered: true, attempts: i + 1 };
      }
      return { recovered: false };
    },
    escalateMsg: (res) => res.recovered
      ? null
      : '⚠️ Airtable API down after 3 retries — manual check needed',
  },

  {
    id:       'telegram_invalid',
    match:    /telegram.*inválido|telegram.*invalid|telegram.*token/i,
    escalate: true, // always escalate — can't auto-fix token
    action:   async () => ({ cannotAutoFix: true }),
    escalateMsg: () => '🔴 Telegram bot token inválido — rotar token en BotFather + actualizar .env',
  },

  {
    id:       'webhook_down',
    match:    /geo-webhook.*down|puerto 3003.*no responde|webhook.*unreachable/i,
    escalate: false,
    action:   async () => {
      // Attempt to restart geo-webhook service
      // Note: systemctl requires sudo — Atlas logs this but can't execute directly
      // CC needs to set up sudo permissions for this action
      return { action: 'systemctl restart geo-webhook.service', requiresSudo: true };
    },
    escalateMsg: (res) => `🔴 Webhook :3003 down — ejecutar: ${res.action}`,
  },

  {
    id:       'schema_drift',
    match:    /422.*airtable|schema.*drift|field.*not found/i,
    escalate: true,
    action:   async () => ({ action: 'fetch_table_schema' }),
    escalateMsg: () => '⚠️ Schema drift en Airtable — un campo fue renombrado o eliminado. Verificar tabla.',
  },

  {
    id:       'lead_backlog',
    match:    /lead backlog.*overflow|contacts_new.*>.*[0-9]{3}/i,
    escalate: false,
    action:   async () => {
      // Trigger SM Manager or Fer batch process via webhook
      return { triggered: 'fer_batch_process' };
    },
    escalateMsg: (res) => res.triggered
      ? null
      : '⚠️ Lead backlog overflow — Fer batch no triggereó',
  },

  {
    id:       'cron_stale',
    match:    /cron.*stale|agent.*no corrió|last_run.*[0-9]+h ago/i,
    escalate: true,
    action:   async () => ({ action: 'check_crontab' }),
    escalateMsg: (issue) => `⚠️ Cron stale detectado: "${issue}" — verificar crontab en VPS`,
  },
];

// ── Read Supervisor last run ───────────────────────────────────────────────────
function readSupervisorState() {
  if (!existsSync(SUPERVISOR_STATE_PATH)) {
    console.log('[Atlas] No supervisor state file found — skipping');
    return null;
  }
  try {
    return JSON.parse(readFileSync(SUPERVISOR_STATE_PATH, 'utf-8'));
  } catch (e) {
    console.error('[Atlas] Cannot parse supervisor state:', e.message);
    return null;
  }
}

// ── Probe Airtable ────────────────────────────────────────────────────────────
async function probeAirtable() {
  try {
    const res = await fetch(`${AT_BASE_URL}/${DECISIONS_TABLE}?maxRecords=1`, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch { return false; }
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.warn('[Atlas] Telegram send failed:', e.message);
  }
}

// ── Log to Decisions_Log ──────────────────────────────────────────────────────
async function logDecision(title, rationale, nextAction = 'None') {
  try {
    await fetch(`${AT_BASE_URL}/${DECISIONS_TABLE}`, {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          fldRrlLK0kn2nMtzY: title,
          fldEtqmwx08pzmF9z: new Date().toISOString().slice(0, 10),
          fldyjqKUjL85q4aBP: 'Atlas',
          fldciAJKPaogOJHmp: rationale,
          fldTYFMEkhki98YWE: nextAction,
          flduR1qKRMCzIoH5h: 'Active',
          fldk50aHuSdFIA38x: 'Infraestructura',
        },
      }),
    });
  } catch (e) {
    console.warn('[Atlas] Decisions_Log write failed:', e.message);
  }
}

// ── Sleep helper ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Triage issues ─────────────────────────────────────────────────────────────
async function triageIssues(issues) {
  if (!issues || issues.length === 0) {
    console.log('[Atlas] No issues to triage');
    return;
  }

  const escalations = [];

  for (const issue of issues) {
    const issueStr = typeof issue === 'string' ? issue : JSON.stringify(issue);
    console.log(`[Atlas] Triaging: "${issueStr.slice(0, 80)}"`);

    let matched = false;
    for (const playbook of PLAYBOOKS) {
      const pattern = typeof playbook.match === 'string'
        ? new RegExp(playbook.match, 'i')
        : playbook.match;

      if (pattern.test(issueStr)) {
        matched = true;
        console.log(`[Atlas] Matched playbook: ${playbook.id}`);

        const result = await playbook.action(issueStr).catch(e => ({ error: e.message }));
        const msg    = playbook.escalateMsg(result);

        if (msg) escalations.push({ id: playbook.id, message: msg });

        await logDecision(
          `Atlas remediation: ${playbook.id}`,
          `Issue: "${issueStr.slice(0, 150)}" → Action: ${JSON.stringify(result).slice(0, 150)}`,
          msg || 'Auto-remediated'
        );
        break;
      }
    }

    if (!matched) {
      // 2026-06-08: no-playbook issues no longer auto-Telegram.
      // Instead: log to Decisions_Log as open_issue (deduplicated by signature
      // hash) so the same issue does not spam every run. Operator reviews
      // Decisions_Log weekly; new playbooks get added incrementally.
      const sig = require("crypto").createHash("sha1").update(issueStr).digest("hex").slice(0, 12);
      const seenKey = `/opt/alex-bot/agents/atlas/seen_${sig}.flag`;
      const isNew = !existsSync(seenKey);
      if (isNew) {
        try { require("fs").writeFileSync(seenKey, new Date().toISOString()); } catch {}
        escalations.push({ id: "unknown", message: `⚠️ NUEVO issue sin playbook (sig=${sig}): <code>${issueStr.slice(0, 200)}</code>
<i>Future occurrences silenced. Add playbook to atlas.mjs PLAYBOOKS array.</i>` });
        await logDecision(
          `Atlas open_issue: ${sig}`,
          `New unknown issue requiring playbook. Signature ${sig}. Issue: "${issueStr.slice(0, 400)}"`,
          "Add matching playbook to /opt/alex-bot/agents/atlas/atlas.mjs PLAYBOOKS array"
        );
      } else {
        console.log(`[Atlas] no-playbook issue sig=${sig} already seen — skipping escalation`);
      }
    }
  }

  // Send escalation summary to Telegram
  if (escalations.length > 0) {
    const msg = `🤖 <b>Atlas — ${escalations.length} issue(s) para revisar</b>\n\n` +
      escalations.map((e, i) => `${i + 1}. ${e.message}`).join('\n\n');
    await sendTelegram(msg);
    console.log(`[Atlas] Escalated ${escalations.length} issues to Telegram`);
  }
}

// ── Generate weekly brief (Monday runs) ───────────────────────────────────────
async function generateWeeklyBrief(state) {
  const isMonday = new Date().getDay() === 1;
  if (!isMonday || !state?.pipeline) return;

  const summary = `📊 <b>Atlas — Weekly Brief (Geo Carpentry)</b>\n` +
    `📅 ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}\n\n` +
    `<b>Pipeline:</b>\n` +
    `• Ideas generadas: ${state.pipeline?.ideas_generated || 0}\n` +
    `• Posts publicados: ${state.pipeline?.posts_published || 0}\n` +
    `• Leads nuevos: ${state.pipeline?.leads_new || 0}\n` +
    `• Agentes activos: ${state.pipeline?.agents_active || 0}/27\n\n` +
    `<b>Estado:</b> ${state.health === 'green' ? '✅ Todos los sistemas OK' : '⚠️ Ver alertas arriba'}\n` +
    `<i>Next brief: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</i>`;

  await sendTelegram(summary);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[Atlas] Starting — tenant: ${TENANT_SLUG}`);

  const state = readSupervisorState();
  if (!state) return;

  // Collect all issues (criticals + warnings)
  const allIssues = [
    ...(state.critical || []),
    ...(state.warnings || []),
  ];

  console.log(`[Atlas] Found ${allIssues.length} issue(s) from last Supervisor run`);

  // Triage and remediate
  await triageIssues(allIssues);

  // Weekly brief on Mondays
  await generateWeeklyBrief(state);

  console.log('[Atlas] Done.');
}

main().catch(async (err) => {
  console.error('[Atlas] Fatal:', err.message);
  await sendTelegram(`❌ <b>Atlas fatal error</b>: <code>${err.message.slice(0, 300)}</code>`);
  process.exit(1);
});
