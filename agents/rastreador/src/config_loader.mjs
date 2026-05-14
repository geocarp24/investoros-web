/**
 * config_loader.mjs — load + validate scraping_config.json per tenant.
 *
 * Sprint F2 (Jorge 2026-05-08). Pure function — no side effects, fully testable.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");

const VALID_CATEGORIES = ["legal_records", "fsbo_listings", "allies_directory"];

/**
 * Load scraping_config.json for a tenant.
 * @param {string} tenantSlug
 * @param {string} [rootDir] - override for tests
 * @returns {object} validated config
 */
export function loadScrapingConfig(tenantSlug, rootDir = ROOT) {
  if (!tenantSlug || !/^[a-z0-9_-]+$/.test(tenantSlug)) {
    throw new Error(`invalid tenant slug: ${tenantSlug}`);
  }
  const path = join(rootDir, "agents", "tenants", tenantSlug, "scraping_config.json");
  const raw = readFileSync(path, "utf8");
  const cfg = JSON.parse(raw);
  return validateConfig(cfg);
}

/**
 * Validate config structure. Throws on invalid.
 */
export function validateConfig(cfg) {
  if (!cfg.tenant_id) throw new Error("config missing tenant_id");
  if (typeof cfg.scraping_enabled !== "boolean") throw new Error("config missing scraping_enabled");
  if (!cfg.compliance) throw new Error("config missing compliance section");
  if (!cfg.sources) throw new Error("config missing sources section");

  for (const cat of Object.keys(cfg.sources)) {
    if (!VALID_CATEGORIES.includes(cat)) {
      throw new Error(`invalid source category: ${cat}`);
    }
    const block = cfg.sources[cat];
    if (!Array.isArray(block.endpoints)) {
      throw new Error(`source ${cat} missing endpoints[]`);
    }
    for (const ep of block.endpoints) {
      if (!ep.id) throw new Error(`endpoint in ${cat} missing id`);
      if (!ep.base_url) throw new Error(`endpoint ${ep.id} missing base_url`);
      if (typeof ep.robots_compliant !== "boolean") {
        throw new Error(`endpoint ${ep.id} missing robots_compliant flag`);
      }
    }
  }

  if (!cfg.output?.airtable_table_id) {
    throw new Error("config missing output.airtable_table_id");
  }
  return cfg;
}

/**
 * Filter endpoints by category + check ToS-blocked sources.
 */
export function getActiveEndpoints(cfg, category) {
  if (!cfg.scraping_enabled) return [];
  if (!cfg.sources[category]) return [];
  const blocked = new Set(cfg.compliance?.blocked_sources_tos_prohibited || []);
  return cfg.sources[category].endpoints.filter(ep => {
    const host = new URL(ep.base_url).hostname.toLowerCase();
    return !Array.from(blocked).some(b => host.includes(b.toLowerCase()));
  });
}
