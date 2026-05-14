/**
 * Tests for audit_scoring.mjs.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TIERS,
  DEFAULT_TIER_THRESHOLDS,
  DEFAULT_WEIGHTS,
  computeAuditScore,
  scoreToTier,
  audit,
  percentileThresholds,
  summarizeTiers,
} from "../audit_scoring.mjs";

describe("TIERS + defaults", () => {
  test("4 tiers: Premium / Good / Fair / Poor", () => {
    assert.deepEqual([...TIERS], ["Premium", "Good", "Fair", "Poor"]);
  });

  test("DEFAULT_TIER_THRESHOLDS values", () => {
    assert.equal(DEFAULT_TIER_THRESHOLDS.Premium, 10);
    assert.equal(DEFAULT_TIER_THRESHOLDS.Good, 5);
    assert.equal(DEFAULT_TIER_THRESHOLDS.Fair, 2);
  });

  test("DEFAULT_WEIGHTS: likes=1, comments=3, shares=5, saves=3", () => {
    assert.equal(DEFAULT_WEIGHTS.likes, 1);
    assert.equal(DEFAULT_WEIGHTS.comments, 3);
    assert.equal(DEFAULT_WEIGHTS.shares, 5);
    assert.equal(DEFAULT_WEIGHTS.saves, 3);
  });
});

describe("computeAuditScore", () => {
  test("zero reach → 0", () => {
    assert.equal(computeAuditScore({ reach: 0, likes: 100 }), 0);
  });

  test("missing reach → 0", () => {
    assert.equal(computeAuditScore({}), 0);
  });

  test("only likes: score = likes/reach * 100", () => {
    // reach=100, likes=10 → 10*1/100 *100 = 10
    assert.equal(computeAuditScore({ reach: 100, likes: 10 }), 10);
  });

  test("comments worth 3x likes", () => {
    const sLikes = computeAuditScore({ reach: 100, likes: 10 });
    const sComments = computeAuditScore({ reach: 100, comments: 10 });
    assert.equal(sComments, sLikes * 3);
  });

  test("shares worth 5x likes", () => {
    const sLikes = computeAuditScore({ reach: 100, likes: 10 });
    const sShares = computeAuditScore({ reach: 100, shares: 10 });
    assert.equal(sShares, sLikes * 5);
  });

  test("saves worth 3x likes (IG only)", () => {
    const sLikes = computeAuditScore({ reach: 100, likes: 10 });
    const sSaves = computeAuditScore({ reach: 100, saves: 10 });
    assert.equal(sSaves, sLikes * 3);
  });

  test("score capped at 100 (no extremes)", () => {
    // Tiny reach, big shares → could be > 100 if uncapped.
    const score = computeAuditScore({ reach: 10, shares: 100 });
    assert.equal(score, 100);
  });

  test("realistic Pinnacle example: reach=500, likes=20, comments=3, shares=2, saves=5", () => {
    // weighted = 20*1 + 3*3 + 2*5 + 5*3 = 20 + 9 + 10 + 15 = 54
    // score = 54/500*100 = 10.8
    assert.equal(computeAuditScore({ reach: 500, likes: 20, comments: 3, shares: 2, saves: 5 }), 10.8);
  });

  test("negative metrics treated as 0", () => {
    assert.equal(computeAuditScore({ reach: 100, likes: -50, comments: 10 }), 30);
  });
});

describe("scoreToTier", () => {
  test("score >= 10 → Premium", () => {
    assert.equal(scoreToTier(10), "Premium");
    assert.equal(scoreToTier(15), "Premium");
    assert.equal(scoreToTier(100), "Premium");
  });

  test("5 ≤ score < 10 → Good", () => {
    assert.equal(scoreToTier(5), "Good");
    assert.equal(scoreToTier(7.5), "Good");
    assert.equal(scoreToTier(9.99), "Good");
  });

  test("2 ≤ score < 5 → Fair", () => {
    assert.equal(scoreToTier(2), "Fair");
    assert.equal(scoreToTier(3.5), "Fair");
    assert.equal(scoreToTier(4.99), "Fair");
  });

  test("score < 2 → Poor", () => {
    assert.equal(scoreToTier(0), "Poor");
    assert.equal(scoreToTier(1.99), "Poor");
    assert.equal(scoreToTier(1), "Poor");
  });

  test("invalid → Poor", () => {
    assert.equal(scoreToTier(NaN), "Poor");
    assert.equal(scoreToTier(undefined), "Poor");
    assert.equal(scoreToTier(null), "Poor");
    assert.equal(scoreToTier("high"), "Poor");
  });

  test("custom thresholds override defaults", () => {
    const t = { Premium: 50, Good: 30, Fair: 10 };
    assert.equal(scoreToTier(40, { thresholds: t }), "Good");
    assert.equal(scoreToTier(15, { thresholds: t }), "Fair");
    assert.equal(scoreToTier(60, { thresholds: t }), "Premium");
  });
});

describe("audit (one-shot)", () => {
  test("returns { score, tier } in one call", () => {
    const r = audit({ reach: 500, likes: 50, comments: 10, shares: 5, saves: 8 });
    assert.equal(typeof r.score, "number");
    assert.ok(TIERS.includes(r.tier));
  });

  test("Premium-tier example", () => {
    // reach=200, comments=20, shares=10 → weighted=20*3 + 10*5 = 110 → 55%
    const r = audit({ reach: 200, comments: 20, shares: 10 });
    assert.equal(r.tier, "Premium");
    assert.ok(r.score >= 10);
  });

  test("Poor-tier example", () => {
    // reach=1000, likes=5 → 0.5%
    const r = audit({ reach: 1000, likes: 5 });
    assert.equal(r.tier, "Poor");
    assert.ok(r.score < 2);
  });
});

describe("percentileThresholds", () => {
  test("returns DEFAULT when sample < 10", () => {
    const r = percentileThresholds([1, 2, 3, 4, 5]);
    assert.deepEqual(r, DEFAULT_TIER_THRESHOLDS);
  });

  test("computes p75/p50/p25 from valid sample", () => {
    const scores = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
    const r = percentileThresholds(scores);
    // p75 of 1..20 ~ 15-16, p50 ~ 10-11, p25 ~ 5-6
    assert.ok(r.Premium >= 14 && r.Premium <= 17);
    assert.ok(r.Good >= 9 && r.Good <= 12);
    assert.ok(r.Fair >= 4 && r.Fair <= 7);
  });

  test("filters out invalid scores", () => {
    const scores = [...Array.from({ length: 10 }, (_, i) => i + 1), NaN, -5, undefined];
    const r = percentileThresholds(scores);
    assert.ok(Number.isFinite(r.Premium));
    assert.ok(Number.isFinite(r.Good));
    assert.ok(Number.isFinite(r.Fair));
  });
});

describe("summarizeTiers", () => {
  test("buckets items by tier", () => {
    const items = [
      { id: "a", title: "A", score: 12 },  // Premium
      { id: "b", title: "B", score: 7 },   // Good
      { id: "c", title: "C", score: 3 },   // Fair
      { id: "d", title: "D", score: 0.5 }, // Poor
      { id: "e", title: "E", score: 11 },  // Premium
    ];
    const s = summarizeTiers(items);
    assert.equal(s.counts.Premium, 2);
    assert.equal(s.counts.Good, 1);
    assert.equal(s.counts.Fair, 1);
    assert.equal(s.counts.Poor, 1);
  });

  test("topPremium sorted by score descending", () => {
    const items = [
      { id: "a", title: "A", score: 12 },
      { id: "b", title: "B", score: 25 },
      { id: "c", title: "C", score: 18 },
    ];
    const s = summarizeTiers(items);
    assert.equal(s.topPremium[0].id, "b");
    assert.equal(s.topPremium[1].id, "c");
    assert.equal(s.topPremium[2].id, "a");
  });

  test("empty input → all zero counts", () => {
    const s = summarizeTiers([]);
    assert.equal(s.counts.Premium, 0);
    assert.equal(s.counts.Good, 0);
    assert.equal(s.counts.Fair, 0);
    assert.equal(s.counts.Poor, 0);
  });
});

describe("integration — realistic Pinnacle weekly batch", () => {
  test("78 records distribute across all 4 tiers", () => {
    // Simulate a week of records with varied performance
    const items = [];
    for (let i = 0; i < 78; i++) {
      // Vary engagement quality across the population
      const reach = 200 + (i * 5);
      const likes = Math.floor(reach * 0.02 * (1 + (i % 5) * 0.3));
      const comments = Math.floor(likes * 0.1 * (1 + (i % 3) * 0.5));
      const shares = Math.floor(comments * 0.5);
      const saves = Math.floor(likes * 0.05);
      const score = computeAuditScore({ reach, likes, comments, shares, saves });
      items.push({ id: `rec_${i}`, title: `Record ${i}`, score });
    }
    const s = summarizeTiers(items);
    const total = s.counts.Premium + s.counts.Good + s.counts.Fair + s.counts.Poor;
    assert.equal(total, 78);
  });
});
