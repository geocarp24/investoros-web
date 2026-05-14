import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildAirtableFields,
  createScrapingResult,
  bulkCreateScrapingResults,
  fetchRecentRecords,
  __setFetch,
} from "../src/airtable_writer.mjs";

const ENV = { token: "test_token", baseId: "appTEST", tableId: "tblTEST" };

describe("buildAirtableFields", () => {
  test("maps all standard fields", () => {
    const r = {
      source_id: "wi_court", category: "legal_records", tenant_id: "pinnacle",
      title: "Smith v Smith", url_scraped: "https://wcca.wicourts.gov/case/123",
      contact_name: "John Smith", contact_phone: "(414) 555-0100",
      property_address: "123 Main St", property_city: "Milwaukee", property_state: "WI", property_zip: "53201",
      situation: "Foreclosure", status: "New",
    };
    const f = buildAirtableFields(r);
    assert.equal(f.Source_ID, "wi_court");
    assert.equal(f.Category, "legal_records");
    assert.equal(f.Tenant_ID, "pinnacle");
    assert.equal(f.Title, "Smith v Smith");
    assert.equal(f.Property_City, "Milwaukee");
    assert.equal(f.Status, "New");
    assert.ok(f.Scraped_At);
  });

  test("defaults Status to New", () => {
    const f = buildAirtableFields({ source_id: "x" });
    assert.equal(f.Status, "New");
  });

  test("auto-stamps Scraped_At if missing", () => {
    const f = buildAirtableFields({ source_id: "x" });
    assert.ok(f.Scraped_At);
    assert.ok(new Date(f.Scraped_At).getTime() > 0);
  });

  test("preserves provided Scraped_At", () => {
    const t = "2026-05-08T12:00:00Z";
    const f = buildAirtableFields({ source_id: "x", scraped_at: t });
    assert.equal(f.Scraped_At, t);
  });

  test("stringifies object raw_data", () => {
    const f = buildAirtableFields({ source_id: "x", raw_data: { a: 1, b: "two" } });
    assert.equal(typeof f.Raw_Data, "string");
    assert.match(f.Raw_Data, /"a":1/);
  });

  test("truncates oversized fields", () => {
    const long = "x".repeat(10000);
    const f = buildAirtableFields({ source_id: "x", title: long });
    assert.ok(f.Title.length <= 500);
  });

  test("throws on null record", () => {
    assert.throws(() => buildAirtableFields(null), /record required/);
  });
});

describe("createScrapingResult", () => {
  test("POSTs to correct URL with auth header", async () => {
    let captured;
    __setFetch(async (url, init) => {
      captured = { url, method: init.method, body: JSON.parse(init.body), auth: init.headers.Authorization };
      return { ok: true, status: 200, json: async () => ({ id: "rec123", fields: { Source_ID: "x" } }) };
    });
    const r = await createScrapingResult(ENV, { source_id: "x", title: "test" });
    assert.equal(r.id, "rec123");
    assert.equal(captured.url, "https://api.airtable.com/v0/appTEST/tblTEST");
    assert.equal(captured.method, "POST");
    assert.match(captured.auth, /^Bearer test_token$/);
    assert.ok(captured.body.fields.Source_ID === "x");
    assert.equal(captured.body.typecast, true);
  });

  test("returns error on non-OK response", async () => {
    __setFetch(async () => ({
      ok: false, status: 422,
      json: async () => ({ error: { message: "Invalid field" } }),
    }));
    const r = await createScrapingResult(ENV, { source_id: "x" });
    assert.ok(r.error);
    assert.equal(r.status, 422);
  });

  test("requires complete env", async () => {
    await assert.rejects(() => createScrapingResult({ token: "t" }, {}), /env requires/);
    await assert.rejects(() => createScrapingResult({ token: "t", baseId: "b" }, {}), /env requires/);
  });
});

describe("bulkCreateScrapingResults", () => {
  test("chunks into batches of 10", async () => {
    let calls = 0;
    __setFetch(async (url, init) => {
      calls++;
      const body = JSON.parse(init.body);
      const recs = body.records.map((_, i) => ({ id: `rec_${calls}_${i}` }));
      return { ok: true, status: 200, json: async () => ({ records: recs }) };
    });
    const records = Array.from({ length: 25 }, (_, i) => ({ source_id: `r${i}` }));
    const r = await bulkCreateScrapingResults(ENV, records);
    assert.equal(calls, 3);  // 10 + 10 + 5
    assert.equal(r.created.length, 25);
    assert.equal(r.errors.length, 0);
  });

  test("collects errors per chunk", async () => {
    __setFetch(async () => ({
      ok: false, status: 422,
      json: async () => ({ error: { message: "validation" } }),
    }));
    const records = [{ source_id: "x" }];
    const r = await bulkCreateScrapingResults(ENV, records);
    assert.equal(r.created.length, 0);
    assert.equal(r.errors.length, 1);
  });

  test("empty array returns empty result", async () => {
    const r = await bulkCreateScrapingResults(ENV, []);
    assert.deepEqual(r, { created: [], errors: [] });
  });
});

describe("fetchRecentRecords", () => {
  test("includes tenantId in filter", async () => {
    let captured;
    __setFetch(async (url) => {
      captured = url;
      return { ok: true, status: 200, json: async () => ({ records: [] }) };
    });
    await fetchRecentRecords(ENV, { lookbackDays: 30, tenantId: "pinnacle" });
    assert.ok(captured.includes("Tenant_ID"));
    assert.ok(captured.includes("pinnacle"));
  });

  test("respects maxRecords cap", async () => {
    __setFetch(async () => ({
      ok: true, status: 200,
      json: async () => ({ records: Array.from({ length: 100 }, (_, i) => ({ fields: { id: i } })), offset: "abc" }),
    }));
    const r = await fetchRecentRecords(ENV, { maxRecords: 50 });
    assert.equal(r.length, 50);
  });

  test("returns empty on fetch error", async () => {
    __setFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const r = await fetchRecentRecords(ENV);
    assert.deepEqual(r, []);
  });
});
