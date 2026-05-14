/**
 * normalizer.mjs — pure functions for normalizing scraped data.
 * Sprint F2 (Jorge 2026-05-08).
 */

/**
 * Normalize a US phone number to (XXX) XXX-XXXX format.
 * Returns null if not a valid 10-digit US phone.
 */
export function normalizePhone(input) {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  // Strip leading 1 (US country code)
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return null;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/**
 * Normalize a property address — uppercase, trim whitespace, expand common abbreviations.
 */
export function normalizeAddress(input) {
  if (!input) return null;
  let s = String(input).trim().toUpperCase();
  s = s.replace(/\s+/g, " ");
  // Common abbreviation expansions
  const expansions = [
    [/\bST\b\.?$/, "STREET"],
    [/\bAVE\b\.?$/, "AVENUE"],
    [/\bRD\b\.?$/, "ROAD"],
    [/\bDR\b\.?$/, "DRIVE"],
    [/\bBLVD\b\.?$/, "BOULEVARD"],
    [/\bLN\b\.?$/, "LANE"],
    [/\bCT\b\.?$/, "COURT"],
    [/\bCIR\b\.?$/, "CIRCLE"],
  ];
  for (const [pat, rep] of expansions) {
    s = s.replace(pat, rep);
  }
  return s;
}

/**
 * Normalize a person's name — Title Case + strip extra whitespace.
 */
export function normalizeName(input) {
  if (!input) return null;
  const s = String(input).trim().replace(/\s+/g, " ");
  if (!s) return null;
  return s.split(" ").map(w =>
    w.length === 0 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()
  ).join(" ");
}

/**
 * Extract phone number from free text (e.g. Craigslist body).
 * Returns first valid US phone found, normalized, or null.
 */
export function extractPhoneFromText(text) {
  if (!text) return null;
  const patterns = [
    /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  ];
  for (const pat of patterns) {
    const matches = String(text).match(pat) || [];
    for (const m of matches) {
      const norm = normalizePhone(m);
      if (norm) return norm;
    }
  }
  return null;
}
