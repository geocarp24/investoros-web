/**
 * RecentLeads — table of latest leads for tenant.
 *
 * Refactored 2026-06-04 for Geo_Leads schema (Full Name / Phone / Lead Status / Urgency / Service Type).
 * Previous version used Pinnacle-style fields (Heat / Stage / Lead title / Service) which don't exist.
 */
import type { GeoLead } from "@/lib/airtable";

interface Lead extends GeoLead {
  id: string;
  createdTime: string;
}

const SERVICE_LABEL: Record<string, string> = {
  kitchen_remodeling: "Kitchen Remodel",
  bathroom_remodeling: "Bathroom Remodel",
  deck_building: "Deck Building",
  finish_carpentry: "Finish Carpentry",
  home_renovation: "Home Renovation",
  general_construction: "General Construction",
  other: "Other",
  unknown: "—",
};

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
        <div className="p-8 text-center">
          <div className="text-3xl mb-2">📥</div>
          <p className="text-sm font-medium text-[var(--color-foreground)] mb-1">
            No leads yet
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
            Leads from the website will land here automatically.
          </p>
          <a
            href="https://geocarpentry.com/contact/"
            target="_blank"
            rel="noopener"
            className="inline-block text-xs font-semibold text-[var(--color-accent)] hover:underline"
          >
            Submit a test lead →
          </a>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {leads.slice(0, 10).map((l) => {
            const urgency = String(l["Urgency"] ?? "unknown");
            const status = String(l["Lead Status"] ?? "New");
            const service = String(l["Service Type"] ?? "unknown");
            const name = String(l["Full Name"] ?? "Untitled lead");
            const source = l["Source"];
            return (
              <li key={l.id} className="px-5 py-3 hover:bg-[var(--color-muted)] transition-colors">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                      {SERVICE_LABEL[service] ?? service}
                      {source ? ` · ${source}` : ""}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        urgency === "hot"
                          ? "bg-red-100 text-red-700"
                          : urgency === "warm"
                          ? "bg-amber-100 text-amber-700"
                          : status === "Qualified" || status === "Appointment Set"
                          ? "bg-emerald-100 text-emerald-800"
                          : status === "Not Interested" || status === "DNC"
                          ? "bg-slate-100 text-slate-700"
                          : status === "New"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                      }`}
                    >
                      {urgency === "hot" ? "🔴 " : urgency === "warm" ? "🟡 " : ""}
                      {status}
                    </span>
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      {timeAgo(l.createdTime)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
