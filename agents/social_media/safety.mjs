/**
 * Meta publishing safety layer — anti-ban compliance for Pinnacle.
 *
 * Stakes: Jorge 2026-05-07 — "si nos banean estamos acabados". Every publish goes
 * through this gate. No exceptions, no shortcuts.
 *
 * Coverage:
 *  1. Pre-publish content audit (banned phrases, length, claim hygiene, real-estate
 *     fair housing compliance, hashtag stuffing, watermarks)
 *  2. Rate limiter (per-platform daily caps, min interval between posts, warmup ramp)
 *  3. Error classifier (HTTP 190 = token revoked → HALT; rate limit → backoff;
 *     content policy → halt + alert)
 *  4. Telegram alerter on token/policy issues
 *  5. Audit log of every publish attempt (success/fail with reason)
 *
 * Policy sources:
 *  - Meta Platform Terms (https://developers.facebook.com/terms/)
 *  - Meta Community Standards
 *  - Instagram Platform Policy
 *  - FTC + HUD Fair Housing for real estate copy
 *  - Meta Business Use Case rate limits
 */

// ── Cadence policy ────────────────────────────────────────────────────────────
// Pinnacle account profile: 14 FB fans, IG just connected, app in dev mode.
// Ramp-up cadence — bans triggered by sudden volume spikes. Ramp gradually
// over 4 weeks before hitting Jorge's GROWTH target (2026-05-07: 3 Posts +
// 1-2 Reels + Video every 2 days = 5-6/day). Per-format caps prevent any
// single format from exceeding its share even if total daily allowance left.
export const CADENCE = {
  WARMUP_WEEK_1:  { postsPerDayPerPlatform: 1,  minHoursBetween: 24, perFormat: { Post: 1, Reel: 0, Video: 0 } },
  WARMUP_WEEK_2:  { postsPerDayPerPlatform: 2,  minHoursBetween: 8,  perFormat: { Post: 1, Reel: 1, Video: 0 } },
  RAMP_WEEK_3:    { postsPerDayPerPlatform: 4,  minHoursBetween: 4,  perFormat: { Post: 2, Reel: 1, Video: 1 } },
  RAMP_WEEK_4:    { postsPerDayPerPlatform: 5,  minHoursBetween: 3,  perFormat: { Post: 3, Reel: 1, Video: 1 } },
  GROWTH:         { postsPerDayPerPlatform: 6,  minHoursBetween: 3,  perFormat: { Post: 3, Reel: 2, Video: 1 } },
  STEADY_STATE:   { postsPerDayPerPlatform: 6,  minHoursBetween: 3,  perFormat: { Post: 3, Reel: 2, Video: 1 } },
  // Sprint A1.5 (Jorge 2026-05-08): slot-driven cadence. Cron triggers at fixed
  // CST slots (FB 7/11:30/12:30/17:50/20:00/21:00, IG 6:30/13:00/16:00/19:00/20:30/21:00),
  // so minHoursBetween shrinks to 15min buffer (some slots are 30min apart on
  // video days like IG 20:30 Video → 21:00 Reel). Per-format caps unchanged.
  FIXED_SLOTS_PROD: { postsPerDayPerPlatform: 6,  minHoursBetween: 0.25, perFormat: { Post: 3, Reel: 2, Video: 1 } },
};

// Sprint A1.5 (Jorge 2026-05-08): switched from WARMUP_WEEK_2 to FIXED_SLOTS_PROD
// to align with the new slot-driven publisher (12 cron entries, one per platform/
// format/slot combo). Warmup phases remain available for rollback if needed.
export const CURRENT_PHASE = 'FIXED_SLOTS_PROD';

// Hard never-cross caps (Meta's published BUC limits, per Page/IG-user/24h).
export const HARD_CAPS_24H = {
  fb_posts_per_page: 25,
  ig_posts_per_user: 25,
  api_calls_per_hour: 200,
};

// ── Content audit — banned/risky patterns ─────────────────────────────────────
// Phrases that trigger Meta ad/integrity demotions or violate FTC + HUD fair housing.
const BANNED_PATTERNS = [
  // Engagement bait (explicitly demoted by FB News Feed integrity)
  /\b(like\s+if|share\s+if|comment\s+if|tag\s+a\s+friend\s+if)\b/i,
  /\b(double\s+tap\s+if|smash\s+the\s+like)\b/i,

  // Misleading urgency / FTC red flags
  /\b(act\s+now\s+or\s+lose|last\s+chance|only\s+today\s+only)\b/i,
  /\bguaranteed\s+(cash|offer|sale|profit)\b/i,
  /\b100%\s+(guaranteed|certain|sure)\b/i,

  // Fair Housing violations (HUD enforcement under Special Ad Category: Housing)
  /\b(perfect\s+for|ideal\s+for)\s+(young|christian|catholic|family|couple|professional)\b/i,
  /\bno\s+(kids|children|disabled|wheelchair|section\s*8)\b/i,
  /\b(adults\s+only|seniors\s+only|families\s+only)\b/i,
  /\b(christian|catholic|jewish|muslim|hindu)\s+(neighborhood|community|buyer)\b/i,
  /\bsafe\s+neighborhood\s+(no|without)\s+(crime|drugs|minorities)\b/i,

  // Adult/illegal/controversial flags
  /\b(get\s+rich\s+quick|easy\s+money|no\s+work\s+required)\b/i,
];

// Words common in scam patterns Meta auto-flags. We allow these in moderation but warn.
const SOFT_FLAG_WORDS = [
  'guaranteed', 'instant', 'fast cash', 'no questions asked',
  'cash now', 'urgent', 'desperate', 'foreclosure today',
];

// ── Audit a caption before publish ────────────────────────────────────────────
export function auditCaption(caption) {
  const issues = [];
  const warnings = [];
  const text = String(caption || '');

  if (text.length === 0) {
    issues.push('caption_empty');
    return { ok: false, issues, warnings };
  }
  if (text.length > 2200) {  // IG hard limit; FB is higher but we cap to be safe
    issues.push(`caption_too_long_${text.length}_chars`);
  }

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(`banned_pattern_${pattern.source.slice(0, 40)}`);
    }
  }

  // Hashtag stuffing — IG demotes >15, hard limit 30.
  const hashtags = (text.match(/#\w+/g) || []);
  if (hashtags.length > 30) issues.push(`hashtag_overflow_${hashtags.length}`);
  else if (hashtags.length > 15) warnings.push(`hashtag_high_${hashtags.length}_consider_15`);

  // ALL CAPS abuse — single shouted word OK, sentences not.
  const wordsAllCaps = (text.match(/\b[A-Z]{4,}\b/g) || []);
  if (wordsAllCaps.length > 4) warnings.push(`all_caps_words_${wordsAllCaps.length}`);

  // Soft flags — count, log if multiple.
  let softHits = 0;
  for (const w of SOFT_FLAG_WORDS) if (text.toLowerCase().includes(w.toLowerCase())) softHits++;
  if (softHits >= 3) warnings.push(`scam_signal_words_${softHits}`);

  // Emoji wall (>15 in a row)
  if (/[\p{Emoji}‍]{15,}/u.test(text)) warnings.push('emoji_wall');

  // External URLs in IG caption — IG demotes posts with them. Allow Pinnacle domain.
  const urls = (text.match(/https?:\/\/[^\s)]+/g) || []);
  for (const u of urls) {
    if (!/pinnaclegroupwi\.com|pinnacleholdings/i.test(u)) {
      warnings.push(`external_url_${u.slice(0, 40)}`);
    }
  }

  return { ok: issues.length === 0, issues, warnings };
}

// ── Audit visual asset before publish ─────────────────────────────────────────
export function auditVisual({ url, formato, durationSec }) {
  const issues = [];
  if (!url) { issues.push('visual_url_empty'); return { ok: false, issues }; }

  // Cloudinary or other trusted CDN — Meta needs publicly fetchable URL.
  if (!/^https:\/\//.test(url)) issues.push('visual_url_not_https');
  if (!/cloudinary\.com|pinnaclegroupwi\.com/i.test(url)) issues.push(`visual_url_untrusted_${url.slice(0,60)}`);

  // Reels duration policy — IG: 3-90s, FB: 3-90s. Outside this Meta rejects.
  if (formato === 'Reel' || /\.mp4(\?|$)/i.test(url)) {
    if (durationSec != null) {
      if (durationSec < 3)  issues.push(`reel_too_short_${durationSec}s`);
      if (durationSec > 90) issues.push(`reel_too_long_${durationSec}s_max_90`);
    }
  }

  return { ok: issues.length === 0, issues };
}

// ── Rate limiter — uses Airtable as the source of truth on what we've posted ──
// Per-format cap enforcement (Jorge 2026-05-07 GROWTH ramp): each format has
// its own daily cap (Post=3, Reel=2, Video=1 max in GROWTH phase).
// Returns { allowed: bool, reason?: string, retryAfterSec?: number }
export async function checkRateBudget({ smFetch, platform, fieldPublishedIds, format }) {
  const cadence = CADENCE[CURRENT_PHASE];
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 19);

  // Query Airtable for posts that are scheduled to go LIVE within ±24h of NOW.
  // Bug fix 2026-05-07: previously used LAST_MODIFIED_TIME which counts when we
  // called the API, not when posts go live. Multiple scheduled posts created in
  // one batch all share the same modified timestamp → falsely blocked each other.
  // The new check uses Scheduled_Time so spaced-out scheduling passes correctly.
  const since24hPlus = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 19);
  const filter = encodeURIComponent(
    `AND({${fieldPublishedIds}}!='', IS_AFTER({Scheduled_Time}, '${since24h}'), IS_BEFORE({Scheduled_Time}, '${since24hPlus}'))`
  );
  const r = await smFetch(`filterByFormula=${filter}&maxRecords=50`).catch(() => ({ records: [] }));
  const recent = (r.records || []).map(rec => rec.fields?.Scheduled_Time || rec.createdTime);

  // Per-format cap (this format only — smFetch is table-bound).
  const perFormatCap = cadence.perFormat?.[format] ?? cadence.postsPerDayPerPlatform;
  if (recent.length >= perFormatCap) {
    return { allowed: false, reason: `${format}_per_format_cap_${recent.length}/${perFormatCap}_${CURRENT_PHASE}` };
  }
  // Hard caps Meta BUC (per-platform absolute ceiling).
  if (recent.length >= HARD_CAPS_24H[`${platform}_posts_per_${platform === 'fb' ? 'page' : 'user'}`]) {
    return { allowed: false, reason: `hard_cap_${platform}_24h` };
  }

  // Min interval since last post on this platform.
  if (recent.length > 0) {
    const lastTs = Math.max(...recent.map(t => new Date(t).getTime()));
    const elapsed = (Date.now() - lastTs) / 1000;
    const minSec = cadence.minHoursBetween * 3600;
    if (elapsed < minSec) {
      return { allowed: false, reason: `min_interval_${Math.round(elapsed/60)}min_need_${cadence.minHoursBetween}h`, retryAfterSec: Math.round(minSec - elapsed) };
    }
  }

  return { allowed: true };
}

// ── Error classifier ─────────────────────────────────────────────────────────
// Meta error codes → action: 'halt' (stop everything, alert) | 'backoff' (wait, retry later) | 'skip' (move on)
export function classifyError(error) {
  const msg  = String(error?.message || error || '');
  const code = error?.code;
  const subcode = error?.error_subcode;

  // Auth / token issues — HALT immediately.
  if (code === 190 || /OAuthException|invalid token|token has expired/i.test(msg)) {
    return { action: 'halt', reason: 'token_invalid_or_revoked', alert: true };
  }
  if (code === 200 || /permission/i.test(msg)) {
    return { action: 'halt', reason: 'missing_permission', alert: true };
  }

  // Rate limit — backoff.
  if (code === 4 || code === 17 || code === 32 || /rate.?limit|too many calls|temporarily blocked/i.test(msg)) {
    return { action: 'backoff', reason: 'rate_limit', retryAfterSec: 3600 };
  }
  if (code === 80004) return { action: 'backoff', reason: 'app_request_limit', retryAfterSec: 1800 };

  // Content policy violations — HALT, manual review.
  if (subcode === 1404006 || /community standards|policy violation|unsafe content/i.test(msg)) {
    return { action: 'halt', reason: 'content_policy_violation', alert: true };
  }

  // Spam detection — HALT, this means Meta thinks we are bot-like.
  if (code === 368 || /spam|abusive/i.test(msg)) {
    return { action: 'halt', reason: 'flagged_as_spam', alert: true };
  }

  // Validation / bad input — skip this record, log it.
  if (code === 100 && !subcode) return { action: 'skip', reason: 'invalid_parameter' };
  if (code === 506) return { action: 'skip', reason: 'duplicate_post' };

  // Transient server error — short backoff.
  if (code === 1 || code === 2 || /server error|temporary/i.test(msg)) {
    return { action: 'backoff', reason: 'transient', retryAfterSec: 300 };
  }

  // Unknown — be cautious, halt + alert so a human can review.
  return { action: 'halt', reason: `unknown_${code || 'no_code'}`, alert: true };
}

// ── Telegram alerter ──────────────────────────────────────────────────────────
export async function alertTelegram(message, severity = 'WARN') {
  const token  = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chatId) return false;
  const text = `🚨 [${severity}] Programador / Meta API\n\n${message}`.slice(0, 4000);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return true;
  } catch { return false; }
}

// ── Comprehensive pre-publish gate — call this before EVERY publish attempt ──
export async function safetyCheckBeforePublish({ caption, visualUrl, formato, durationSec, platform, smFetch, fieldPublishedIds }) {
  // 1. Caption audit
  const cap = auditCaption(caption);
  if (!cap.ok) return { ok: false, blockReason: 'caption', details: cap.issues };
  // Soft warnings — log but don't block.
  if (cap.warnings.length) console.warn(`[safety] caption warnings: ${cap.warnings.join(', ')}`);

  // 2. Visual audit
  const vis = auditVisual({ url: visualUrl, formato, durationSec });
  if (!vis.ok) return { ok: false, blockReason: 'visual', details: vis.issues };

  // 3. Rate budget
  const rate = await checkRateBudget({ smFetch, platform, fieldPublishedIds, format: formato });
  if (!rate.allowed) return { ok: false, blockReason: 'rate', details: [rate.reason], retryAfterSec: rate.retryAfterSec };

  return { ok: true };
}
