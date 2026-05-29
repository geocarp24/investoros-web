/**
 * /[tenant]/content — content queue browser.
 *
 * Shows the Airtable Content_Queue for the tenant. Cards group by status
 * (Draft / Review / Ready / Published) so the user sees the production pipeline.
 */
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getContentQueue, GEO_BASE_ID, GEO_TABLES } from "@/lib/airtable";

export const metadata = { title: "Content" };
export const revalidate = 60;

const STATUS_GROUPS = ["draft", "review", "ready_to_publish", "published"] as const;
const STATUS_LABEL: Record<(typeof STATUS_GROUPS)[number], string> = {
  draft: "Drafting",
  review: "In Review",
  ready_to_publish: "Ready",
  published: "Published",
};
const STATUS_COLOR: Record<(typeof STATUS_GROUPS)[number], string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  review: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  ready_to_publish: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  published: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

export default async function ContentPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  const user = await currentUser();
  if (!user) notFound();

  const userTenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (userTenantId !== tenantSlug) notFound();

  const queueRes = await getContentQueue({ maxRecords: 200, tenantSlug }).catch(() => ({ records: [] }));
  const items = (queueRes.records ?? []).map((r) => ({ id: r.id, ...r.fields }));

  const byStatus = STATUS_GROUPS.map((s) => ({
    key: s,
    label: STATUS_LABEL[s],
    color: STATUS_COLOR[s],
    items: items.filter((i) => String(i.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === s),
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Content</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Content Queue</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            {items.length} item{items.length === 1 ? "" : "s"} in queue · El Escriba drafts; you approve.
          </p>
        </div>
        <a
          href={`https://airtable.com/${GEO_BASE_ID}/${GEO_TABLES.contentQueue}`}
          target="_blank"
          rel="noopener"
          className="text-xs font-medium text-[#a5b4fc] underline underline-offset-2 hover:text-white"
        >
          Open in Airtable ↗
        </a>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {byStatus.map((bucket) => (
          <section
            key={bucket.key}
            className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-4"
            aria-label={bucket.label}
          >
            <header className="mb-3 flex items-center justify-between">
              <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${bucket.color}`}>
                {bucket.label}
              </span>
              <span className="text-[11px] text-[#64748b]">{bucket.items.length}</span>
            </header>
            <ul className="space-y-2">
              {bucket.items.length === 0 && (
                <li className="rounded-md border border-dashed border-[rgba(255,255,255,0.07)] p-3 text-center text-[11px] text-[#64748b]">
                  Empty
                </li>
              )}
              {bucket.items.slice(0, 12).map((it) => (
                <li key={it.id}>
                  <a
                    href={`https://airtable.com/${GEO_BASE_ID}/${GEO_TABLES.contentQueue}/${it.id}`}
                    target="_blank"
                    rel="noopener"
                    className="block rounded-md border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] p-3 transition-colors hover:border-[rgba(99,102,241,0.4)] hover:bg-[rgba(99,102,241,0.06)]"
                  >
                    <p className="line-clamp-2 text-xs font-medium text-white">
                      {String(it.title ?? it.target_keyword ?? "Untitled")}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-[10px] text-[#64748b]">
                      <span>{String(it.content_type ?? "—")}</span>
                      {it.language && <span>· {String(it.language)}</span>}
                      {it.word_count && <span>· {Number(it.word_count)}w</span>}
                    </p>
                  </a>
                </li>
              ))}
              {bucket.items.length > 12 && (
                <li className="pt-1 text-center text-[10px] text-[#64748b]">
                  +{bucket.items.length - 12} more in Airtable
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
