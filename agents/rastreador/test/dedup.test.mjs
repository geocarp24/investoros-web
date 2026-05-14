import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildDedupKey, isDuplicate } from "../src/dedup.mjs";

describe("buildDedupKey", () => {
  test("uses case_number when present", () => {
    const k1 = buildDedupKey({ case_number: "2026-CV-001234", contact_phone: "4145550100" });
    const k2 = buildDedupKey({ case_number: "2026-cv-001234", contact_phone: "9999999999" });
    assert.equal(k1, k2, "case_number should dominate (case-insensitive)");
  });

  test("uses phone when no case_number", () => {
    const k1 = buildDedupKey({ contact_phone: "414-555-0100" });
    const k2 = buildDedupKey({ contact_phone: "(414) 555-0100" });
    assert.equal(k1, k2, "phone normalized should match");
  });

  test("uses address+city when no phone/case", () => {
    const k1 = buildDedupKey({ property_address: "123 Main St", property_city: "Milwaukee" });
    const k2 = buildDedupKey({ property_address: "123 main street", property_city: "milwaukee" });
    assert.equal(k1, k2, "address normalized should match");
  });

  test("returns null with no identifying fields", () => {
    assert.equal(buildDedupKey({}), null);
    assert.equal(buildDedupKey({ random_field: "x" }), null);
    assert.equal(buildDedupKey(null), null);
  });

  test("different records produce different keys", () => {
    const k1 = buildDedupKey({ contact_phone: "4145550100" });
    const k2 = buildDedupKey({ contact_phone: "6088882233" });
    assert.notEqual(k1, k2);
  });

  test("returns 16-char hex", () => {
    const k = buildDedupKey({ contact_phone: "4145550100" });
    assert.match(k, /^[a-f0-9]{16}$/);
  });

  test("combines multiple identifiers stably", () => {
    const r = { case_number: "X-1", contact_phone: "4145550100", property_address: "123 Main", property_city: "MKE" };
    // Should produce same key regardless of how fields are added
    const k1 = buildDedupKey(r);
    const k2 = buildDedupKey({ ...r });
    assert.equal(k1, k2);
  });
});

describe("isDuplicate", () => {
  test("detects duplicate via existing keys Set", () => {
    const existing = new Set(["abc123def456"]);
    const r = { case_number: "TEST" };
    const key = buildDedupKey(r);
    existing.add(key);
    assert.equal(isDuplicate(r, existing), true);
  });

  test("returns false when not duplicate", () => {
    const existing = new Set(["unrelated_key"]);
    assert.equal(isDuplicate({ contact_phone: "4145550100" }, existing), false);
  });

  test("accepts array as well as Set", () => {
    const r = { contact_phone: "4145550100" };
    const key = buildDedupKey(r);
    assert.equal(isDuplicate(r, [key]), true);
    assert.equal(isDuplicate(r, ["unrelated"]), false);
  });

  test("returns false for record with no identifying fields", () => {
    assert.equal(isDuplicate({}, new Set(["a", "b"])), false);
  });
});
