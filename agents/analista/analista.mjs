#!/usr/bin/env node
/**
 * El Analista — weekly exec dashboard orchestrator.
 *
 * Usage:
 *   node agents/analista/analista.mjs --tenant <slug> --mode weekly|ad_hoc|preview [--week 2026-W17] [--dry-run]
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
const VALID_MODES = ["weekly", "ad_hoc", "preview"];
const TABLE_KEY = "weekly_dashboards_table_id";

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekBounds(weekStr) {
  const [y, w] = weekStr.split("-W").map(Number);
  const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - ((dow + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

async function gather(cfg, weekStr) {
  const { start, end } = weekBounds(weekStr);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const withinWeek = (field) =>
    `AND(IS_AFTER({${field}}, '${startIso}'), IS_BEFORE({${field}}, '${endIso}'))`;
  const latest = (table, sortField) =>
    airtableFetch(cfg, table, `maxRecords=1&sort[0][field]=${sortField}&sort[0][direction]=desc`).catch(() => ({ records: [] }));

  const [marketing, seo, ads, compliance, espia, leadScores, leads, deals, content, emails, emailEvents] =
    await Promise.all([
      latest("table_id", "started_at"),
      latest("seo_table_id", "started_at"),
      latest("ads_table_id", "started_at"),
      latest("compliance_audits_table_id", "started_at"),
      airtableFetch(cfg, "competitor_intel_table_id",
        `filterByFormula=${encodeURIComponent(withinWeek("scanned_at"))}&maxRecords=20`).catch(() => ({ records: [] })),
      airtableFetch(cfg, "lead_scores_table_id",
        `filterByFormula=${encodeURIComponent(withinWeek("scored_at"))}&maxRecords=100`).catch(() => ({ records: [] })),
      airtableFetch(cfg, "leads_table_id", "maxRecords=100&sort[0][field]=Dated%20Added&sort[0][direction]=desc").catch(() => ({ records: [] })),
      airtableFetch(cfg, "deals_table_id", "maxRecords=100").catch(() => ({ records: [] })),
      airtableFetch(cfg, "content_queue_table_id", "maxRecords=50").catch(() => ({ records: [] })),
      airtableFetch(cfg, "email_campaigns_table_id", "maxRecords=20&sort[0][field]=sent_at&sort[0][direction]=desc").catch(() => ({ records: [] })),
      airtableFetch(cfg, "email_events_table_id",
        `filterByFormula=${encodeURIComponent(withinWeek("ts"))}&maxRecords=500`).catch(() => ({ records: [] })),
    ]);

  return {
    start: startIso, end: endIso,
    marketing: marketing.records?.[0]?.fields || {},
    seo:       seo.records?.[0]?.fields || {},
    ads:       ads.records?.[0]?.fields || {},
    compliance: compliance.records?.[0]?.fields || {},
    espia_count: (espia.records || []).length,
    espia_top:   (espia.records || []).slice(0, 5).map(r => ({
      name: r.fields?.competitor_name,
      severity: r.fields?.change_severity,
      changes: (r.fields?.changes_summary || "").slice(0, 200),
    })),
    lead_scores: leadScores.records || [],
    leads_recent: leads.records || [],
    deals_recent: deals.records || [],
    content: content.records || [],
    emails: emails.records || [],
    email_events: emailEvents.records || [],
  };
}

function rollupMetrics(data, weekStr) {
  const { start, end } = weekBounds(weekStr);
  const inWeek = (iso) => iso && Date.parse(iso) >= start.getTime() && Date.parse(iso) <= end.getTime();

  const new_leads = data.leads_recent.filter(r => inWeek(r.createdTime || r.fields?.Created)).length;
  const qualified_leads = data.lead_scores.filter(r => {
    const s = r.fields?.overall_score;
    return typeof s === "number" && s >= 55;
  }).length;

  const deals_closed_arr = data.deals_recent.filter(r => {
    const f = r.fields || {};
    const stage = String(f.Stage || f.stage || "").toLowerCase();
    const closed_at = f.closed_at || f.Closed || r.createdTime;
    return /closed|won/.test(stage) && inWeek(closed_at);
  });
  const deals_closed = deals_closed_arr.length;
  const revenue_this_week = deals_closed_arr.reduce((sum, r) => sum + Number(r.fields?.revenue || r.fields?.Revenue || 0), 0);

  const deals_lost = data.deals_recent.filter(r => {
    const stage = String(r.fields?.Stage || r.fields?.stage || "").toLowerCase();
    return /lost|dead/.test(stage) && inWeek(r.createdTime);
  }).length;

  const emails_sent = data.emails.reduce((sum, r) => sum + Number(r.fields?.total_sent || r.fields?.sent || 0), 0);
  const opens = data.email_events.filter(r => /open/i.test(String(r.fields?.event_type || ""))).length;
  const clicks = data.email_events.filter(r => /click/i.test(String(r.fields?.event_type || ""))).length;
  const email_open_rate = emails_sent > 0 ? (opens / emails_sent) * 100 : 0;
  const email_click_rate = emails_sent > 0 ? (clicks / emails_sent) * 100 : 0;

  const content_published = data.content.filter(r => {
    const f = r.fields || {};
    const status = String(f.status || f.Status || "").toLowerCase();
    const pub_at = f.published_at || f.approved_at || r.createdTime;
    return /published|approved/.test(status) && inWeek(pub_at);
  }).length;

  return {
    new_leads, qualified_leads, deals_closed, deals_lost, revenue_this_week,
    emails_sent,
    email_open_rate: Math.round(email_open_rate * 10) / 10,
    email_click_rate: Math.round(email_click_rate * 10) / 10,
    content_published,
    marketing_audit_score: data.marketing?.overall_score ?? null,
    seo_score: data.seo?.overall_score ?? null,
    ads_score: data.ads?.overall_score ?? null,
    compliance_score: data.compliance?.overall_score ?? null,
  };
}

function buildPrompt(cfg, args, data, metrics, weekStr) {
  const tenant = cfg.tenant_name;
  const state = cfg.markets?.[0]?.state || "";

  return `You are El Analista, always-on weekly exec dashboard sub-agent for the R9 plantel.
Tenant: ${tenant} | Market: ${state} | ISO Week: ${weekStr}
Window: ${data.start} → ${data.end}

Aggregated metrics this week:
- New leads: ${metrics.new_leads}
- Qualified leads (score ≥55): ${metrics.qualified_leads}
- Deals closed: ${metrics.deals_closed} ($${metrics.revenue_this_week} revenue)
- Deals lost: ${metrics.deals_lost}
- Emails sent: ${metrics.emails_sent} | open rate: ${metrics.email_open_rate}% | click rate: ${metrics.email_click_rate}%
- Content published: ${metrics.content_published}
- Latest scores: marketing ${metrics.marketing_audit_score ?? "n/a"}, SEO ${metrics.seo_score ?? "n/a"}, ads ${metrics.ads_score ?? "n/a"}, compliance ${metrics.compliance_score ?? "n/a"}
- Competitor scan events this week: ${data.espia_count}

Top competitor changes:
${data.espia_top.map(c => `- ${c.name} (severity ${c.severity}/10): ${c.changes}`).join("\n") || "(none)"}

Write a crisp Monday 7am executive brief Jorge will read on his phone in 90 seconds.

Output (STRICT markdown):

# ${tenant} — Weekly Dashboard ${weekStr}

## Executive Summary
[3 short paragraphs. First: what happened. Second: why it matters. Third: what to do about it. Max 160 words total.]

## Headline Wins
- [top 3 wins, 1 line each, specific numbers]

## Headline Concerns
- [top 3 concerns, 1 line each, specific numbers]

## Action Items (next week)
- [top 3 priorities, each with owner (Jorge|Fer|ALEX) and clear deliverable]

## Competitor Movements
- [top 3 competitor changes worth reacting to]

## Compliance Flags
- [top compliance concerns from Auditor, if any]

Be honest. If the week was flat, say so. If there's a fire, lead with it. Mobile-first formatting — short lines, no tables.`;
}

function parseOutput(text) {
  return {
    executive_summary_md: extractBlock(text, "Executive Summary").slice(0, 2000),
    headline_wins:        extractBlock(text, "Headline Wins").slice(0, 1000),
    headline_concerns:    extractBlock(text, "Headline Concerns").slice(0, 1000),
    action_items:         extractBlock(text, "Action Items").slice(0, 1200),
    competitor_movements: extractBlock(text, "Competitor Movements").slice(0, 1200),
    compliance_flags:     extractBlock(text, "Compliance Flags").slice(0, 1200),
  };
}

async function main() {
  const args = parseArgs(process.argv, VALID_MODES, { week: null });
  const cfg = await loadTenant(args.tenant);
  const runId = genRunId();
  const startedAt = isoNow();
  const weekStr = args.week || isoWeek(new Date());
  const { start, end } = weekBounds(weekStr);

  console.error(`[analista] tenant=${cfg.tenant_id} mode=${args.mode} week=${weekStr} run_id=${runId} dry_run=${args.dryRun}`);

  const data = await gather(cfg, weekStr);
  const metrics = rollupMetrics(data, weekStr);
  const prompt = buildPrompt(cfg, args, data, metrics, weekStr);

  if (args.mode === "preview" || args.dryRun) {
    console.log(`=== DRY/PREVIEW [analista] week=${weekStr} ===`);
    console.log("Metrics:", JSON.stringify(metrics, null, 2));
    console.log("\n---PROMPT---\n");
    console.log(prompt);
    return;
  }

  await airtableUpsert(cfg, TABLE_KEY, runId, {
    tenant_id: cfg.tenant_id,
    week_iso: weekStr,
    week_start: start.toISOString(),
    week_end: end.toISOString(),
    status: "Running",
    trigger: process.env.ANALISTA_TRIGGER || "alex_manual",
    started_at: startedAt,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });

  let out = "";
  try {
    out = await runClaude(cfg.claude.binary_path, prompt);
  } catch (e) {
    await airtableUpsert(cfg, TABLE_KEY, runId, { status: "Failed", completed_at: isoNow() });
    await telegramSend(cfg, `❌ *El Analista — ${cfg.tenant_name}*\nweek \`${weekStr}\` error: \`${e.message}\``);
    process.exit(1);
  }

  const parsed = parseOutput(out);
  const completedAt = isoNow();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);

  const mdPath = join(OUTPUT_DIR, `${runId}.md`);
  await writeFile(mdPath, out, "utf8");

  await airtableUpsert(cfg, TABLE_KEY, runId, {
    status: "Done",
    completed_at: completedAt,
    duration_sec: duration,
    ...metrics,
    ...parsed,
  });

  const head = `📊 *El Analista — ${cfg.tenant_name}*\nweek \`${weekStr}\` · ${metrics.new_leads} leads · ${metrics.deals_closed} closed · $${metrics.revenue_this_week}`;
  const body = `\n\n${parsed.executive_summary_md.slice(0, 1500)}\n\n*Wins:*\n${parsed.headline_wins.slice(0, 500)}\n\n*Concerns:*\n${parsed.headline_concerns.slice(0, 500)}`;
  await telegramSend(cfg, (head + body).slice(0, 3900));

  console.error(`[analista] done run_id=${runId} duration=${duration}s`);
}

main().catch(e => { console.error("[analista] FATAL:", e); process.exit(1); });
