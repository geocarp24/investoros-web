/**
 * Tests for publisher_helpers.mjs — pure functions used by processPosts.
 * Run from agents/social_media/:
 *   node --test test/publisher_helpers.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildPublisherFilter,
  selectFieldPublishedId,
  selectPublisherFn,
  isVideoUrl,
  validatePublisherArgs,
} from "../publisher_helpers.mjs";

// ────────────────────────────────────────────────────────────
// buildPublisherFilter
// ────────────────────────────────────────────────────────────
describe("buildPublisherFilter", () => {
  test("default: filters by visual_url + Status", () => {
    const f = buildPublisherFilter();
    assert.equal(f, `AND({visual_url}!='', {Status}='Visual Listo')`);
  });

  test("with targetPlatform=FB adds Target_Platform clause", () => {
    const f = buildPublisherFilter({ targetPlatform: "FB" });
    assert.ok(f.includes(`{Target_Platform}='FB'`));
  });

  test("with targetPlatform=IG adds IG clause", () => {
    const f = buildPublisherFilter({ targetPlatform: "IG" });
    assert.ok(f.includes(`{Target_Platform}='IG'`));
  });

  test("with targetFormat=Reel adds Format clause", () => {
    const f = buildPublisherFilter({ targetFormat: "Reel" });
    assert.ok(f.includes(`{Format}='Reel'`));
  });

  test("with both targetPlatform + targetFormat includes both clauses", () => {
    const f = buildPublisherFilter({ targetPlatform: "FB", targetFormat: "Post" });
    assert.ok(f.includes(`{Target_Platform}='FB'`));
    assert.ok(f.includes(`{Format}='Post'`));
  });

  test("rejects invalid targetPlatform", () => {
    assert.throws(() => buildPublisherFilter({ targetPlatform: "TWITTER" }), /invalid targetPlatform/);
  });

  test("rejects invalid targetFormat", () => {
    assert.throws(() => buildPublisherFilter({ targetFormat: "Story" }), /invalid targetFormat/);
  });

  test("custom status overrides default", () => {
    const f = buildPublisherFilter({ status: "Programado" });
    assert.ok(f.includes(`{Status}='Programado'`));
    assert.ok(!f.includes("Visual Listo"));
  });

  test("filter is AND-wrapped (Airtable formula)", () => {
    const f = buildPublisherFilter({ targetPlatform: "IG", targetFormat: "Reel" });
    assert.ok(f.startsWith("AND("));
    assert.ok(f.endsWith(")"));
  });

  test("clauses are comma-separated (Airtable spec)", () => {
    const f = buildPublisherFilter({ targetPlatform: "FB", targetFormat: "Video" });
    const inner = f.slice(4, -1); // strip AND( and )
    const parts = inner.split(", ");
    assert.equal(parts.length, 4);
  });
});

// ────────────────────────────────────────────────────────────
// selectFieldPublishedId
// ────────────────────────────────────────────────────────────
describe("selectFieldPublishedId", () => {
  test("FB → Published_FB_ID", () => {
    assert.equal(selectFieldPublishedId("FB"), "Published_FB_ID");
  });

  test("IG → Published_IG_ID", () => {
    assert.equal(selectFieldPublishedId("IG"), "Published_IG_ID");
  });

  test("unknown platform throws", () => {
    assert.throws(() => selectFieldPublishedId("TIKTOK"), /invalid platform/);
  });

  test("undefined throws", () => {
    assert.throws(() => selectFieldPublishedId(undefined), /invalid platform/);
  });
});

// ────────────────────────────────────────────────────────────
// selectPublisherFn
// ────────────────────────────────────────────────────────────
describe("selectPublisherFn", () => {
  test("FB Reel → publishFacebookReel", () => {
    assert.equal(selectPublisherFn("FB", "Reel", false), "publishFacebookReel");
  });

  test("FB Post (image) → publishFacebookPhotoPost", () => {
    assert.equal(selectPublisherFn("FB", "Post", false), "publishFacebookPhotoPost");
  });

  test("FB Post but isVideo=true → publishFacebookReel (video routing)", () => {
    assert.equal(selectPublisherFn("FB", "Post", true), "publishFacebookReel");
  });

  test("FB Video (image preview) → publishFacebookPhotoPost", () => {
    assert.equal(selectPublisherFn("FB", "Video", false), "publishFacebookPhotoPost");
  });

  test("FB Video with isVideo=true → publishFacebookReel", () => {
    assert.equal(selectPublisherFn("FB", "Video", true), "publishFacebookReel");
  });

  test("IG Reel → publishInstagramReel", () => {
    assert.equal(selectPublisherFn("IG", "Reel", false), "publishInstagramReel");
  });

  test("IG Post → publishInstagramImage", () => {
    assert.equal(selectPublisherFn("IG", "Post", false), "publishInstagramImage");
  });

  test("IG Post with isVideo=true → publishInstagramReel", () => {
    assert.equal(selectPublisherFn("IG", "Post", true), "publishInstagramReel");
  });

  test("invalid platform throws", () => {
    assert.throws(() => selectPublisherFn("TIKTOK", "Reel", false), /invalid platform/);
  });

  test("invalid format throws", () => {
    assert.throws(() => selectPublisherFn("FB", "Story", false), /invalid format/);
  });
});

// ────────────────────────────────────────────────────────────
// isVideoUrl
// ────────────────────────────────────────────────────────────
describe("isVideoUrl", () => {
  test(".mp4 → true", () => {
    assert.equal(isVideoUrl("https://cloudinary.com/video.mp4"), true);
  });

  test(".mov → true", () => {
    assert.equal(isVideoUrl("https://example.com/clip.mov"), true);
  });

  test(".webm → true", () => {
    assert.equal(isVideoUrl("https://example.com/x.webm"), true);
  });

  test(".jpg → false", () => {
    assert.equal(isVideoUrl("https://cloudinary.com/photo.jpg"), false);
  });

  test(".png → false", () => {
    assert.equal(isVideoUrl("https://cloudinary.com/x.png"), false);
  });

  test("query string after .mp4 → true", () => {
    assert.equal(isVideoUrl("https://x.com/video.mp4?token=abc"), true);
  });

  test("uppercase .MP4 → true", () => {
    assert.equal(isVideoUrl("https://x.com/clip.MP4"), true);
  });

  test("empty/null → false", () => {
    assert.equal(isVideoUrl(""), false);
    assert.equal(isVideoUrl(null), false);
    assert.equal(isVideoUrl(undefined), false);
  });

  test("URL without extension → false", () => {
    assert.equal(isVideoUrl("https://example.com/some-page"), false);
  });
});

// ────────────────────────────────────────────────────────────
// validatePublisherArgs
// ────────────────────────────────────────────────────────────
describe("validatePublisherArgs", () => {
  test("valid args → ok", () => {
    const r = validatePublisherArgs({ targetPlatform: "FB", targetFormat: "Post" });
    assert.equal(r.ok, true);
    assert.equal(r.errors.length, 0);
  });

  test("missing targetPlatform → not ok", () => {
    const r = validatePublisherArgs({ targetFormat: "Post" });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("targetPlatform")));
  });

  test("missing targetFormat → not ok", () => {
    const r = validatePublisherArgs({ targetPlatform: "FB" });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("targetFormat")));
  });

  test("both missing → 2 errors", () => {
    const r = validatePublisherArgs({});
    assert.equal(r.ok, false);
    assert.equal(r.errors.length, 2);
  });

  test("invalid targetPlatform value → error message", () => {
    const r = validatePublisherArgs({ targetPlatform: "TIKTOK", targetFormat: "Reel" });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("invalid targetPlatform")));
  });

  test("invalid targetFormat value → error message", () => {
    const r = validatePublisherArgs({ targetPlatform: "FB", targetFormat: "Story" });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("invalid targetFormat")));
  });

  test("all 3 valid platforms accepted", () => {
    for (const p of ["FB", "IG"]) {
      for (const f of ["Post", "Reel", "Video"]) {
        const r = validatePublisherArgs({ targetPlatform: p, targetFormat: f });
        assert.equal(r.ok, true, `${p}/${f} should validate`);
      }
    }
  });

  test("undefined args → not ok", () => {
    const r = validatePublisherArgs(undefined);
    assert.equal(r.ok, false);
  });
});

// ────────────────────────────────────────────────────────────
// Integration sanity check — combinations the cron will use
// ────────────────────────────────────────────────────────────
describe("integration — every cron slot args combination", () => {
  // 12 slots total: 6 FB (3 Post + 2 Reel + 1 Video) + 6 IG (same).
  // Each cron entry passes one platform/format combo. All must pass validation
  // and produce a valid filter + publisher.
  const SLOT_COMBOS = [
    { p: "FB", f: "Post" }, { p: "FB", f: "Reel" }, { p: "FB", f: "Video" },
    { p: "IG", f: "Post" }, { p: "IG", f: "Reel" }, { p: "IG", f: "Video" },
  ];

  for (const { p, f } of SLOT_COMBOS) {
    test(`slot ${p} ${f} pipeline works end-to-end`, () => {
      // 1. validate args
      const v = validatePublisherArgs({ targetPlatform: p, targetFormat: f });
      assert.equal(v.ok, true);

      // 2. build filter
      const filter = buildPublisherFilter({ targetPlatform: p, targetFormat: f });
      assert.ok(filter.includes(`{Target_Platform}='${p}'`));
      assert.ok(filter.includes(`{Format}='${f}'`));

      // 3. select field
      const fieldId = selectFieldPublishedId(p);
      assert.ok(fieldId.startsWith("Published_"));
      assert.ok(fieldId.includes(p));

      // 4. select publisher
      const pubFn = selectPublisherFn(p, f, false);
      assert.ok(pubFn.startsWith("publish"));
      const expectedPlatform = p === "FB" ? "Facebook" : "Instagram";
      assert.ok(pubFn.includes(expectedPlatform));
    });
  }
});
