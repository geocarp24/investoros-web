/**
 * Tests for theme_bank_loader.mjs.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  loadThemeBank,
  pickSubtopic,
  pickBatch,
  makePlatformAssigner,
  decideFormat,
} from "../theme_bank_loader.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_TB_PATH = join(HERE, "..", "theme_bank.json");

// Deterministic RNG — sequence of numbers in [0,1) for predictable picks.
function seqRng(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

// ────────────────────────────────────────────────────────────
// loadThemeBank
// ────────────────────────────────────────────────────────────
describe("loadThemeBank", () => {
  test("loads real theme_bank.json successfully", () => {
    const tb = loadThemeBank(REAL_TB_PATH);
    assert.ok(tb);
    assert.equal(tb.pillars.length, 8);
    assert.equal(tb._totalSubtopics, 170);
  });

  test("validates: weights sum to 100", () => {
    const tb = loadThemeBank(REAL_TB_PATH);
    const sum = tb.pillars.reduce((s, p) => s + p.weight_pct, 0);
    assert.equal(sum, 100);
  });

  test("each pillar has non-empty subtopics", () => {
    const tb = loadThemeBank(REAL_TB_PATH);
    for (const p of tb.pillars) {
      assert.ok(p.subtopics.length > 0, `${p.id} should have subtopics`);
    }
  });

  test("each subtopic has id + at least one title", () => {
    const tb = loadThemeBank(REAL_TB_PATH);
    for (const p of tb.pillars) {
      for (const s of p.subtopics) {
        assert.ok(s.id, `${p.id} subtopic missing id`);
        assert.ok(s.title_en || s.title_es, `${s.id} missing title`);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────
// pickSubtopic — weighted random
// ────────────────────────────────────────────────────────────
describe("pickSubtopic", () => {
  const realTb = loadThemeBank(REAL_TB_PATH);

  test("returns valid pillar + subtopic pair", () => {
    const pick = pickSubtopic(realTb);
    assert.ok(pick);
    assert.ok(pick.pillar);
    assert.ok(pick.subtopic);
    assert.ok(pick.subtopic.id);
  });

  test("respects weights statistically (1000 samples)", () => {
    const counts = {};
    for (let i = 0; i < 1000; i++) {
      const pick = pickSubtopic(realTb);
      counts[pick.pillar.id] = (counts[pick.pillar.id] || 0) + 1;
    }
    // Cash Offer (25%) should be most picked (43 subtopics × ~25% weight)
    // Expected ~250 over 1000. Tolerance ±15% (35-65% deviation OK for 1000 samples).
    const cashOffer = counts.cash_offer_education || 0;
    assert.ok(cashOffer > 150, `cash_offer should be picked >150 times, got ${cashOffer}`);
    assert.ok(cashOffer < 400, `cash_offer should be picked <400 times, got ${cashOffer}`);
  });

  test("excludes ids in excludeIds", () => {
    const allFcIds = realTb.pillars
      .find(p => p.id === "foreclosure_help").subtopics.map(s => s.id);
    const excluded = allFcIds.slice(0, 5); // exclude first 5 fc ids
    for (let i = 0; i < 100; i++) {
      const pick = pickSubtopic(realTb, { excludeIds: excluded });
      assert.ok(!excluded.includes(pick.subtopic.id), `should not pick excluded ${pick.subtopic.id}`);
    }
  });

  test("returns null when all subtopics excluded", () => {
    const allIds = [];
    for (const p of realTb.pillars) {
      for (const s of p.subtopics) allIds.push(s.id);
    }
    const result = pickSubtopic(realTb, { excludeIds: allIds });
    assert.equal(result, null);
  });

  test("with seeded rng produces deterministic output", () => {
    const rng = seqRng([0.0, 0.0]);
    const pick = pickSubtopic(realTb, { rng });
    // First pillar (Cash Offer 25% — first in order), first subtopic
    assert.equal(pick.pillar.id, "cash_offer_education");
    assert.equal(pick.subtopic.id, "co_001");
  });
});

// ────────────────────────────────────────────────────────────
// pickBatch — N distinct
// ────────────────────────────────────────────────────────────
describe("pickBatch", () => {
  const realTb = loadThemeBank(REAL_TB_PATH);

  test("draws N distinct subtopics", () => {
    const batch = pickBatch(realTb, 20);
    assert.equal(batch.length, 20);
    const ids = new Set(batch.map(b => b.subtopic.id));
    assert.equal(ids.size, 20, "all subtopics should be unique");
  });

  test("can draw up to total inventory (170)", () => {
    const batch = pickBatch(realTb, 170);
    assert.equal(batch.length, 170);
    const ids = new Set(batch.map(b => b.subtopic.id));
    assert.equal(ids.size, 170, "all 170 subtopics should appear once");
  });

  test("requesting more than inventory caps at inventory size", () => {
    const batch = pickBatch(realTb, 500);
    assert.equal(batch.length, 170);
  });

  test("respects pre-existing excludeIds", () => {
    const exclude = ["co_001", "fc_001"];
    const batch = pickBatch(realTb, 50, { excludeIds: exclude });
    for (const item of batch) {
      assert.ok(!exclude.includes(item.subtopic.id));
    }
  });
});

// ────────────────────────────────────────────────────────────
// makePlatformAssigner
// ────────────────────────────────────────────────────────────
describe("makePlatformAssigner", () => {
  test("alternates FB/IG/FB/IG starting with FB", () => {
    const next = makePlatformAssigner(0);
    assert.equal(next(), "FB");
    assert.equal(next(), "IG");
    assert.equal(next(), "FB");
    assert.equal(next(), "IG");
  });

  test("with startIndex=1 begins with IG", () => {
    const next = makePlatformAssigner(1);
    assert.equal(next(), "IG");
    assert.equal(next(), "FB");
  });

  test("over 100 calls yields 50/50 distribution", () => {
    const next = makePlatformAssigner(0);
    let fb = 0, ig = 0;
    for (let i = 0; i < 100; i++) (next() === "FB" ? fb++ : ig++);
    assert.equal(fb, 50);
    assert.equal(ig, 50);
  });
});

// ────────────────────────────────────────────────────────────
// decideFormat
// ────────────────────────────────────────────────────────────
describe("decideFormat", () => {
  test("uses subtopic.format_hint if present", () => {
    const pillar = { preferred_formats: ["Reel"] };
    const subtopic = { format_hint: "Video" };
    assert.equal(decideFormat(pillar, subtopic), "Video");
  });

  test("falls back to pillar.preferred_formats[0]", () => {
    const pillar = { preferred_formats: ["Reel", "Post"] };
    const subtopic = {};
    assert.equal(decideFormat(pillar, subtopic), "Reel");
  });

  test("defaults to Post if nothing specified", () => {
    const pillar = {};
    const subtopic = {};
    assert.equal(decideFormat(pillar, subtopic), "Post");
  });
});

// ────────────────────────────────────────────────────────────
// Integration — real theme bank distribution check
// ────────────────────────────────────────────────────────────
describe("integration — full week batch (78 records)", () => {
  test("can draw 78 distinct subtopics for a week", () => {
    const realTb = loadThemeBank(REAL_TB_PATH);
    const batch = pickBatch(realTb, 78);
    assert.equal(batch.length, 78);
    const ids = new Set(batch.map(b => b.subtopic.id));
    assert.equal(ids.size, 78);
  });

  test("assigning FB/IG to weekly batch gives ~50/50", () => {
    const realTb = loadThemeBank(REAL_TB_PATH);
    const batch = pickBatch(realTb, 78);
    const next = makePlatformAssigner(0);
    let fb = 0, ig = 0;
    for (const _ of batch) (next() === "FB" ? fb++ : ig++);
    assert.equal(fb, 39, "should be 39 FB in 78");
    assert.equal(ig, 39, "should be 39 IG in 78");
  });
});
