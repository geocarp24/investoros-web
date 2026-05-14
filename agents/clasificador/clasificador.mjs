#!/usr/bin/env node
/**
 * El Clasificador — lead scoring orchestrator. Thin wrapper on _shared/runner.mjs.
 *
 * Usage:
 *   node agents/clasificador/clasificador.mjs --tenant <slug> --mode score_batch|score_one|rescore_hot [--lead-id recXYZ] [--dry-run]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseArgs, loadTenant, runClaude,
  airtableFetch, airtableUpsert, telegramSend,
  extractScore, extractNumber, extractBlock, genRunId, isoNow,
} from "../_shared/runner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "runs");
const VALID_MODES = ["score_batch", "score_one", "rescore_hot"];
const TABLE_KEY = "lead_scores_table_id";

function buildPrompt(cfg, args, leads) {
  const tenant = cfg.tenant_name;
  const state = cfg.markets?.[0]?.state || "";
  const cities = (cfg.markets?.[0]?.cities_primary || []).slice(0, 8).join(", ");
  const today = new Date().toISOString().slice(0, 10);

  const leadsBlock = leads.length === 0
    ? "(No unscored leads in queue this run.)"
    : leads.slice(0, 25).map((r, i) => {
        const f = r.fields || {};
        const lines = Object.entries(f)
          .filter(([k, v]) => v != null && String(v).trim() !== "")
          .slice(0, 20)
          .map(([k, v]) => `  ${k}: ${String(v).slice(0, 200)}`)
          .join("\n");
        return `### Lead ${i + 1} (record_id=${r.id})\n${lines}`;
      }).join("\n\n");

  return `You are El Clasificador, always-on lead scoring sub-agent for the R9 plantel.
Tenant: ${tenant} | Market: ${state} (${cities}) | Date: ${today} | Mode: ${args.mode}

Score each lead on 5 axes (0-100):
1. urgency (time pressure: foreclosure date, eviction, divorce, tax sale)
2. distress (financial/life severity: liens, bankruptcy, probate, code violations)
3. property (asset attractiveness: ARV minus rehab, location tier, zoning)
4. timeline (how fast they NEED to close: 7d vs 90d+)
5. motivation (psychological readiness: detached, cash-urgent, talking to competitors)

Composite overall_score = urgency*0.30 + distress*0.25 + property*0.20 + timeline*0.15 + motivation*0.10

Heat classification:
- 🔥 Hot >= 75 (call within 15 min)
- 🌡 Warm 55-74 (call within 24h)
- ❄️ Cold 30-54 (nurture weekly)
- 🚫 Disqualify < 30 (bots, competitors, wrong market)

Suggested actions: call_now | sms_urgent | follow_up_48h | nurture_weekly | disqualify
Suggested owners: fer (SMS/review agent) | human_rep (Jorge) | drop

WI-specific signals to weigh:
- Pre-foreclosure + sheriff sale date within 30d → urgency 90+
- Probate filed → motivation 60+, timeline 50-70 (slow legal process)
- Divorce filed → urgency 70+, motivation 70+
- Wholesaler-generated lead → treat with caution, factor WI 2024 wholesale disclosure law

Leads to score (${leads.length}):

${leadsBlock}

Output format (STRICT MARKDOWN — one block per lead, then summary):

# ${tenant} Lead Scoring — ${today} (${args.mode})

---

## Lead: [record_id]

- Name/phone/email: [from fields, masked last 2 chars if privacy]
- overall_score: N/100
- heat: 🔥 Hot | 🌡 Warm | ❄️ Cold | 🚫 Disqualify
- urgency_score: N
- distress_score: N
- property_score: N
- timeline_score: N
- motivation_score: N

### Rationale
[2-3 sentences explaining the composite]

### Red flags
- ...

### Green flags
- ...

### suggested_action: call_now|sms_urgent|follow_up_48h|nurture_weekly|disqualify
### suggested_owner: fer|human_rep|drop

---

(repeat per lead)

## Batch Summary
- Total scored: N
- Hot: N | Warm: N | Cold: N | Disqualify: N
- Top 3 to call NOW: [record_ids with score]
- Notable changes vs last scoring: (if any)

Be specific. Use actual field values. Do not invent data that isn't in the provided record.`;
}

function parseOneLeadBlock(block) {
  const idMatch = block.match(/Lead:\s*([a-zA-Z0-9]+)/);
  const record_id = idMatch ? idMatch[1].trim() : null;
  const get = (label) => extractScore(block, `${label}[_\\s]?score`);
  return {
    record_id,
    overall_score: extractScore(block, "overall"),
    heat: (block.match(/heat:\s*([🔥🌡❄️🚫][^\n]*)/) || [, ""])[1].trim().slice(0, 40) || null,
    urgency_score: get("urgency"),
    distress_score: get("distress"),
    property_score: get("property"),
    timeline_score: get("timeline"),
    motivation_score: get("motivation"),
    rationale: extractBlock(block, "Rationale").slice(0, 1500),
    red_flags: extractBlock(block, "Red flags").slice(0, 1000),
    green_flags: extractBlock(block, "Green flags").slice(0, 1000),
    suggested_action: (block.match(/suggested_action:\s*([a-z_]+)/i) || [, null])[1],
    suggested_owner:  (block.match(/suggested_owner:\s*([a-z_]+)/i) || [, null])[1],
  };
}

function splitIntoLeadBlocks(text) {
  const parts = text.split(/\n---\n/);
  return parts.filter(p => /Lead:\s*[a-zA-Z0-9]+/.test(p));
}

async function fetchLeads(cfg, args) {
  if (args.mode === "score_one" && args.leadId) {
    const res = await airtableFetch(cfg, "leads_table_id",
      `filterByFormula=${encodeURIComponent(`RECORD_ID()='${args.leadId}'`)}&maxRecords=1`);
    return res.records || [];
  }
  if (args.mode === "rescore_hot") {
    // Find leads whose last Lead_Scores row had heat=Hot
    const res = await airtableFetch(cfg, TABLE_KEY,
      `filterByFormula=${encodeURIComponent("FIND('Hot', {heat})")}&maxRecords=25&sort[0][field]=scored_at&sort[0][direction]=desc`);
    const leadIds = (res.records || []).map(r => r.fields?.lead_id).filter(Boolean);
    if (leadIds.length === 0) return [];
    const clauses = leadIds.slice(0, 25).map(id => `RECORD_ID()='${id}'`).join(",");
    const q = await airtableFetch(cfg, "leads_table_id",
      `filterByFormula=${encodeURIComponent(`OR(${clauses})`)}&maxRecords=25`);
    return q.records || [];
  }
  // score_batch: pull leads not yet scored or stale (Leads table uses "Dated Added")
  const all = await airtableFetch(cfg, "leads_table_id", "maxRecords=50&sort[0][field]=Dated%20Added&sort[0][direction]=desc");
  return (all.records || []).slice(0, 25);
}

async function main() {
  const args = parseArgs(process.argv, VALID_MODES, { leadId: null });
  const cfg = await loadTenant(args.tenant);
  const runId = genRunId();
  const startedAt = isoNow();

  console.error(`[clasificador] tenant=${cfg.tenant_id} mode=${args.mode} run_id=${runId} dry_run=${args.dryRun}`);

  const leads = await fetchLeads(cfg, args);
  const prompt = buildPrompt(cfg, args, leads);

  if (args.dryRun) {
    console.log("=== DRY RUN [clasificador] ===");
    console.log(`Leads fetched: ${leads.length}`);
    console.log(prompt);
    return;
  }

  // Parent run entry (aggregate)
  await airtableUpsert(cfg, TABLE_KEY, runId, {
    tenant_id: cfg.tenant_id,
    status: "Running",
    trigger: process.env.CLASIFICADOR_TRIGGER || "alex_manual",
    scored_at: startedAt,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });

  let out = "";
  try {
    out = await runClaude(cfg.claude.binary_path, prompt);
  } catch (e) {
    await airtableUpsert(cfg, TABLE_KEY, runId, { status: "Failed" });
    await telegramSend(cfg, `❌ *El Clasificador — ${cfg.tenant_name}*\nmode: \`${args.mode}\`\nerror: \`${e.message}\``);
    process.exit(1);
  }

  const mdPath = join(OUTPUT_DIR, `${runId}.md`);
  await writeFile(mdPath, out, "utf8");

  // Parse per-lead scores and write individual rows
  const blocks = splitIntoLeadBlocks(out);
  const parsedRows = blocks.map(parseOneLeadBlock).filter(r => r.record_id && r.overall_score != null);
  let hot = 0, warm = 0, cold = 0, disq = 0;

  for (const row of parsedRows) {
    const heat = row.heat || "";
    if (/Hot/i.test(heat)) hot++;
    else if (/Warm/i.test(heat)) warm++;
    else if (/Cold/i.test(heat)) cold++;
    else if (/Disqualify/i.test(heat)) disq++;

    await airtableUpsert(cfg, TABLE_KEY, `${runId}_${row.record_id}`, {
      tenant_id:  cfg.tenant_id,
      lead_id:    row.record_id,
      status:     "Done",
      trigger:    process.env.CLASIFICADOR_TRIGGER || "alex_manual",
      scored_at:  isoNow(),
      overall_score:    row.overall_score,
      heat:             row.heat,
      urgency_score:    row.urgency_score,
      distress_score:   row.distress_score,
      property_score:   row.property_score,
      timeline_score:   row.timeline_score,
      motivation_score: row.motivation_score,
      rationale:        row.rationale,
      red_flags:        row.red_flags,
      green_flags:      row.green_flags,
      suggested_action: row.suggested_action,
      suggested_owner:  row.suggested_owner,
    });
  }

  // Close parent run
  const summary = extractBlock(out, "Batch Summary").slice(0, 2000);
  await airtableUpsert(cfg, TABLE_KEY, runId, {
    status: "Done",
    summary_md: summary,
  });

  // Telegram alerts
  const hotList = parsedRows
    .filter(r => /Hot/i.test(r.heat || ""))
    .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
    .slice(0, 3)
    .map(r => `• \`${r.record_id}\` score *${r.overall_score}* — ${r.suggested_action || "?"}`)
    .join("\n") || "(none)";

  const emoji = hot > 0 ? "🔥" : warm > 0 ? "🌡" : "🎯";
  const msg = `${emoji} *El Clasificador — ${cfg.tenant_name}*\nmode: \`${args.mode}\` · ${parsedRows.length} leads scored\n🔥 ${hot} · 🌡 ${warm} · ❄️ ${cold} · 🚫 ${disq}\n\n*Top to call now:*\n${hotList}`;
  await telegramSend(cfg, msg);

  console.error(`[clasificador] done run_id=${runId} leads=${parsedRows.length} hot=${hot} warm=${warm}`);
}

main().catch(e => { console.error("[clasificador] FATAL:", e); process.exit(1); });
