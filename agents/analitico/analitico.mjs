#!/usr/bin/env node
/**
 * El Analítico — engagement intelligence loop (Jorge 2026-05-07).
 *
 * Mission: read FB+IG engagement metrics from each Published record →
 * aggregate by segment / format / theme / posting time / language →
 * write back: per-record metrics + cross-record lessons to sm_lessons.md.
 *
 * Result: SM Manager + Oráculo + Reescritor learn what content actually
 * generates engagement → ideas iteratively improve toward leads.
 *
 * Pipeline:
 *   1. Find records with Status='Programado' or 'Publicado' that have
 *      Published_FB_ID or Published_IG_ID and were published 24h+ ago and
 *      Reach_24h is empty (not yet processed by El Analítico).
 *   2. For each, GET /{post_id}/insights from Meta Graph API:
 *      • FB: post_impressions, post_engaged_users, post_reactions_by_type_total,
 *            post_clicks, post_negative_feedback
 *      • IG: reach, impressions, likes, comments, saves, shares,
 *            profile_visits, profile_activity
 *   3. Compute Engagement_Rate = (likes+comments+saves+shares) / reach
 *   4. Update record: 9 metric fields + Performance_Tier + Analitico_Last_Run
 *      • Status flips to Publicado (was Programado) once metrics arrive
 *   5. Aggregate top/bottom 20% performers by segment+format → append
 *      structured lessons to sm_lessons.md so SM Manager next run learns.
 *
 * Cron: 06:00 UTC daily — gives all posts ≥24h to accumulate metrics.
 */

import { parseArgs, loadTenant, telegramSend, genRunId, isoNow } from "../_shared/runner.mjs";
import { SM_BASE_ID as SM_BASE, SM_TOKEN, SM_TABLES } from "../_shared/sm_tables.mjs";
import { readFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// Sprint A8 (Jorge 2026-05-08): tier scoring for content-market-fit + Phase B recycling.
import { audit, summarizeTiers } from "./audit_scoring.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LESSONS_FILE = join(__dirname, "..", "oraculo_inputs", "sm_lessons.md");

const VALID_MODES = ["batch", "one"];

const META_USER_TOKEN = process.env.META_USER_TOKEN || "";
const META_PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || "";
const FB_PAGE_ID      = "965320503341457"; // Pinnacle Holdings Group
const META_API        = "https://graph.facebook.com/v21.0";

const BATCH_MAX_PER_RUN = Number(process.env.ANALITICO_BATCH_MAX || 20);
const MIN_AGE_HOURS     = Number(process.env.ANALITICO_MIN_AGE_HOURS || 24);

// ─── Airtable SM helpers ─────────────────────────────────────────────────────
async function smFetch(tableId, params = "") {
  const r = await fetch(`https://api.airtable.com/v0/${SM_BASE}/${tableId}?${params}`, {
    headers: { Authorization: `Bearer ${SM_TOKEN}` },
  });
  return r.json();
}
async function smUpdate(tableId, recordId, fields) {
  const r = await fetch(`https://api.airtable.com/v0/${SM_BASE}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SM_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return r.json();
}

// ─── Meta Graph Insights API ──────────────────────────────────────────────────
async function fetchFbInsights(postId, pageToken) {
  // FB Page Post insights — minimal set that won't 400 on un-promoted posts.
  const metrics = "post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_reactions_by_type_total";
  const url = `${META_API}/${postId}/insights?metric=${metrics}&access_token=${pageToken}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    if (j.error) return { error: j.error.message };
    const out = {};
    for (const item of j.data || []) {
      const val = item.values?.[0]?.value;
      if (item.name === "post_impressions") out.impressions = Number(val) || 0;
      if (item.name === "post_impressions_unique") out.reach = Number(val) || 0;
      if (item.name === "post_engaged_users") out.engaged_users = Number(val) || 0;
      if (item.name === "post_clicks") out.clicks = Number(val) || 0;
      if (item.name === "post_reactions_by_type_total") {
        out.likes = (val?.like || 0) + (val?.love || 0) + (val?.wow || 0) + (val?.haha || 0);
        out.shares = 0; // FB Page Post insights doesn't expose shares directly here.
      }
    }
    // Get share + comment counts from the post itself.
    try {
      const pr = await fetch(`${META_API}/${postId}?fields=shares,comments.summary(true)&access_token=${pageToken}`, { signal: AbortSignal.timeout(10000) });
      const pj = await pr.json();
      out.shares = pj.shares?.count || 0;
      out.comments = pj.comments?.summary?.total_count || 0;
    } catch {}
    return out;
  } catch (e) { return { error: e.message }; }
}

async function fetchIgInsights(mediaId, pageToken) {
  // IG Media insights — saves is the strongest engagement signal.
  const metrics = "reach,likes,comments,saves,shares,profile_visits,profile_activity";
  const url = `${META_API}/${mediaId}/insights?metric=${metrics}&access_token=${pageToken}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    if (j.error) return { error: j.error.message };
    const out = {};
    for (const item of j.data || []) {
      const val = item.values?.[0]?.value;
      out[item.name] = Number(val) || 0;
    }
    return out;
  } catch (e) { return { error: e.message }; }
}

// ─── Get Page Access Token (cached) ──────────────────────────────────────────
let _pageTokenCache = null;
async function getPageToken() {
  if (_pageTokenCache) return _pageTokenCache;
  if (META_PAGE_TOKEN) { _pageTokenCache = META_PAGE_TOKEN; return _pageTokenCache; }
  if (!META_USER_TOKEN) return null;
  try {
    const r = await fetch(`${META_API}/me/accounts?access_token=${META_USER_TOKEN}`, { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const page = (j.data || []).find(p => p.id === FB_PAGE_ID);
    if (page?.access_token) { _pageTokenCache = page.access_token; return _pageTokenCache; }
  } catch {}
  return null;
}

// ─── Process one published record ────────────────────────────────────────────
async function processOne(record, tableId, format, pageToken) {
  const f = record.fields || {};
  const titulo = f.Title || record.id;
  const fbId = f.Published_FB_ID || "";
  const igId = f.Published_IG_ID || "";

  if (!fbId && !igId) {
    return { id: record.id, titulo, status: "skip_no_publish_ids" };
  }

  let fbMetrics = {}, igMetrics = {};
  if (fbId) fbMetrics = await fetchFbInsights(fbId, pageToken);
  if (igId) igMetrics = await fetchIgInsights(igId, pageToken);

  // Aggregate metrics across platforms.
  const reach        = (fbMetrics.reach || 0) + (igMetrics.reach || 0);
  const impressions  = (fbMetrics.impressions || 0) + (igMetrics.impressions || 0);
  const likes        = (fbMetrics.likes || 0) + (igMetrics.likes || 0);
  const comments     = (fbMetrics.comments || 0) + (igMetrics.comments || 0);
  const shares       = (fbMetrics.shares || 0) + (igMetrics.shares || 0);
  const saves        = igMetrics.saves || 0;          // IG-only metric
  const profileVisits = igMetrics.profile_visits || 0;
  const engagementRate = reach > 0 ? +((likes + comments + saves + shares) / reach).toFixed(4) : 0;

  // Sprint A8 (Jorge 2026-05-08): weighted Audit_Score + Tier (Premium/Good/Fair/Poor)
  // for content-market-fit feedback. Tier surfaces winners for SM Manager Phase B
  // recycling (Sprint A10).
  const { score: auditScore, tier: auditTier } = audit({ reach, likes, comments, shares, saves });

  await smUpdate(tableId, record.id, {
    Reach_24h:         reach,
    Impressions_24h:   impressions,
    Likes_24h:         likes,
    Comments_24h:      comments,
    Shares_24h:        shares,
    Saves_24h:         saves,
    Profile_Visits_24h: profileVisits,
    Engagement_Rate:   engagementRate,
    Audit_Score:       auditScore,
    Audit_Tier:        auditTier,
    Analitico_Last_Run: new Date().toISOString(),
    Status:            "Publicado",
  });

  return {
    id: record.id, titulo, status: "metrics_collected",
    format,
    reach, likes, comments, saves, shares, engagementRate,
    auditScore, auditTier,
    fb_error: fbMetrics.error || null,
    ig_error: igMetrics.error || null,
  };
}

// ─── Aggregate top/bottom performers → write lessons ─────────────────────────
async function writePerformanceLessons(allResults, cfg) {
  // Group by format + segment_anchor.
  const bySegment = {};
  for (const r of allResults) {
    if (r.status !== "metrics_collected") continue;
    const key = `${r.format}_${r.segment || "General"}`;
    if (!bySegment[key]) bySegment[key] = [];
    bySegment[key].push(r);
  }

  // Compute mean engagement rate per group.
  const lessons = [];
  const date = new Date().toISOString().slice(0, 10);
  for (const [key, items] of Object.entries(bySegment)) {
    if (items.length < 2) continue;
    const avgER = items.reduce((s, r) => s + r.engagementRate, 0) / items.length;
    const top = items.sort((a, b) => b.engagementRate - a.engagementRate)[0];
    const bottom = items[items.length - 1];
    const ratio = bottom.engagementRate > 0 ? (top.engagementRate / bottom.engagementRate).toFixed(2) : "n/a";
    lessons.push({
      key,
      avgER,
      topTitle: top.titulo,
      bottomTitle: bottom.titulo,
      ratio,
      sample: items.length,
    });
  }
  if (lessons.length === 0) return;

  // Sort by avgER descending so top performers float to top of the lessons file.
  lessons.sort((a, b) => b.avgER - a.avgER);

  let entry = `\n### ${date} — El Analítico engagement report\n`;
  for (const l of lessons.slice(0, 6)) {
    entry += `- **${l.key}** | sample=${l.sample} | avg_ER=${(l.avgER * 100).toFixed(2)}% | top: "${l.topTitle.slice(0, 50)}" | top/bottom ratio=${l.ratio}\n`;
  }
  entry += `\n**Pattern guidance for SM Manager**: prioritize segments+formats with highest avg_ER on next idea generation. De-prioritize the lowest tiers (or rewrite their angle).\n`;

  try {
    await appendFile(LESSONS_FILE, entry, "utf8");
  } catch (e) {
    console.error(`[analitico] failed to append lesson: ${e.message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv, VALID_MODES, { recordId: "" });
  const cfg = await loadTenant(args.tenant);
  const runId = genRunId();
  const startedAt = isoNow();

  console.error(`[analitico] tenant=${cfg.tenant_id} mode=${args.mode} run_id=${runId}`);

  if (!META_USER_TOKEN && !META_PAGE_TOKEN) {
    console.error("[analitico] META_USER_TOKEN / META_PAGE_ACCESS_TOKEN missing — cannot fetch insights");
    process.exit(2);
  }
  if (!SM_TOKEN) {
    console.error("[analitico] AIRTABLE_SM_TOKEN missing");
    process.exit(2);
  }

  const pageToken = await getPageToken();
  if (!pageToken) {
    console.error("[analitico] Page token resolution failed");
    process.exit(2);
  }

  // Find records eligible for metric collection: Programado/Publicado + has Published_*_ID + ≥24h old
  // + Reach_24h not yet set (skip records already processed).
  const cutoffISO = new Date(Date.now() - MIN_AGE_HOURS * 3600 * 1000).toISOString();
  const filter = encodeURIComponent(
    `AND(OR({Status}='Programado',{Status}='Publicado'), OR({Published_FB_ID}!='', {Published_IG_ID}!=''), OR({Reach_24h}=0, NOT({Reach_24h})), IS_BEFORE({Scheduled_Time}, '${cutoffISO}'))`
  );

  const pending = []; // { tableId, format, record, segment }
  for (const t of SM_TABLES) {
    const r = await smFetch(t.id, `filterByFormula=${filter}&maxRecords=${BATCH_MAX_PER_RUN}`);
    for (const rec of (r.records || [])) {
      if (pending.length >= BATCH_MAX_PER_RUN) break;
      pending.push({
        tableId: t.id,
        format:  t.format,
        record:  rec,
        segment: rec.fields?.Segment_Anchor || "General",
      });
    }
    if (pending.length >= BATCH_MAX_PER_RUN) break;
  }

  if (pending.length === 0) {
    console.error("[analitico] no records ready for metric collection");
    await telegramSend(cfg, `📊 *El Analítico* — ${cfg.tenant_name}\nNo hay posts listos para análisis de engagement (≥${MIN_AGE_HOURS}h post-publish).`);
    return;
  }

  const results = [];
  for (const it of pending) {
    let out;
    try { out = await processOne(it.record, it.tableId, it.format, pageToken); }
    catch (e) {
      out = { id: it.record.id, titulo: it.record.fields?.Title || it.record.id, status: "exception", error: String(e?.message || e).slice(0, 200) };
    }
    out.format = it.format;
    out.segment = it.segment;
    results.push(out);
    const er = out.engagementRate ? `ER=${(out.engagementRate * 100).toFixed(1)}%` : "";
    console.error(`[analitico] [${it.format}/${it.segment}] ${out.titulo}: ${out.status} ${er}`);
  }

  // Aggregate + write performance lessons (only if ≥3 records collected).
  const collected = results.filter(r => r.status === "metrics_collected");
  if (collected.length >= 3) {
    await writePerformanceLessons(results, cfg);
  }

  const completedAt = isoNow();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);
  const failed = results.filter(r => /failed|exception/.test(r.status)).length;

  // Top 3 performers by engagement rate.
  const top = collected.sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 3);

  // Sprint A8: tier distribution summary for Telegram report.
  const tierItems = collected.map(r => ({ id: r.id, title: r.titulo, score: r.auditScore || 0 }));
  const tierSummary = summarizeTiers(tierItems);

  const lines = [
    `📊 *El Analítico* — ${cfg.tenant_name}`,
    `${duration}s · ✅ ${collected.length} metrics collected${failed ? ` · ⚠️ ${failed} failed` : ""}`,
    `Tiers: 🟢 ${tierSummary.counts.Premium} Premium · 🔵 ${tierSummary.counts.Good} Good · 🟡 ${tierSummary.counts.Fair} Fair · 🔴 ${tierSummary.counts.Poor} Poor`,
  ];
  if (top.length > 0) {
    lines.push(`*Top performers:*`);
    for (const t of top) {
      const tierBadge = t.auditTier ? `[${t.auditTier}] ` : "";
      lines.push(`📈 ${tierBadge}${(t.engagementRate * 100).toFixed(1)}% ER · score=${t.auditScore} · ${t.format} · ${(t.titulo || "").slice(0, 40)}`);
    }
  }
  await telegramSend(cfg, lines.join("\n").slice(0, 3800));

  console.error(`[analitico] done — collected=${collected.length} failed=${failed}`);
}

main().catch((e) => { console.error("[analitico] FATAL:", e); process.exit(1); });
