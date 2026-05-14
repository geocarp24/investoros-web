/**
 * sm_tables.mjs — Central config for the 3-table Social Media schema.
 *
 * Architecture (Jorge 2026-05-07): Posts / Reels / Videos in separate tables,
 * bilingual = separate records per language (ES + EN linked by Source_Idea_ID).
 *
 * All SM agents (SM Manager, Oráculo, Reescritor, Creativo, Director v2,
 * publisher) import from this module.
 */

export const SM_BASE_ID         = process.env.AIRTABLE_SM_BASE_ID         || "[REDACTED_AIRTABLE_BASE_ID]";
export const SM_POSTS_TABLE_ID  = process.env.AIRTABLE_SM_POSTS_TABLE_ID  || "[REDACTED_AIRTABLE_TABLE_ID]";
export const SM_REELS_TABLE_ID  = process.env.AIRTABLE_SM_REELS_TABLE_ID  || "[REDACTED_AIRTABLE_TABLE_ID]";
export const SM_VIDEOS_TABLE_ID = process.env.AIRTABLE_SM_VIDEOS_TABLE_ID || "[REDACTED_AIRTABLE_TABLE_ID]";

export const SM_TOKEN = process.env.AIRTABLE_SM_TOKEN || "";

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
