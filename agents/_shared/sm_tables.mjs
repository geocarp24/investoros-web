/**
 * sm_tables.mjs — Central config for the 3-table Social Media schema.
 *
 * Architecture (Jorge 2026-05-07): Posts / Reels / Videos in separate tables,
 * bilingual = separate records per language (ES + EN linked by Source_Idea_ID).
 *
 * All SM agents (SM Manager, Oráculo, Reescritor, Creativo, Director v2,
 * publisher) import from this module.
 *
 * Multi-tenant (2026-06-01): when --tenant <slug> is in argv, env vars resolve
 * to suffixed variants (AIRTABLE_SM_POSTS_TABLE_ID_GEO for geo-carpentry).
 * Fallback to non-suffixed for default Pinnacle. Token also picks
 * AIRTABLE_TOKEN_<TENANT> when available.
 */

function detectTenant() {
  const argv = process.argv;
  const idx  = argv.indexOf("--tenant");
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return process.env.TENANT_SLUG || "pinnacle";
}

// Explicit suffix per tenant (matches existing env var naming convention).
// New tenants: add entry here, OR set TENANT_ENV_SUFFIX env var.
const TENANT_SUFFIX_MAP = {
  "pinnacle":      "",
  "geo-carpentry": "_GEO",
};

const TENANT = detectTenant();
const SUFFIX = TENANT_SUFFIX_MAP[TENANT] ??
               process.env.TENANT_ENV_SUFFIX ??
               `_${TENANT.toUpperCase().replace(/-/g, "_")}`;

function envWithSuffix(base) {
  // Resolve: prefer suffixed (e.g. AIRTABLE_SM_POSTS_TABLE_ID_GEO),
  // fall back to non-suffixed (Pinnacle default).
  return process.env[base + SUFFIX] || process.env[base] || "";
}

export const SM_TENANT          = TENANT;
export const SM_BASE_ID         = envWithSuffix("AIRTABLE_SM_BASE_ID")         || "[REDACTED_AIRTABLE_BASE_ID]";
export const SM_POSTS_TABLE_ID  = envWithSuffix("AIRTABLE_SM_POSTS_TABLE_ID")  || "[REDACTED_AIRTABLE_TABLE_ID]";
export const SM_REELS_TABLE_ID  = envWithSuffix("AIRTABLE_SM_REELS_TABLE_ID")  || "[REDACTED_AIRTABLE_TABLE_ID]";
export const SM_VIDEOS_TABLE_ID = envWithSuffix("AIRTABLE_SM_VIDEOS_TABLE_ID") || "[REDACTED_AIRTABLE_TABLE_ID]";

// Token: prefer per-tenant (AIRTABLE_TOKEN_GEO), then SM-specific, then default.
export const SM_TOKEN =
  process.env[`AIRTABLE_TOKEN${SUFFIX}`] ||
  process.env.AIRTABLE_SM_TOKEN ||
  process.env.AIRTABLE_TOKEN ||
  "";

// Status enum (single select) — same across all 3 tables.
export const STATUS = Object.freeze({
  IDEA:         "Idea",
  ORACULO_OK:   "Oraculo OK",
  RECHAZADA:    "Rechazada",
  VISUAL_LISTO: "Visual Listo",
  PROGRAMADO:   "Programado",
  PUBLICADO:    "Publicado",
  ERROR:        "Error",
});

// Helper: build Airtable URL for a specific table.
export function smUrl(tableId, recordId = "", params = "") {
  const base = `https://api.airtable.com/v0/${SM_BASE_ID}/${tableId}`;
  if (recordId) return `${base}/${recordId}` + (params ? `?${params}` : "");
  return base + (params ? `?${params}` : "");
}

// Common headers for all SM Airtable calls.
export function smAuthHeaders() {
  return {
    "Authorization": `Bearer ${SM_TOKEN}`,
    "Content-Type":  "application/json",
  };
}

// All 3 tables as a list (used by Oráculo + Reescritor to loop).
export const SM_TABLES = Object.freeze([
  { id: SM_POSTS_TABLE_ID,  format: "Post"  },
  { id: SM_REELS_TABLE_ID,  format: "Reel"  },
  { id: SM_VIDEOS_TABLE_ID, format: "Video" },
]);
