/**
 * Tests for safety.mjs CADENCE config — verifies FIXED_SLOTS_PROD phase
 * matches the slot inventory in scheduling.mjs.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CADENCE, CURRENT_PHASE, HARD_CAPS_24H } from "../safety.mjs";
import { FIXED_SLOTS_CST } from "../scheduling.mjs";

describe("CADENCE — phase inventory", () => {
  test("contains all 7 phases", () => {
    const expected = [
      "WARMUP_WEEK_1", "WARMUP_WEEK_2",
      "RAMP_WEEK_3", "RAMP_WEEK_4",
      "GROWTH", "STEADY_STATE",
      "FIXED_SLOTS_PROD",
    ];
    for (const phase of expected) {
      assert.ok(CADENCE[phase], `phase ${phase} missing`);
    }
  });

  test("each phase has the 3 required keys", () => {
    for (const [name, cfg] of Object.entries(CADENCE)) {
      assert.ok("postsPerDayPerPlatform" in cfg, `${name} missing postsPerDayPerPlatform`);
      assert.ok("minHoursBetween" in cfg, `${name} missing minHoursBetween`);
      assert.ok("perFormat" in cfg, `${name} missing perFormat`);
    }
  });
});

describe("CURRENT_PHASE — points to FIXED_SLOTS_PROD", () => {
  test("CURRENT_PHASE is FIXED_SLOTS_PROD (Sprint A1.5)", () => {
    assert.equal(CURRENT_PHASE, "FIXED_SLOTS_PROD");
  });

  test("CURRENT_PHASE refers to a real phase", () => {
    assert.ok(CADENCE[CURRENT_PHASE], "CURRENT_PHASE must reference an existing CADENCE entry");
  });
});

describe("FIXED_SLOTS_PROD — values", () => {
  const cfg = CADENCE.FIXED_SLOTS_PROD;

  test("postsPerDayPerPlatform = 6 (3 Post + 2 Reel + 1 Video)", () => {
    assert.equal(cfg.postsPerDayPerPlatform, 6);
  });

  test("minHoursBetween = 0.25 (15min buffer)", () => {
    assert.equal(cfg.minHoursBetween, 0.25);
  });

  test("perFormat caps: Post=3, Reel=2, Video=1", () => {
    assert.equal(cfg.perFormat.Post, 3);
    assert.equal(cfg.perFormat.Reel, 2);
    assert.equal(cfg.perFormat.Video, 1);
  });

  test("perFormat sum equals postsPerDayPerPlatform", () => {
    const sum = cfg.perFormat.Post + cfg.perFormat.Reel + cfg.perFormat.Video;
    assert.equal(sum, cfg.postsPerDayPerPlatform);
  });
});

describe("FIXED_SLOTS_PROD — alignment with scheduling.mjs", () => {
  // The CADENCE caps must match the slot inventory or we'll block legitimate publishes.
  test("FB Post cap >= max FB Post slots/day from FIXED_SLOTS_CST", () => {
    const fbPosts = FIXED_SLOTS_CST.filter(s => s.platform === "FB" && s.format === "Post").length;
    assert.ok(CADENCE.FIXED_SLOTS_PROD.perFormat.Post >= fbPosts);
  });

  test("FB Reel cap >= max FB Reel slots/day", () => {
    const fbReels = FIXED_SLOTS_CST.filter(s => s.platform === "FB" && s.format === "Reel").length;
    assert.ok(CADENCE.FIXED_SLOTS_PROD.perFormat.Reel >= fbReels);
  });

  test("IG Reel cap >= max IG Reel slots/day", () => {
    const igReels = FIXED_SLOTS_CST.filter(s => s.platform === "IG" && s.format === "Reel").length;
    assert.ok(CADENCE.FIXED_SLOTS_PROD.perFormat.Reel >= igReels);
  });

  test("Video cap >= max Video slots/day per platform", () => {
    const fbVideos = FIXED_SLOTS_CST.filter(s => s.platform === "FB" && s.format === "Video").length;
    const igVideos = FIXED_SLOTS_CST.filter(s => s.platform === "IG" && s.format === "Video").length;
    assert.ok(CADENCE.FIXED_SLOTS_PROD.perFormat.Video >= Math.max(fbVideos, igVideos));
  });

  test("minHoursBetween (0.25h = 15min) is less than tightest slot gap on video days", () => {
    // On video days, IG has slots at 20:30 (Video) and 21:00 (Reel) = 30min apart.
    // 0.25h = 15min < 30min, so the rate gate won't block legitimate slot pairs.
    assert.ok(CADENCE.FIXED_SLOTS_PROD.minHoursBetween * 60 < 30);
  });
});

describe("HARD_CAPS_24H — Meta absolute limits unchanged", () => {
  test("fb_posts_per_page = 25", () => {
    assert.equal(HARD_CAPS_24H.fb_posts_per_page, 25);
  });

  test("ig_posts_per_user = 25", () => {
    assert.equal(HARD_CAPS_24H.ig_posts_per_user, 25);
  });

  test("FIXED_SLOTS_PROD daily volume (6/day) stays well below Meta hard caps", () => {
    const fixedSlotsCap = CADENCE.FIXED_SLOTS_PROD.postsPerDayPerPlatform;
    assert.ok(fixedSlotsCap < HARD_CAPS_24H.fb_posts_per_page);
    assert.ok(fixedSlotsCap < HARD_CAPS_24H.ig_posts_per_user);
  });
});
