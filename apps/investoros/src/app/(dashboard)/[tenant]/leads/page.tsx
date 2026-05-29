/**
 * /[tenant]/leads — full leads table with filter chips.
 *
 * Reads up to 200 leads from Airtable per page load and lets the user filter
 * client-side by Heat (Hot/Warm/Cold) and Stage. Each row is a link to the
 * underlying Airtable record (which is the source of truth until we ship the
 * lead-detail page).
 */
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getGeoLeads, GEO_BASE_ID, GEO_TABLES } from "@/lib/airtable";
import { LeadsTable } from "@/components/dashboard/LeadsTable";

export const metadata = { title: "Leads" };
export const revalidate = 60;

export default async function LeadsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  const user = await currentUser();
  if (!user) notFound();

  const userTenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (userTenantId !== tenantSlug) notFound();

  const leadsRes = await getGeoLeads({ maxRecords: 200, tenantSlug }).catch(() => ({ records: [] }));
  const leads = (leadsRes.records ?? []).map((r) => ({
    id: r.id,
    createdTime: r.createdTime,
    ...r.fields,
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Leads</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            {leads.length} lead{leads.length === 1 ? "" : "s"} loaded from your Airtable base.
          </p>
        </div>
        <a
          href={`https://airtable.com/${GEO_BASE_ID}/${GEO_TABLES.leads}`}
          target="_blank"
          rel="noopener"
          className="text-xs font-medium text-[#a5b4fc] underline underline-offset-2 hover:text-white"
        >
          Open in Airtable ↗
        </a>
      </header>

      <LeadsTable leads={leads} baseId={GEO_BASE_ID} tableId={GEO_TABLES.leads} />
    </div>
  );
}
