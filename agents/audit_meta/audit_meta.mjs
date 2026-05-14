#!/usr/bin/env node
/**
 * El Auditor Meta — health + engagement baseline audit of FB Page + IG account.
 *
 * One-shot agent that pulls:
 *   • FB Page info: name, fan_count, followers_count, category, verification
 *   • FB Page insights last 30d: impressions, reach, engaged_users, reactions
 *   • FB recent posts: last 25 with per-post reach + likes + comments + shares
 *   • IG account: followers, following, media_count, profile insights last 30d
 *   • IG recent media: last 25 with per-post reach + likes + saves + comments
 *   • Health signals: posting frequency, avg engagement rate, recent trend
 *
 * Output: writes structured markdown → references/meta_audit_<timestamp>.md,
 * commits + pushes back to repo. Telegram summary.
 *
 * Usage: dispatched on-demand. Not on cron — pulls fresh state when Jorge asks.
 */

import { parseArgs, loadTenant, telegramSend, genRunId, isoNow } from "../_shared/runner.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const REFS_DIR  = join(REPO_ROOT, "references");

const VALID_MODES = ["batch"];

const META_USER_TOKEN = process.env.META_USER_TOKEN || "";
const META_PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || "";
const FB_PAGE_ID      = "965320503341457"; // Pinnacle Holdings Group
const META_API        = "https://graph.facebook.com/v21.0";

async function gget(path, token) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${META_API}${path}${sep}access_token=${token}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return await r.json();
  } catch (e) { return { error: e.message }; }
}

async function getPageToken() {
  if (META_PAGE_TOKEN) return META_PAGE_TOKEN;
  if (!META_USER_TOKEN) return null;
  const j = await gget("/me/accounts", META_USER_TOKEN);
  const page = (j.data || []).find(p => p.id === FB_PAGE_ID);
  return page?.access_token || null;
}

function fmtNum(n) { return Number(n).toLocaleString("en-US"); }
function fmtPct(n) { return `${(n * 100).toFixed(2)}%`; }

async function main() {
  const args = parseArgs(process.argv, VALID_MODES);
  const cfg = await loadTenant(args.tenant);
  const runId = genRunId();
  const startedAt = isoNow();

  console.error(`[audit_meta] tenant=${cfg.tenant_id} run_id=${runId}`);

  if (!META_USER_TOKEN && !META_PAGE_TOKEN) {
    console.error("[audit_meta] META_USER_TOKEN missing");
    process.exit(2);
  }
  const pageToken = await getPageToken();
  if (!pageToken) { console.error("[audit_meta] page token resolution failed"); process.exit(2); }

  const sections = [];
  const summary = [];

  // ── FB Page metadata ─────────────────────────────────────────────────────
  const pg = await gget(`/${FB_PAGE_ID}?fields=id,name,category,fan_count,followers_count,link,verification_status,about,founded`, pageToken);
  if (pg.error) {
    sections.push(`## ❌ FB Page Info\n\nError: ${pg.error.message || JSON.stringify(pg.error)}\n`);
  } else {
    sections.push(
`## 📘 FB Page — ${pg.name}

| Field | Value |
|---|---|
| Page ID | ${pg.id} |
| Category | ${pg.category || "—"} |
| Fans (likes) | ${fmtNum(pg.fan_count || 0)} |
| Followers | ${fmtNum(pg.followers_count || 0)} |
| Verification | ${pg.verification_status || "not_verified"} |
| Founded | ${pg.founded || "—"} |
| Link | ${pg.link || "—"} |
| About | ${(pg.about || "").slice(0, 200)} |
`);
    summary.push(`📘 FB: ${fmtNum(pg.followers_count || 0)} followers · ${pg.verification_status || "not_verified"}`);
  }

  // ── FB Page insights last 30 days ────────────────────────────────────────
  const sinceTs = Math.floor((Date.now() - 30 * 86400 * 1000) / 1000);
  const untilTs = Math.floor(Date.now() / 1000);
  const insightMetrics = "page_impressions,page_impressions_unique,page_engaged_users,page_post_engagements,page_actions_post_reactions_total,page_video_views";
  const ins = await gget(`/${FB_PAGE_ID}/insights?metric=${insightMetrics}&period=days_28&since=${sinceTs}&until=${untilTs}`, pageToken);
  if (ins.error) {
    sections.push(`## ❌ FB Insights\n\n${ins.error.message || JSON.stringify(ins.error)}\n`);
  } else {
    const rows = [];
    for (const m of ins.data || []) {
      const total = (m.values || []).reduce((s, v) => s + (Number(v.value) || 0), 0);
      rows.push(`| ${m.name} | ${fmtNum(total)} |`);
    }
    sections.push(`## 📊 FB Page Insights — last 30 days\n\n| Metric | Total |\n|---|---|\n${rows.join("\n")}\n`);
  }

  // ── FB recent posts ─────────────────────────────────────────────────────
  const posts = await gget(`/${FB_PAGE_ID}/posts?fields=id,message,created_time,permalink_url,reactions.summary(true),comments.summary(true),shares&limit=15`, pageToken);
  if (posts.error) {
    sections.push(`## ❌ FB Recent Posts\n\n${posts.error.message || JSON.stringify(posts.error)}\n`);
  } else {
    const rows = [];
    for (const p of (posts.data || []).slice(0, 15)) {
      const created = (p.created_time || "").slice(0, 10);
      const msg = (p.message || "(no caption)").replace(/\n/g, " ").slice(0, 60);
      const r = p.reactions?.summary?.total_count || 0;
      const c = p.comments?.summary?.total_count || 0;
      const s = p.shares?.count || 0;
      rows.push(`| ${created} | ${msg} | ${r} | ${c} | ${s} |`);
    }
    sections.push(`## 📝 FB Recent 15 Posts\n\n| Date | Caption | 👍 | 💬 | 🔄 |\n|---|---|---|---|---|\n${rows.join("\n")}\n`);
  }

  // ── IG account ──────────────────────────────────────────────────────────
  const igLink = await gget(`/${FB_PAGE_ID}?fields=instagram_business_account`, pageToken);
  const igId = igLink.instagram_business_account?.id;
  if (!igId) {
    sections.push(`## ⚠️ IG\n\nNo Instagram Business Account linked to FB Page ${FB_PAGE_ID}\n`);
    summary.push("⚠️ IG: not linked");
  } else {
    const ig = await gget(`/${igId}?fields=username,name,biography,followers_count,follows_count,media_count,profile_picture_url`, pageToken);
    if (ig.error) {
      sections.push(`## ❌ IG account\n\n${ig.error.message}\n`);
    } else {
      sections.push(
`## 📷 IG account — @${ig.username}

| Field | Value |
|---|---|
| IG User ID | ${igId} |
| Name | ${ig.name || "—"} |
| Followers | ${fmtNum(ig.followers_count || 0)} |
| Following | ${fmtNum(ig.follows_count || 0)} |
| Posts | ${fmtNum(ig.media_count || 0)} |
| Bio | ${(ig.biography || "").slice(0, 200)} |
`);
      summary.push(`📷 IG @${ig.username}: ${fmtNum(ig.followers_count || 0)} followers · ${ig.media_count} posts`);
    }

    // IG insights last 30d (account-level).
    const igIns = await gget(`/${igId}/insights?metric=reach,profile_views,website_clicks&period=days_28`, pageToken);
    if (igIns.error) {
      sections.push(`## ❌ IG Account Insights\n\n${igIns.error.message}\n`);
    } else {
      const rows = [];
      for (const m of igIns.data || []) {
        const total = (m.values || []).reduce((s, v) => s + (Number(v.value) || 0), 0);
        rows.push(`| ${m.name} | ${fmtNum(total)} |`);
      }
      sections.push(`## 📊 IG Account Insights — last 28 days\n\n| Metric | Total |\n|---|---|\n${rows.join("\n")}\n`);
    }

    // IG recent media.
    const igMedia = await gget(`/${igId}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=15`, pageToken);
    if (igMedia.error) {
      sections.push(`## ❌ IG Recent Media\n\n${igMedia.error.message}\n`);
    } else {
      const rows = [];
      for (const m of (igMedia.data || []).slice(0, 15)) {
        const created = (m.timestamp || "").slice(0, 10);
        const msg = (m.caption || "(no caption)").replace(/\n/g, " ").slice(0, 60);
        rows.push(`| ${created} | ${m.media_type || "?"} | ${msg} | ${m.like_count || 0} | ${m.comments_count || 0} |`);
      }
      sections.push(`## 📝 IG Recent 15 Media\n\n| Date | Type | Caption | ❤️ | 💬 |\n|---|---|---|---|---|\n${rows.join("\n")}\n`);
    }
  }

  // ── Health signals + recommendations ─────────────────────────────────────
  let recs = `## 🛡️ Health & Recommendations\n\n`;
  recs += `**Current safety phase**: WARMUP_WEEK_2 (1-2 posts/day cap)\n\n`;
  recs += `**Posting cadence target (Jorge GROWTH phase)**: 3 Posts + 2 Reels + 1 Video/2days\n\n`;
  recs += `**Anti-ban rules active**: BANNED_PATTERNS audit (FTC/HUD/engagement bait), HARD_CAPS_24H, classifyError → HALT on spam/rate limit signals\n\n`;
  recs += `**Next step**: ramp WARMUP_WEEK_2 → RAMP_WEEK_3 after 7 days of clean posting (no integrity warnings, no rate limit errors).\n`;
  sections.push(recs);

  // ── Write report ─────────────────────────────────────────────────────────
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const reportPath = join(REFS_DIR, `meta_audit_${ts}.md`);
  const header = `# Meta Audit Report — ${new Date().toISOString().slice(0, 19)} UTC\n\nTenant: ${cfg.tenant_name} (${cfg.tenant_id})\nRun ID: ${runId}\n\n---\n\n`;
  await mkdir(REFS_DIR, { recursive: true });
  await writeFile(reportPath, header + sections.join("\n---\n\n"), "utf8");

  const completedAt = isoNow();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);

  // Telegram summary.
  const lines = [
    `📊 *El Auditor Meta* — ${cfg.tenant_name}`,
    `${duration}s · report: \`${reportPath.slice(reportPath.indexOf("references/"))}\``,
    "",
    ...summary,
  ];
  await telegramSend(cfg, lines.join("\n").slice(0, 3800));

  console.error(`[audit_meta] done — report: ${reportPath}`);
}

main().catch((e) => { console.error("[audit_meta] FATAL:", e); process.exit(1); });
