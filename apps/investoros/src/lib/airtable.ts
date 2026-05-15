/**
 * Airtable server-side fetch helpers.
 *
 * Reads token from $AIRTABLE_TOKEN_GEO (multi-tenant: each tenant has its own token env var
 * resolved from the tenant config). Tenant base IDs + table IDs live in the tenant JSON
 * config at agents/tenants/<slug>.json — for the SaaS dashboard we duplicate the IDs here
 * as a typed mapping to keep this app standalone (B2 will fetch tenant config dynamically).
 *
 * Server components only — never import this in a 'use client' file.
 */

import "server-only";

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

function getToken(): string {
  const t = process.env[TOKEN_ENV_NAME] ?? process.env.AIRTABLE_TOKEN;
  if (!t) {
    throw new Error(
      `Missing env var ${TOKEN_ENV_NAME} (or fallback AIRTABLE_TOKEN). ` +
        `Set it in .env.local for the InvestorOS web app.`
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
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
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

export async function getLatestSEOAudit() {
  return listRecords<GeoSEOAudit>(GEO_BASE_ID, GEO_TABLES.seoAudits, {
    sortField: "started_at",
    sortDirection: "desc",
    maxRecords: 1,
  });
}

export async function getRecentSEOAudits(limit = 10) {
  return listRecords<GeoSEOAudit>(GEO_BASE_ID, GEO_TABLES.seoAudits, {
    sortField: "started_at",
    sortDirection: "desc",
    maxRecords: limit,
  });
}

export async function getContentQueue(opts: FetchOpts = {}) {
  return listRecords<GeoContentQueue>(GEO_BASE_ID, GEO_TABLES.contentQueue, {
    maxRecords: 50,
    ...opts,
  });
}
