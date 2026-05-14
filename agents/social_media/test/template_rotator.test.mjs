/**
 * Tests for template_rotator.mjs.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATES,
  makeTemplateRotator,
  isValidTemplate,
  defaultTemplateForTone,
} from "../template_rotator.mjs";

describe("TEMPLATES inventory", () => {
  test("contains exactly 5 templates", () => {
    assert.equal(TEMPLATES.length, 5);
  });

  test("includes all 5 approved Jorge 2026-05-07", () => {
    for (const t of ["hybrid", "pip", "voiceover", "talkinghead", "editorial"]) {
      assert.ok(TEMPLATES.includes(t), `missing ${t}`);
    }
  });

  test("is frozen (immutable)", () => {
    assert.throws(() => { TEMPLATES.push("newone"); });
  });
});

describe("makeTemplateRotator", () => {
  test("rotates through all 5 then loops", () => {
    const next = makeTemplateRotator(0);
    assert.equal(next(), "hybrid");
    assert.equal(next(), "pip");
    assert.equal(next(), "voiceover");
    assert.equal(next(), "talkinghead");
    assert.equal(next(), "editorial");
    assert.equal(next(), "hybrid"); // looped
  });

  test("startIndex=2 begins at voiceover", () => {
    const next = makeTemplateRotator(2);
    assert.equal(next(), "voiceover");
    assert.equal(next(), "talkinghead");
    assert.equal(next(), "editorial");
    assert.equal(next(), "hybrid");
  });

  test("startIndex out of range wraps via modulo", () => {
    const next = makeTemplateRotator(7);
    // 7 % 5 = 2 → voiceover
    assert.equal(next(), "voiceover");
  });

  test("28 calls (week of Reels) gives ~5-6 of each", () => {
    const next = makeTemplateRotator(0);
    const counts = {};
    for (let i = 0; i < 28; i++) {
      const t = next();
      counts[t] = (counts[t] || 0) + 1;
    }
    // 28 / 5 = 5.6 — each template should appear 5 or 6 times
    for (const t of TEMPLATES) {
      assert.ok(counts[t] >= 5, `${t} should appear >=5 times in 28, got ${counts[t]}`);
      assert.ok(counts[t] <= 6, `${t} should appear <=6 times in 28, got ${counts[t]}`);
    }
  });
});

describe("isValidTemplate", () => {
  test("accepts all 5 known templates", () => {
    for (const t of TEMPLATES) {
      assert.equal(isValidTemplate(t), true);
    }
  });

  test("rejects unknown templates", () => {
    assert.equal(isValidTemplate("custom"), false);
    assert.equal(isValidTemplate(""), false);
    assert.equal(isValidTemplate(null), false);
    assert.equal(isValidTemplate(undefined), false);
  });
});

describe("defaultTemplateForTone", () => {
  test("personal/jorge → pip", () => {
    assert.equal(defaultTemplateForTone("personal"), "pip");
    assert.equal(defaultTemplateForTone("Jorge habla"), "pip");
  });

  test("urgent/foreclosure/emotional → editorial", () => {
    assert.equal(defaultTemplateForTone("urgent"), "editorial");
    assert.equal(defaultTemplateForTone("foreclosure help urgent"), "editorial");
    assert.equal(defaultTemplateForTone("emotional"), "editorial");
  });

  test("educational/calm → voiceover", () => {
    assert.equal(defaultTemplateForTone("educational"), "voiceover");
    assert.equal(defaultTemplateForTone("educational, calm"), "voiceover");
  });

  test("unknown/empty → hybrid (default)", () => {
    assert.equal(defaultTemplateForTone(""), "hybrid");
    assert.equal(defaultTemplateForTone("random tone"), "hybrid");
    assert.equal(defaultTemplateForTone(undefined), "hybrid");
  });

  test("personal+urgent → personal wins (pip)", () => {
    // personal check first in priority
    assert.equal(defaultTemplateForTone("personal urgent"), "pip");
  });
});
