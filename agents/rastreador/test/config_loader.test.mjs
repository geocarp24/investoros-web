import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  loadScrapingConfig,
  validateConfig,
  getActiveEndpoints,
} from "../src/config_loader.mjs";

describe("loadScrapingConfig", () => {
  test("loads pinnacle config successfully", () => {
    const cfg = loadScrapingConfig("pinnacle");
    assert.equal(cfg.tenant_id, "pinnacle");
    assert.equal(cfg.scraping_enabled, true);
    assert.ok(cfg.sources);
  });

  test("rejects invalid tenant slug", () => {
    assert.throws(() => loadScrapingConfig("../etc/passwd"), /invalid tenant slug/);
    assert.throws(() => loadScrapingConfig(""), /invalid tenant slug/);
    assert.throws(() => loadScrapingConfig("Has Spaces"), /invalid tenant slug/);
  });
});

describe("validateConfig", () => {
  test("requires tenant_id", () => {
    assert.throws(() => validateConfig({}), /tenant_id/);
  });

  test("requires scraping_enabled boolean", () => {
    assert.throws(() => validateConfig({ tenant_id: "x" }), /scraping_enabled/);
  });

  test("requires compliance section", () => {
    assert.throws(() => validateConfig({ tenant_id: "x", scraping_enabled: true }), /compliance/);
  });

  test("requires sources section", () => {
    assert.throws(() => validateConfig({
      tenant_id: "x",
      scraping_enabled: true,
      compliance: {},
    }), /sources/);
  });

  test("requires output.airtable_table_id", () => {
    assert.throws(() => validateConfig({
      tenant_id: "x",
      scraping_enabled: true,
      compliance: {},
      sources: {},
    }), /airtable_table_id/);
  });

  test("rejects invalid source category", () => {
    assert.throws(() => validateConfig({
      tenant_id: "x",
      scraping_enabled: true,
      compliance: {},
      sources: { invalid_cat: { endpoints: [] } },
      output: { airtable_table_id: "t" },
    }), /invalid source category/);
  });

  test("rejects endpoint missing required fields", () => {
    assert.throws(() => validateConfig({
      tenant_id: "x",
      scraping_enabled: true,
      compliance: {},
      sources: { legal_records: { endpoints: [{ name: "incomplete" }] } },
      output: { airtable_table_id: "t" },
    }), /missing id|missing base_url|missing robots_compliant/);
  });
});

describe("getActiveEndpoints", () => {
  const cfg = loadScrapingConfig("pinnacle");

  test("returns endpoints for legal_records category", () => {
    const eps = getActiveEndpoints(cfg, "legal_records");
    assert.ok(eps.length > 0);
    assert.ok(eps.every(e => e.id && e.base_url));
  });

  test("returns empty for unknown category", () => {
    const eps = getActiveEndpoints(cfg, "unknown_cat");
    assert.equal(eps.length, 0);
  });

  test("returns empty when scraping disabled", () => {
    const disabled = { ...cfg, scraping_enabled: false };
    assert.equal(getActiveEndpoints(disabled, "legal_records").length, 0);
  });

  test("filters out ToS-blocked sources", () => {
    const customCfg = {
      tenant_id: "test",
      scraping_enabled: true,
      compliance: { blocked_sources_tos_prohibited: ["zillow.com"] },
      sources: {
        legal_records: {
          endpoints: [
            { id: "ok_source", base_url: "https://wcca.wicourts.gov", robots_compliant: true },
            { id: "blocked", base_url: "https://www.zillow.com", robots_compliant: true },
          ],
        },
      },
      output: { airtable_table_id: "t" },
    };
    const eps = getActiveEndpoints(customCfg, "legal_records");
    assert.equal(eps.length, 1);
    assert.equal(eps[0].id, "ok_source");
  });
});
