#!/usr/bin/env node
/**
 * El Rastreador — web scraper for lead research.
 *
 * Sprint F2 (Jorge 2026-05-08). Multi-tenant via tenant slug.
 *
 * Modes:
 *   legal_records      — scrape gov public records (court foreclosure, tax delinquent, probate)
 *   fsbo_listings      — scrape FSBO listings (Craigslist, Reddit)
 *   allies_directory   — scrape allies (probate/divorce/bankruptcy attorneys)
 *   batch              — run all three categories per their configured frequencies
 *
 * Output:
 *   Writes new records to Airtable Scraping_Results table (per tenant config).
 *   Dedups against records from last 90 days.
 *   Reports summary via Telegram.
 *
 * Cron (per scraping_config.json cron_hint):
 *   legal_records:    0 3 * * *
 *   fsbo_listings:    30 3 * * 1
 *   allies_directory: 0 4 * * 0
 */
import { parseArgs, loadTenant, telegramSend, genRunId, isoNow } from "../_shared/runner.mjs";
import { loadScrapingConfig, getActiveEndpoints } from "./src/config_loader.mjs";
import { fetchWithRetry, checkRobotsAllowed } from "./src/scraper_client.mjs";
import { buildDedupKey } from "./src/dedup.mjs";
import {
  bulkCreateScrapingResults,
  fetchRecentRecords,
} from "./src/airtable_writer.mjs";
import { extractPhoneFromText, normalizeName, normalizeAddress } from "./src/normalizer.mjs";

const VALID_MODES = ["legal_records", "fsbo_listings", "allies_directory", "batch"];

const AIRTABLE_TOKEN=[REDACTED] || "";

/**
 * Generic HTML record extractor for endpoints without a dedicated parser.
 * Extracts visible content + phone numbers + URLs.
 */
function extractRecordsFromHtml(html, endpoint, tenantId, category) {
  const records = [];
  if (!html) return records;

  // Extract anchor links + text
  const anchorPattern = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const seen = new Set();
  let m;
  let count = 0;
  const maxRecords = endpoint.max_records || 50;
  while ((m = anchorPattern.exec(html)) !== null && count < maxRecords) {
    const url = m[1];
    const text = m[2].trim();
    if (!text || text.length < 10 || text.length > 300) continue;
    if (seen.has(text)) continue;
    seen.add(text);

    // Resolve relative URLs
    let absoluteUrl;
    try {
      absoluteUrl = new URL(url, endpoint.base_url).toString();
    } catch {
      continue;
    }

    records.push({
      source_id: endpoint.id,
      category,
      tenant_id: tenantId,
      title: text.slice(0, 500),
      url_scraped: absoluteUrl,
      raw_data: JSON.stringify({ text, url: absoluteUrl, endpoint_id: endpoint.id }),
      situation: inferSituation(category, endpoint.id, text),
      status: "New",
      scraped_at: new Date().toISOString(),
    });
    count++;
  }

  // Extract phones from full text (for FSBO, etc.)
  const phone = extractPhoneFromText(html);
  if (phone && records.length > 0) {
    records[0].contact_phone = phone;
  }

  return records;
}

/**
 * Map category + endpoint id to Situation enum.
 */
function inferSituation(category, endpointId, text = "") {
  const lower = (text || "").toLowerCase();
  if (category === "legal_records") {
    if (endpointId.includes("foreclosure") || lower.includes("foreclosure")) return "Foreclosure";
    if (endpointId.includes("tax_delinquent") || lower.includes("tax delinq")) return "Tax Delinquent";
    if (endpointId.includes("probate") || lower.includes("probate")) return "Probate";
    if (lower.includes("divorce")) return "Divorce";
  }
  if (category === "fsbo_listings") return "FSBO";
  if (category === "allies_directory") return "Ally Attorney";
  return "Other";
}

/**
 * Process one endpoint — fetch + extract + return records.
 */
async function processEndpoint(endpoint, category, tenantId, dedupKeySet, opts = {}) {
  const { rateLimitSeconds = 10 } = opts;
  const url = endpoint.base_url + (endpoint.search_path || "");

  // Compliance: check robots.txt unless flagged otherwise
  if (endpoint.robots_compliant) {
    const robots = await checkRobotsAllowed(url, { attempts: 1 });
    if (!robots.allowed) {
      return { endpoint: endpoint.id, status: "blocked_robots", reason: robots.reason, records: [] };
    }
  }

  let html;
  try {
    const resp = await fetchWithRetry(url, { attempts: 3, baseDelayMs: 1500 });
    if (resp.status >= 400) {
      return { endpoint: endpoint.id, status: "fetch_error", reason: `HTTP ${resp.status}`, records: [] };
    }
    html = resp.body;
  } catch (e) {
    return { endpoint: endpoint.id, status: "fetch_exception", reason: e.message, records: [] };
  }

  // Polite delay before next endpoint
  await new Promise(r => setTimeout(r, rateLimitSeconds * 1000));

  const extracted = extractRecordsFromHtml(html, endpoint, tenantId, category);

  // Dedup against existing keys
  const newRecords = [];
  let duplicates = 0;
  for (const r of extracted) {
    const key = buildDedupKey(r);
    if (key && dedupKeySet.has(key)) {
      duplicates++;
      continue;
    }
    if (key) dedupKeySet.add(key);
    newRecords.push(r);
  }

  return {
    endpoint: endpoint.id,
    status: "ok",
    extracted_total: extracted.length,
    duplicates,
    new_records: newRecords.length,
    records: newRecords,
  };
}

/**
 * Run a category (legal_records / fsbo_listings / allies_directory).
 */
async function runCategory(category, tenantId, cfg, env) {
  const endpoints = getActiveEndpoints(cfg, category);
  if (endpoints.length === 0) {
    return { category, skipped: true, reason: "no active endpoints" };
  }

  // Build dedup key set from recent Airtable records
  const recent = await fetchRecentRecords(env, {
    lookbackDays: cfg.deduplication?.lookback_days || 90,
    tenantId,
    maxRecords: 500,
  });
  const dedupKeySet = new Set();
  for (const r of recent) {
    const k = buildDedupKey({
      case_number: r.Source_ID,
      contact_phone: r.Contact_Phone,
      property_address: r.Property_Address,
      property_city: r.Property_City,
      contact_name: r.Contact_Name,
      url_scraped: r.URL_Scraped,
    });
    if (k) dedupKeySet.add(k);
  }

  const rateLimitSeconds = cfg.compliance?.rate_limit_seconds || 10;
  const results = [];
  let allNewRecords = [];
  for (const ep of endpoints) {
    const r = await processEndpoint(ep, category, tenantId, dedupKeySet, { rateLimitSeconds });
    results.push(r);
    allNewRecords = allNewRecords.concat(r.records || []);
  }

  // Bulk create new records
  let written = 0;
  let writeErrors = 0;
  if (allNewRecords.length > 0) {
    const writeResult = await bulkCreateScrapingResults(env, allNewRecords);
    written = writeResult.created.length;
    writeErrors = writeResult.errors.length;
  }

  return {
    category,
    endpoints_processed: endpoints.length,
    extracted_total: results.reduce((s, r) => s + (r.extracted_total || 0), 0),
    duplicates: results.reduce((s, r) => s + (r.duplicates || 0), 0),
    new_records: allNewRecords.length,
    written,
    write_errors: writeErrors,
    per_endpoint: results.map(r => ({
      id: r.endpoint, status: r.status, new: r.new_records || 0, dups: r.duplicates || 0,
    })),
  };
}

async function main() {
  const args = parseArgs(process.argv, VALID_MODES);
  const tenantCfg = await loadTenant(args.tenant);
  const runId = genRunId();
  const startedAt = isoNow();

  console.error(`[rastreador] tenant=${args.tenant} mode=${args.mode} run_id=${runId}`);

  if (!AIRTABLE_TOKEN) {
    console.error("[rastreador] AIRTABLE_TOKEN missing — aborting");
    process.exit(2);
  }

  let cfg;
  try {
    cfg = loadScrapingConfig(args.tenant);
  } catch (e) {
    console.error(`[rastreador] failed to load scraping_config: ${e.message}`);
    process.exit(2);
  }

  if (!cfg.scraping_enabled) {
    console.error("[rastreador] scraping_enabled=false — exiting");
    return;
  }

  const env = {
    token: AIRTABLE_TOKEN,
    baseId: cfg.output.airtable_base_id,
    tableId: cfg.output.airtable_table_id,
  };

  if (args.dryRun) {
    console.log(`=== DRY RUN [rastreador ${args.mode}] ===`);
    console.log(`Would scrape ${Object.keys(cfg.sources).length} categories from tenant ${args.tenant}.`);
    return;
  }

  const summary = { mode: args.mode, results: [] };
  const categoriesToRun = args.mode === "batch"
    ? ["legal_records", "fsbo_listings", "allies_directory"]
    : [args.mode];

  for (const cat of categoriesToRun) {
    try {
      const r = await runCategory(cat, args.tenant, cfg, env);
      summary.results.push(r);
    } catch (e) {
      summary.results.push({ category: cat, error: e.message });
    }
  }

  const completedAt = isoNow();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);

  // Telegram summary
  const lines = [`🔍 *El Rastreador* — ${tenantCfg.tenant_name || args.tenant}`, `mode: \`${args.mode}\` · ${duration}s`];
  let totalNew = 0, totalDup = 0;
  for (const r of summary.results) {
    if (r.error) {
      lines.push(`❌ ${r.category}: ${r.error.slice(0, 80)}`);
      continue;
    }
    if (r.skipped) {
      lines.push(`⏭ ${r.category}: ${r.reason}`);
      continue;
    }
    lines.push(`✅ ${r.category}: ${r.written} new (${r.duplicates} dups, ${r.write_errors} errs)`);
    totalNew += r.written || 0;
    totalDup += r.duplicates || 0;
  }
  lines.push(`\n📊 Total: ${totalNew} new leads · ${totalDup} duplicates`);
  await telegramSend(tenantCfg, lines.join("\n"));

  console.error(`[rastreador] done — ${totalNew} new records · ${totalDup} dups · ${duration}s`);
}

main().catch((e) => { console.error("[rastreador] FATAL:", e); process.exit(1); });
