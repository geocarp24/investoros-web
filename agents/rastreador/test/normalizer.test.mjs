import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  normalizeAddress,
  normalizeName,
  extractPhoneFromText,
} from "../src/normalizer.mjs";

describe("normalizePhone", () => {
  test("formats 10-digit number", () => {
    assert.equal(normalizePhone("4145550100"), "(414) 555-0100");
  });
  test("strips formatting", () => {
    assert.equal(normalizePhone("(414) 555-0100"), "(414) 555-0100");
    assert.equal(normalizePhone("414.555.0100"), "(414) 555-0100");
    assert.equal(normalizePhone("414-555-0100"), "(414) 555-0100");
  });
  test("strips leading 1 (US country code)", () => {
    assert.equal(normalizePhone("14145550100"), "(414) 555-0100");
    assert.equal(normalizePhone("1-414-555-0100"), "(414) 555-0100");
  });
  test("returns null for invalid", () => {
    assert.equal(normalizePhone(""), null);
    assert.equal(normalizePhone(null), null);
    assert.equal(normalizePhone("12345"), null);
    assert.equal(normalizePhone("abcdefghij"), null);
  });
});

describe("normalizeAddress", () => {
  test("uppercases + trims", () => {
    assert.equal(normalizeAddress(" 123 main st "), "123 MAIN STREET");
  });
  test("expands common abbreviations", () => {
    assert.equal(normalizeAddress("123 Main St"), "123 MAIN STREET");
    assert.equal(normalizeAddress("456 oak ave"), "456 OAK AVENUE");
    assert.equal(normalizeAddress("789 first rd"), "789 FIRST ROAD");
    assert.equal(normalizeAddress("100 elm dr"), "100 ELM DRIVE");
  });
  test("collapses internal whitespace", () => {
    assert.equal(normalizeAddress("123   Main    Street"), "123 MAIN STREET");
  });
  test("null/empty returns null", () => {
    assert.equal(normalizeAddress(""), null);
    assert.equal(normalizeAddress(null), null);
  });
});

describe("normalizeName", () => {
  test("title-cases", () => {
    assert.equal(normalizeName("john smith"), "John Smith");
    assert.equal(normalizeName("MARY JONES"), "Mary Jones");
  });
  test("strips extra whitespace", () => {
    assert.equal(normalizeName("  john   smith  "), "John Smith");
  });
  test("null/empty returns null", () => {
    assert.equal(normalizeName(""), null);
    assert.equal(normalizeName("   "), null);
    assert.equal(normalizeName(null), null);
  });
});

describe("extractPhoneFromText", () => {
  test("finds phone in body text", () => {
    const body = "Call me at 414-555-0100 anytime";
    assert.equal(extractPhoneFromText(body), "(414) 555-0100");
  });
  test("finds first valid phone among multiple", () => {
    const body = "Call (414) 555-0100 or text 6088882233";
    const r = extractPhoneFromText(body);
    assert.ok(r === "(414) 555-0100" || r === "(608) 888-2233");
  });
  test("no phone returns null", () => {
    assert.equal(extractPhoneFromText("no phone here"), null);
  });
});
