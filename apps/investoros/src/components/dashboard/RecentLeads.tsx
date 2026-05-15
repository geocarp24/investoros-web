/**
 * RecentLeads — table of latest leads for tenant.
 */
import type { GeoLead } from "@/lib/airtable";

interface Lead extends GeoLead {
  id: string;
  createdTime: string;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function RecentLeads({ leads }: { leads: Lead[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)]">
        <h3 className="text-base font-semibold">Recent Leads</h3>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Most recent first · {leads.length} shown
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="p-6 text-center text-sm text-[var(--color-muted-foreground)] italic">
          No leads yet. Submit a test on geocarpentry.com/contact/ to verify the pipeline.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {leads.slice(0, 10).map((l) => (
            <li key={l.id} className="px-5 py-3 hover:bg-[var(--color-muted)] transition-colors">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {l["Lead title"] || "Untitled lead"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                    {l["Service"] ?? "Unspecified service"}
                    {l["Source"] ? ` · ${l["Source"]}` : ""}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      l["Stage"] === "Won"
                        ? "bg-emerald-100 text-emerald-800"
                        : l["Stage"] === "Lost"
                        ? "bg-red-100 text-red-800"
                        : l["Stage"] === "New"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                    }`}
                  >
                    {l["Stage"] ?? "—"}
                  </span>
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    {timeAgo(l.createdTime)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
