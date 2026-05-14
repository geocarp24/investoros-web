/**
 * audit_scoring.mjs — Audit_Score + Audit_Tier calculator for engagement records.
 *
 * Used by El Analítico after collecting Meta Graph insights to assign each
 * Published record a tier so SM Manager (Sprint A10 Phase B) can recycle the
 * top performers for the next 2-week cycle.
 *
 * Sprint A8 — Jorge 2026-05-08.
 *
 * Score formula (weighted engagement):
 *   weighted = likes*1 + comments*3 + shares*5 + saves*3
 *   score    = (weighted / max(reach, 1)) * 100
 *   capped   = min(score, 100)
 *
 * Why these weights:
 *   • likes   — passive signal, abundant, low intent
 *   • comments — active, intent-rich (3x)
 *   • shares  — endorsement to reader's network (5x, strongest amplifier)
 *   • saves   — IG-only "save for later" = intent to revisit (3x)
 *
 * Tiers (initial absolute thresholds, refinable to percentile-based in A10):
 *   Premium ≥ 10
 *   Good    5 – 9.99
 *   Fair    2 – 4.99
 *   Poor    < 2
 */

export const TIERS = Object.freeze(["Premium", "Good", "Fair", "Poor"]);

// Default thresholds — tuned for Pinnacle baseline. Override via opts for tests
// or for percentile-based tiering once we have ≥30 days of data.
export const DEFAULT_TIER_THRESHOLDS = Object.freeze({
  Premium: 10,
  Good: 5,
  Fair: 2,
  // Poor = anything below Fair
});

export const DEFAULT_WEIGHTS = Object.freeze({
  likes: 1,
  comments: 3,
  shares: 5,
  saves: 3,
});

/**
 * Compute weighted engagement score from raw metrics.
 *
 * @param {object} m - { reach, likes, comments, shares, saves }
 * @param {object} [opts] - { weights }
 * @returns {number} score 0..100
 */
export function computeAuditScore(m, { weights = DEFAULT_WEIGHTS } = {}) {
  const reach = Math.max(Number(m?.reach) || 0, 0);
  if (reach === 0) return 0;
  const likes    = Math.max(Number(m?.likes) || 0, 0);
  const comments = Math.max(Number(m?.comments) || 0, 0);
  const shares   = Math.max(Number(m?.shares) || 0, 0);
  const saves    = Math.max(Number(m?.saves) || 0, 0);
  const weighted = likes * weights.likes + comments * weights.comments + shares * weights.shares + saves * weights.saves;
  const raw = (weighted / reach) * 100;
  // Cap at 100 (extreme cases like reach=10 with comments=20 would otherwise yield >100)
  return Math.min(Math.round(raw * 100) / 100, 100);
}

/**
 * Map a numeric score to a tier label using thresholds.
 *
 * @param {number} score - 0..100
 * @param {object} [opts] - { thresholds }
 * @returns {"Premium"|"Good"|"Fair"|"Poor"}
 */
export function scoreToTier(score, { thresholds = DEFAULT_TIER_THRESHOLDS } = {}) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "Poor";
  if (score >= thresholds.Premium) return "Premium";
  if (score >= thresholds.Good) return "Good";
  if (score >= thresholds.Fair) return "Fair";
  return "Poor";
}

/**
 * One-shot: metrics → { score, tier }.
 */
export function audit(m, opts = {}) {
  const score = computeAuditScore(m, opts);
  const tier = scoreToTier(score, opts);
  return { score, tier };
}

/**
 * Compute percentile-based thresholds from a historical population.
 * Use case: weekly recalibration once we have 30+ Published records.
 *
 * @param {number[]} scores - past scores (>= 10 needed for stable percentiles)
 * @returns {object} thresholds (or DEFAULT if insufficient sample)
 */
export function percentileThresholds(scores) {
  const valid = (scores || []).filter(s => Number.isFinite(s) && s >= 0).sort((a, b) => a - b);
  if (valid.length < 10) return DEFAULT_TIER_THRESHOLDS;
  const pct = (p) => valid[Math.min(Math.floor(valid.length * p), valid.length - 1)];
  return {
    Premium: pct(0.75),
    Good:    pct(0.50),
    Fair:    pct(0.25),
  };
}

/**
 * Bucket a list of records into tiers and return summary counts + top performers.
 * Used for weekly Telegram report.
 *
 * @param {Array<{score:number, title:string, id:string}>} items
 * @returns {object}
 */
export function summarizeTiers(items, opts = {}) {
  const buckets = { Premium: [], Good: [], Fair: [], Poor: [] };
  for (const it of items) {
    const tier = scoreToTier(it.score, opts);
    buckets[tier].push(it);
  }
  for (const t of TIERS) buckets[t].sort((a, b) => b.score - a.score);
  return {
    counts: { Premium: buckets.Premium.length, Good: buckets.Good.length, Fair: buckets.Fair.length, Poor: buckets.Poor.length },
    topPremium: buckets.Premium.slice(0, 5),
    bottomPoor: buckets.Poor.slice(-5),
    buckets,
  };
}
