/**
 * dedup.mjs — pure deduplication logic.
 * Sprint F2 (Jorge 2026-05-08).
 *
 * Strategy: build a stable hash from the most identifying fields available.
 * Priority: case_number > phone > address+name. Lookback window (default 90d)
 * is enforced by the caller via Airtable filterByFormula on Scraped_At.
 */
import { createHash } from "node:crypto";
import { normalizePhone, normalizeAddress, normalizeName } from "./normalizer.mjs";

/**
 * Build a deduplication key from a record.
 * Returns a SHA-256 hex (16 chars) or null if the record has no identifying fields.
 */
export function buildDedupKey(record) {
  if (!record) return null;
  const parts = [];

  // Priority 1: case_number is GLOBALLY UNIQUE — when present, it dominates.
  // Court cases are 1-to-1 with property/situation; combining with phone would
  // miss duplicates where the same case is scraped twice with different phone variants.
  if (record.case_number) {
    parts.push(`case:${String(record.case_number).trim().toUpperCase()}`);
  } else {
    // Priority 2: normalized phone (strong identifier when no case)
    const phone = normalizePhone(record.contact_phone || record.phone);
    if (phone) parts.push(`phone:${phone}`);

    // Priority 3: normalized address + city
    const addr = normalizeAddress(record.property_address || record.address);
    const city = record.property_city || record.city;
    if (addr && city) {
      parts.push(`addr:${addr}|${String(city).trim().toUpperCase()}`);
    }

    // Priority 4: name + post_url (for FSBO when no address yet)
    const name = normalizeName(record.contact_name || record.name);
    const url = record.post_url || record.url_scraped;
    if (name && url) parts.push(`url:${name}|${url}`);
  }

  if (parts.length === 0) return null;

  const composite = parts.sort().join("||");
  return createHash("sha256").update(composite).digest("hex").slice(0, 16);
}

/**
 * Check if a record is duplicate against a list of existing dedup keys.
 */
export function isDuplicate(record, existingKeys) {
  const key = buildDedupKey(record);
  if (!key) return false;
  const set = existingKeys instanceof Set ? existingKeys : new Set(existingKeys || []);
  return set.has(key);
}
