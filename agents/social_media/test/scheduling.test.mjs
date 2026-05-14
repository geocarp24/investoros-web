/**
 * Tests for scheduling.mjs — fixed slot publishing logic.
 * Uses node:test (no external deps).
 *
 * Run from repo root:
 *   node --test agents/social_media/test/scheduling.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FIXED_SLOTS_CST,
  getNextFixedSlot,
  dateInCST,
  cstOffsetHours,
  cstToUtc,
  slotsCountForDay,
} from "../scheduling.mjs";

// ────────────────────────────────────────────────────────────
// Constants — slot inventory
// ────────────────────────────────────────────────────────────
describe("FIXED_SLOTS_CST", () => {
  test("has 12 slots total", () => {
    assert.equal(FIXED_SLOTS_CST.length, 12);
  });

  test("FB has 6 slots", () => {
    const fb = FIXED_SLOTS_CST.filter(s => s.platform === "FB");
    assert.equal(fb.length, 6);
  });

  test("IG has 6 slots", () => {
    const ig = FIXED_SLOTS_CST.filter(s => s.platform === "IG");
    assert.equal(ig.length, 6);
  });

  test("each platform has 3 Posts + 2 Reels + 1 Video", () => {
    for (const platform of ["FB", "IG"]) {
      const slots = FIXED_SLOTS_CST.filter(s => s.platform === platform);
      const posts  = slots.filter(s => s.format === "Post").length;
      const reels  = slots.filter(s => s.format === "Reel").length;
      const videos = slots.filter(s => s.format === "Video").length;
      assert.equal(posts, 3, `${platform} should have 3 Posts`);
      assert.equal(reels, 2, `${platform} should have 2 Reels`);
      assert.equal(videos, 1, `${platform} should have 1 Video`);
    }
  });

  test("Video slots restrict to Mon/Wed/Fri/Sun", () => {
    const videos = FIXED_SLOTS_CST.filter(s => s.format === "Video");
    for (const v of videos) {
      assert.deepEqual(v.days, [1, 3, 5, 0], `${v.platform} Video must be Mon/Wed/Fri/Sun`);
    }
  });

  test("Post and Reel slots have no days restriction (run every day)", () => {
    const others = FIXED_SLOTS_CST.filter(s => s.format !== "Video");
    for (const s of others) {
      assert.equal(s.days, undefined, `${s.platform} ${s.format} ${s.hour}:${s.minute} should have no days`);
    }
  });

  test("FB exact times: 7:00, 11:30, 12:30, 17:50, 20:00, 21:00", () => {
    const fb = FIXED_SLOTS_CST.filter(s => s.platform === "FB");
    const times = fb.map(s => `${s.hour}:${String(s.minute).padStart(2, "0")}`);
    assert.deepEqual(times.sort(), ["11:30", "12:30", "17:50", "20:00", "21:00", "7:00"].sort());
  });

  test("IG exact times: 6:30, 13:00, 16:00, 19:00, 20:30, 21:00", () => {
    const ig = FIXED_SLOTS_CST.filter(s => s.platform === "IG");
    const times = ig.map(s => `${s.hour}:${String(s.minute).padStart(2, "0")}`);
    assert.deepEqual(times.sort(), ["13:00", "16:00", "19:00", "20:30", "21:00", "6:30"].sort());
  });
});

// ────────────────────────────────────────────────────────────
// cstOffsetHours — DST awareness
// ────────────────────────────────────────────────────────────
describe("cstOffsetHours", () => {
  test("returns -6 in winter (CST)", () => {
    const winter = new Date(Date.UTC(2026, 0, 15, 12, 0)); // Jan 15
    assert.equal(cstOffsetHours(winter), -6);
  });

  test("returns -5 in summer (CDT)", () => {
    const summer = new Date(Date.UTC(2026, 6, 15, 12, 0)); // Jul 15
    assert.equal(cstOffsetHours(summer), -5);
  });

  test("returns -5 immediately after spring-forward (Mar 8 2026)", () => {
    // Spring forward: 2026-03-08 02:00 CST → 03:00 CDT
    const afterSpring = new Date(Date.UTC(2026, 2, 8, 12, 0)); // Mar 8 06:00 CST→07:00 CDT
    assert.equal(cstOffsetHours(afterSpring), -5);
  });

  test("returns -6 after fall-back (Nov 1 2026)", () => {
    // Fall back: 2026-11-01 02:00 CDT → 01:00 CST
    const afterFall = new Date(Date.UTC(2026, 10, 1, 12, 0)); // Nov 1 06:00 CST
    assert.equal(cstOffsetHours(afterFall), -6);
  });
});

// ────────────────────────────────────────────────────────────
// dateInCST — UTC to CST decomposition
// ────────────────────────────────────────────────────────────
describe("dateInCST", () => {
  test("Jan 15 2026 12:00 UTC → 06:00 CST (Thu)", () => {
    const d = new Date(Date.UTC(2026, 0, 15, 12, 0));
    const r = dateInCST(d);
    assert.equal(r.year, 2026);
    assert.equal(r.month, 1);
    assert.equal(r.day, 15);
    assert.equal(r.hour, 6);
    assert.equal(r.minute, 0);
    assert.equal(r.weekday, 4); // Thursday
  });

  test("Jul 15 2026 12:00 UTC → 07:00 CDT (Wed)", () => {
    const d = new Date(Date.UTC(2026, 6, 15, 12, 0));
    const r = dateInCST(d);
    assert.equal(r.hour, 7);
    assert.equal(r.weekday, 3); // Wednesday
  });

  test("midnight UTC handles correctly (Sat Jan 17 2026 00:00 UTC = Fri Jan 16 18:00 CST)", () => {
    const d = new Date(Date.UTC(2026, 0, 17, 0, 0));
    const r = dateInCST(d);
    assert.equal(r.day, 16);
    assert.equal(r.hour, 18);
    assert.equal(r.weekday, 5); // Friday
  });
});

// ────────────────────────────────────────────────────────────
// cstToUtc — round trip
// ────────────────────────────────────────────────────────────
describe("cstToUtc", () => {
  test("Jan 13 2026 07:00 CST → 13:00 UTC", () => {
    const u = cstToUtc({ year: 2026, month: 1, day: 13, hour: 7, minute: 0 });
    assert.equal(u.getUTCHours(), 13);
    assert.equal(u.getUTCDate(), 13);
  });

  test("Jul 15 2026 07:00 CDT → 12:00 UTC", () => {
    const u = cstToUtc({ year: 2026, month: 7, day: 15, hour: 7, minute: 0 });
    assert.equal(u.getUTCHours(), 12);
  });

  test("round trip: dateInCST(cstToUtc(x)) === x", () => {
    const input = { year: 2026, month: 5, day: 8, hour: 21, minute: 0 };
    const u = cstToUtc(input);
    const r = dateInCST(u);
    assert.equal(r.year, input.year);
    assert.equal(r.month, input.month);
    assert.equal(r.day, input.day);
    assert.equal(r.hour, input.hour);
    assert.equal(r.minute, input.minute);
  });
});

// ────────────────────────────────────────────────────────────
// getNextFixedSlot — basic cases
// ────────────────────────────────────────────────────────────
describe("getNextFixedSlot — FB Post", () => {
  test("Tue Jan 13 2026 06:00 CST → next FB Post = same day 07:00 CST", () => {
    // 06:00 CST = 12:00 UTC
    const now = new Date(Date.UTC(2026, 0, 13, 12, 0));
    const slot = getNextFixedSlot("FB", "Post", now);
    const expected = Math.floor(Date.UTC(2026, 0, 13, 13, 0) / 1000); // 07:00 CST
    assert.equal(slot, expected);
  });

  test("Tue Jan 13 2026 11:00 CST → next FB Post = same day 11:30 CST", () => {
    const now = new Date(Date.UTC(2026, 0, 13, 17, 0)); // 11:00 CST
    const slot = getNextFixedSlot("FB", "Post", now);
    const expected = Math.floor(Date.UTC(2026, 0, 13, 17, 30) / 1000); // 11:30 CST
    assert.equal(slot, expected);
  });

  test("Tue Jan 13 2026 18:00 CST (after last Post) → next FB Post = Wed 07:00 CST", () => {
    const now = new Date(Date.UTC(2026, 0, 14, 0, 0)); // 18:00 CST Jan 13
    const slot = getNextFixedSlot("FB", "Post", now);
    const expected = Math.floor(Date.UTC(2026, 0, 14, 13, 0) / 1000); // Wed 07:00 CST
    assert.equal(slot, expected);
  });
});

describe("getNextFixedSlot — IG Post", () => {
  test("Tue Jan 13 2026 05:00 CST → next IG Post = same day 06:30 CST", () => {
    const now = new Date(Date.UTC(2026, 0, 13, 11, 0)); // 05:00 CST
    const slot = getNextFixedSlot("IG", "Post", now);
    const expected = Math.floor(Date.UTC(2026, 0, 13, 12, 30) / 1000); // 06:30 CST
    assert.equal(slot, expected);
  });
});

describe("getNextFixedSlot — Reels", () => {
  test("FB Reel: Tue 12:00 CST → 12:30 CST same day", () => {
    const now = new Date(Date.UTC(2026, 0, 13, 18, 0)); // 12:00 CST
    const slot = getNextFixedSlot("FB", "Reel", now);
    const expected = Math.floor(Date.UTC(2026, 0, 13, 18, 30) / 1000); // 12:30 CST
    assert.equal(slot, expected);
  });

  test("IG Reel: Tue 15:00 CST → 16:00 CST same day", () => {
    const now = new Date(Date.UTC(2026, 0, 13, 21, 0)); // 15:00 CST
    const slot = getNextFixedSlot("IG", "Reel", now);
    const expected = Math.floor(Date.UTC(2026, 0, 13, 22, 0) / 1000); // 16:00 CST
    assert.equal(slot, expected);
  });
});

// ────────────────────────────────────────────────────────────
// getNextFixedSlot — Video days filter (Mon/Wed/Fri/Sun)
// ────────────────────────────────────────────────────────────
describe("getNextFixedSlot — Video days filter", () => {
  test("Mon Jan 12 2026 11:00 CST → FB Video same day 21:00 CST", () => {
    const now = new Date(Date.UTC(2026, 0, 12, 17, 0)); // Mon 11:00 CST
    const slot = getNextFixedSlot("FB", "Video", now);
    const expected = Math.floor(Date.UTC(2026, 0, 13, 3, 0) / 1000); // Mon 21:00 CST = Tue 03:00 UTC
    assert.equal(slot, expected);
  });

  test("Tue Jan 13 2026 (no Video day) → FB Video = Wed Jan 14 21:00 CST", () => {
    const now = new Date(Date.UTC(2026, 0, 13, 17, 0)); // Tue 11:00 CST
    const slot = getNextFixedSlot("FB", "Video", now);
    const expected = Math.floor(Date.UTC(2026, 0, 15, 3, 0) / 1000); // Wed 21:00 CST = Thu 03:00 UTC
    assert.equal(slot, expected);
  });

  test("Sat Jan 17 2026 (no Video day) → FB Video = Sun Jan 18 21:00 CST", () => {
    const now = new Date(Date.UTC(2026, 0, 17, 17, 0)); // Sat 11:00 CST
    const slot = getNextFixedSlot("FB", "Video", now);
    const expected = Math.floor(Date.UTC(2026, 0, 19, 3, 0) / 1000); // Sun 21:00 CST = Mon 03:00 UTC
    assert.equal(slot, expected);
  });

  test("Sun late evening → FB Video = Mon (next video day)", () => {
    // Sun Jan 18 22:00 CST = Mon Jan 19 04:00 UTC
    const now = new Date(Date.UTC(2026, 0, 19, 4, 0));
    const slot = getNextFixedSlot("FB", "Video", now);
    // Next: Mon Jan 19 21:00 CST = Tue Jan 20 03:00 UTC
    const expected = Math.floor(Date.UTC(2026, 0, 20, 3, 0) / 1000);
    assert.equal(slot, expected);
  });

  test("IG Video: Mon → 20:30 CST same day", () => {
    const now = new Date(Date.UTC(2026, 0, 12, 17, 0)); // Mon 11:00 CST
    const slot = getNextFixedSlot("IG", "Video", now);
    const expected = Math.floor(Date.UTC(2026, 0, 13, 2, 30) / 1000); // Mon 20:30 CST = Tue 02:30 UTC
    assert.equal(slot, expected);
  });
});

// ────────────────────────────────────────────────────────────
// DST transitions
// ────────────────────────────────────────────────────────────
describe("getNextFixedSlot — DST transitions", () => {
  test("Spring forward: Mar 9 2026 (Mon) → FB Video = same day 21:00 CDT (UTC-5)", () => {
    // Spring forward was Mar 8 (Sun). Mar 9 Mon = CDT.
    const now = new Date(Date.UTC(2026, 2, 9, 12, 0)); // Mon Mar 9 07:00 CDT
    const slot = getNextFixedSlot("FB", "Video", now);
    // Mon Mar 9 21:00 CDT = Mar 10 02:00 UTC
    const expected = Math.floor(Date.UTC(2026, 2, 10, 2, 0) / 1000);
    assert.equal(slot, expected);
  });

  test("Fall back: Nov 2 2026 (Mon) → FB Video = same day 21:00 CST (UTC-6)", () => {
    // Fall back was Nov 1 (Sun). Nov 2 Mon = CST.
    const now = new Date(Date.UTC(2026, 10, 2, 13, 0)); // Mon Nov 2 07:00 CST
    const slot = getNextFixedSlot("FB", "Video", now);
    // Mon Nov 2 21:00 CST = Nov 3 03:00 UTC
    const expected = Math.floor(Date.UTC(2026, 10, 3, 3, 0) / 1000);
    assert.equal(slot, expected);
  });
});

// ────────────────────────────────────────────────────────────
// Strictly future requirement
// ────────────────────────────────────────────────────────────
describe("getNextFixedSlot — strictly future", () => {
  test("exactly at slot time → returns NEXT slot, not current", () => {
    // Exactly Tue Jan 13 07:00 CST = 13:00 UTC
    const now = new Date(Date.UTC(2026, 0, 13, 13, 0));
    const slot = getNextFixedSlot("FB", "Post", now);
    // Should skip 07:00 (not strictly future, only 1s tolerance) and return 11:30 CST
    const expected = Math.floor(Date.UTC(2026, 0, 13, 17, 30) / 1000);
    assert.equal(slot, expected);
  });
});

// ────────────────────────────────────────────────────────────
// slotsCountForDay
// ────────────────────────────────────────────────────────────
describe("slotsCountForDay", () => {
  test("Mon (Video day) → 12 slots total", () => {
    const mon = new Date(Date.UTC(2026, 0, 12, 17, 0)); // Mon 11:00 CST
    assert.equal(slotsCountForDay(mon), 12);
  });

  test("Tue (no Video) → 10 slots total", () => {
    const tue = new Date(Date.UTC(2026, 0, 13, 17, 0)); // Tue 11:00 CST
    assert.equal(slotsCountForDay(tue), 10);
  });

  test("Sun (Video day) → 12 slots", () => {
    const sun = new Date(Date.UTC(2026, 0, 11, 17, 0)); // Sun 11:00 CST
    assert.equal(slotsCountForDay(sun), 12);
  });
});

// ────────────────────────────────────────────────────────────
// Weekly volume sanity check
// ────────────────────────────────────────────────────────────
describe("weekly volume", () => {
  test("total slots per week = 76 (10 × 3 weekdays + 12 × 4 video days)", () => {
    // Weekdays: Tue, Thu, Sat = 3 days × 10 slots = 30
    // Video days: Mon, Wed, Fri, Sun = 4 days × 12 slots = 48
    // Total: 78 slots/week (not 77-85 — recompute)
    // Actually: Mon/Wed/Fri/Sun = 4 × 12 = 48; Tue/Thu/Sat = 3 × 10 = 30; total = 78
    const startSun = new Date(Date.UTC(2026, 0, 11, 17, 0)); // Sun
    let total = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(startSun.getTime() + d * 86400000);
      total += slotsCountForDay(day);
    }
    assert.equal(total, 78, `week total should be 78 (4 video days × 12 + 3 non-video × 10)`);
  });
});
