/**
 * Airtable server-side fetch helpers.
 *
 * Token resolution (in order):
 *  1. If caller passes `tenantSlug` → fetch from credential vault (src/lib/credentials.ts)
 *  2. Else fall back to per-tenant env var (e.g. AIRTABLE_TOKEN_GEO)
 *  3. Else generic AIRTABLE_TOKEN
 *
 * This three-tier resolution lets new tenants live in the vault while Pinnacle
 * and Geo Carpentry keep working from env vars during the migration.
 *
 * Server components only — never import this in a 'use client' file.
 */

import "server-only";
import { getCredential } from "@/lib/credentials";
import { db } from "@/server/db";

export const GEO_BASE_ID = "appAQpveuAec077jF";
export const GEO_TABLES = {
  contacts: "tbldetnRGCnmHDgFw",
  leads: "tblVqrROrVspFXniG",
  jobs: "tblRlPhcwiGP7J8LS",
  subs: "tbldciY36E08UEEua",
  activities: "tblWbxNNyGzRhdIwF",
  permits: "tblz1qVWHJZFjQzqX",
  seoAudits: "tbl53FPGfpa4OtafX",
  contentQueue: "tblpiN42pK3YFxGEW",
} as const;

const TOKEN_ENV_NAME = "AIRTABLE_TOKEN_GEO";

interface AirtableListResponse<T = Record<string, unknown>> {
  records: Array<{ id: string; fields: T; createdTime: string }>;
  offset?: string;
}

/**
 * Resolves an Airtable token. Pass `tenantSlug` to use the credential vault;
 * omit it to fall back to env vars (backwards compat for Pinnacle / Geo).
 */
async function getToken(tenantSlug?: string): Promise<string> {
  if (tenantSlug) {
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (tenant) {
      // Compute the legacy fallback env var for this tenant
      const envFallback = `AIRTABLE_TOKEN_${tenantSlug.toUpperCase().replace(/-/g, "_")}`;
      const token = await getCredential(tenant.id, "airtable", "api_token", envFallback);
      if (token) return token;
    }
    // fall through to legacy env var resolution
  }

  const t = process.env[TOKEN_ENV_NAME] ?? process.env.AIRTABLE_TOKEN;
  if (!t) {
    throw new Error(
      `Missing env var ${TOKEN_ENV_NAME} (or fallback AIRTABLE_TOKEN). ` +
        `Set it in .env.local for the InvestorOS web app, ` +
        `or provision the credential via /settings/connections for tenant "${tenantSlug ?? "unknown"}".`
    );
  }
  return t;
}

interface FetchOpts {
  filterByFormula?: string;
  maxRecords?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  fields?: string[];
  revalidate?: number; // seconds, Next.js fetch cache
  /** Resolve token from credential vault for this tenant; falls back to env var if vault miss. */
  tenantSlug?: string;
}

export async function listRecords<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  opts: FetchOpts = {}
): Promise<AirtableListResponse<T>> {
  const params = new URLSearchParams();
  if (opts.maxRecords) params.set("maxRecords", String(opts.maxRecords));
  if (opts.filterByFormula) params.set("filterByFormula", opts.filterByFormula);
  if (opts.sortField) {
    params.set("sort[0][field]", opts.sortField);
    params.set("sort[0][direction]", opts.sortDirection ?? "desc");
  }
  if (opts.fields) {
    opts.fields.forEach((f, i) => params.set(`fields[${i}]`, f));
  }

  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?${params.toString()}`;
  const token = await getToken(opts.tenantSlug);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: opts.revalidate ?? 60 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as AirtableListResponse<T>;
}

/* ---------- Geo Carpentry typed accessors ---------- */

export interface GeoLead {
  "Lead title"?: string;
  "Stage"?: string;
  "Service"?: string;
  "Estimated value"?: number;
  "Created date"?: string;
  "Contact"?: string[];
  "Source"?: string;
  "Heat"?: "Hot" | "Warm" | "Cold";
  "Budget"?: number;
  "ZIP"?: string;
  "Phone"?: string;
  "Notes"?: string;
}

export interface GeoSubcontractor {
  Name?: string;
  Trade?: string;
  City?: string;
  License?: string;
  Phone?: string;
  Status?: string;
}

export interface GeoContact {
  Name?: string;
  Email?: string;
  Phone?: string;
  City?: string;
  Source?: string;
  Status?: string;
}

export interface GeoSEOAudit {
  run_id?: string;
  overall_score?: number;
  status?: string;
  audit_type?: string;
  started_at?: string;
  top_issues?: string;
  top_wins?: string;
  recommendations?: string;
  technical_score?: number;
  local_score?: number;
  content_score?: number;
}

export interface GeoContentQueue {
  run_id?: string;
  status?: string;
  content_type?: string;
  pillar?: string;
  title?: string;
  target_keyword?: string;
  language?: string;
  word_count?: number;
  scheduled_date?: string;
  slug?: string;
  service_slug?: string;
  city_slug?: string;
  meta_description?: string;
  body_md?: string;
  body_md_es?: string;
  schema_jsonld?: string;
  faq_jsonld?: string;
  internal_links?: string;
  cta_primary?: string;
}

export async function getGeoLeads(opts: FetchOpts = {}) {
  return listRecords<GeoLead>(GEO_BASE_ID, GEO_TABLES.leads, {
    sortField: "Created date",
    sortDirection: "desc",
    maxRecords: 100,
    ...opts,
  });
}

export async function getGeoContacts(opts: FetchOpts = {}) {
  return listRecords<GeoContact>(GEO_BASE_ID, GEO_TABLES.contacts, {
    maxRecords: 100,
    ...opts,
  });
}

export async function getLatestSEOAudit(tenantSlug?: string) {
  return listRecords<GeoSEOAudit>(GEO_BASE_ID, GEO_TABLES.seoAudits, {
    sortField: "started_at",
    sortDirection: "desc",
    maxRecords: 1,
    tenantSlug,
  });
}

export async function getRecentSEOAudits(limit = 10, tenantSlug?: string) {
  return listRecords<GeoSEOAudit>(GEO_BASE_ID, GEO_TABLES.seoAudits, {
    sortField: "started_at",
    sortDirection: "desc",
    maxRecords: limit,
    tenantSlug,
  });
}

export const GEO_MARKETING_AUDITS_TABLE = "tbld7LtJzeN5QTHPo";

export interface GeoMarketingAudit {
  run_id?: string;
  score?: number;
  status?: string;
  audit_type?: string;
  started_at?: string;
  top_issues?: string;
  recommendations?: string;
}

export async function getRecentMarketingAudits(limit = 10, tenantSlug?: string) {
  return listRecords<GeoMarketingAudit>(GEO_BASE_ID, GEO_MARKETING_AUDITS_TABLE, {
    sortField: "started_at",
    sortDirection: "desc",
    maxRecords: limit,
    tenantSlug,
  });
}

export async function getContentQueue(opts: FetchOpts = {}) {
  // No default sortField — the Content_Queue table doesn't have a stable
  // "scheduled_date" column yet (Airtable 422 in build 2026-05-27).
  // Caller can pass `sortField: "<exact-airtable-field-name>"` once defined.
  return listRecords<GeoContentQueue>(GEO_BASE_ID, GEO_TABLES.contentQueue, {
    maxRecords: 50,
    ...opts,
  });
}

export async function getSubcontractors(opts: FetchOpts & { trade?: string } = {}) {
  const { trade, ...rest } = opts;
  return listRecords<GeoSubcontractor>(GEO_BASE_ID, GEO_TABLES.subs, {
    maxRecords: 20,
    sortField: "Name",
    sortDirection: "asc",
    filterByFormula: trade ? `{Trade}='${trade}'` : undefined,
    ...rest,
  });
}

export async function getAgentRuns(limit = 5, tenantSlug?: string) {
  return getRecentSEOAudits(limit, tenantSlug);
}
