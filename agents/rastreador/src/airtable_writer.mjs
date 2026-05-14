/**
 * airtable_writer.mjs — write scraped results to Airtable Scraping_Results table.
 * Sprint F2.2.c (Jorge 2026-05-08).
 */

let _fetch = globalThis.fetch;
export function __setFetch(fn) { _fetch = fn; }

const AT_BASE = "https://api.airtable.com/v0";

/**
 * Build a Airtable record fields object from a scraped record.
 */
export function buildAirtableFields(record) {
  if (!record) throw new Error("record required");
  const out = {};
  if (record.source_id) out.Source_ID = record.source_id;
  if (record.category) out.Category = record.category;
  if (record.tenant_id) out.Tenant_ID = record.tenant_id;
  if (record.title) out.Title = String(record.title).slice(0, 500);
  if (record.url_scraped) out.URL_Scraped = record.url_scraped;
  if (record.raw_data) {
    out.Raw_Data = typeof record.raw_data === "string"
      ? record.raw_data.slice(0, 100000)
      : JSON.stringify(record.raw_data).slice(0, 100000);
  }
  if (record.contact_name) out.Contact_Name = String(record.contact_name).slice(0, 200);
  if (record.contact_phone) out.Contact_Phone = record.contact_phone;
  if (record.contact_email) out.Contact_Email = record.contact_email;
  if (record.property_address) out.Property_Address = String(record.property_address).slice(0, 200);
  if (record.property_city) out.Property_City = record.property_city;
  if (record.property_state) out.Property_State = record.property_state;
  if (record.property_zip) out.Property_Zip = record.property_zip;
  if (record.situation) out.Situation = record.situation;
  out.Status = record.status || "New";
  out.Scraped_At = record.scraped_at || new Date().toISOString();
  if (record.notes) out.Notes = String(record.notes).slice(0, 5000);
  return out;
}

/**
 * Create one record in Scraping_Results.
 *
 * @param {object} env - { token, baseId, tableId }
 * @param {object} record - scraping result
 * @returns {Promise<object>} - { id, fields } or { error }
 */
export async function createScrapingResult(env, record) {
  const { token, baseId, tableId } = env;
  if (!token || !baseId || !tableId) throw new Error("env requires token + baseId + tableId");

  const fields = buildAirtableFields(record);
  const url = `${AT_BASE}/${baseId}/${tableId}`;
  const res = await _fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, typecast: true }),
  });
  const body = await res.json();
  if (!res.ok) {
    return { error: body?.error?.message || `HTTP ${res.status}`, status: res.status };
  }
  return { id: body.id, fields: body.fields };
}

/**
 * Bulk create — Airtable supports up to 10 records per POST.
 */
export async function bulkCreateScrapingResults(env, records) {
  const { token, baseId, tableId } = env;
  if (!token || !baseId || !tableId) throw new Error("env requires token + baseId + tableId");
  if (!Array.isArray(records) || records.length === 0) return { created: [], errors: [] };

  const created = [];
  const errors = [];
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const url = `${AT_BASE}/${baseId}/${tableId}`;
    const res = await _fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: chunk.map(r => ({ fields: buildAirtableFields(r) })),
        typecast: true,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      errors.push({ chunk_start: i, error: body?.error?.message || `HTTP ${res.status}` });
    } else {
      for (const rec of (body.records || [])) created.push(rec);
    }
  }
  return { created, errors };
}

/**
 * Fetch recent records to build dedup key set (calls deduplication external).
 *
 * @param {object} env - { token, baseId, tableId }
 * @param {object} opts - { lookbackDays=90, tenantId, maxRecords=500 }
 * @returns {Promise<Array<object>>} - array of fields objects
 */
export async function fetchRecentRecords(env, opts = {}) {
  const { token, baseId, tableId } = env;
  const { lookbackDays = 90, tenantId, maxRecords = 500 } = opts;
  if (!token || !baseId || !tableId) throw new Error("env requires token + baseId + tableId");

  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString();
  const filterParts = [`IS_AFTER({Scraped_At}, '${cutoff}')`];
  if (tenantId) filterParts.push(`{Tenant_ID}='${tenantId}'`);
  const formula = filterParts.length === 1 ? filterParts[0] : `AND(${filterParts.join(", ")})`;

  const out = [];
  let offset = "";
  do {
    const url = `${AT_BASE}/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}&pageSize=100${offset ? `&offset=${offset}` : ""}`;
    const res = await _fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    if (!res.ok) break;
    const body = await res.json();
    for (const rec of (body.records || [])) {
      out.push(rec.fields || {});
      if (out.length >= maxRecords) return out;
    }
    offset = body.offset || "";
  } while (offset);
  return out;
}
