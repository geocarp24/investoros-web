"use client";

/**
 * LeadsTable — reads Geo_Leads (tblaH41HWeVG9ZXLn) — refactored 2026-06-04.
 * Previous version targeted the empty Pinnacle-style "Leads" table with fields
 * (Stage, Heat, Service) that don't exist in Geo_Leads.
 *
 * Geo_Leads schema (canonical, 17 fields):
 *   Full Name, Phone, Phone2, Lead Status, Service Type, Project Description,
 *   Home Address, City, Budget Range, Timeline, Urgency, Appointment Date,
 *   Language, Do Not Contact, Source, Notes, Last Contact Date.
 */
import { useMemo, useState } from "react";

type Lead = Record<string, unknown> & { id: string; createdTime?: string };

const URGENCY_COLOR: Record<string, string> = {
  hot: "bg-red-500/15 text-red-300 border-red-500/30",
  warm: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  cold: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  unknown: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const STATUS_COLOR: Record<string, string> = {
  New: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Contacted: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  Qualified: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Appointment Set": "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "Not Interested": "bg-slate-500/15 text-slate-300 border-slate-500/30",
  DNC: "bg-red-500/15 text-red-300 border-red-500/30",
};

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

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LeadsTable({
  leads,
  baseId,
  tableId,
}: {
  leads: Lead[];
  baseId: string;
  tableId: string;
}) {
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statuses = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => l["Lead Status"] && s.add(String(l["Lead Status"])));
    return Array.from(s);
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (urgencyFilter !== "all" && l["Urgency"] !== urgencyFilter) return false;
      if (statusFilter !== "all" && l["Lead Status"] !== statusFilter) return false;
      return true;
    });
  }, [leads, urgencyFilter, statusFilter]);

  // Metrics
  const last7days = leads.filter((l) => {
    if (!l.createdTime) return false;
    const days = Math.floor((Date.now() - new Date(l.createdTime).getTime()) / (1000 * 60 * 60 * 24));
    return days <= 7;
  }).length;

  const hot = leads.filter((l) => l["Urgency"] === "hot").length;
  const newCount = leads.filter((l) => l["Lead Status"] === "New").length;

  return (
    <div className="space-y-4">
      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total" value={leads.length} color="#a5b4fc" />
        <MetricCard label="Last 7 days" value={last7days} color="#22c55e" />
        <MetricCard label="🔥 Hot" value={hot} color="#ef4444" />
        <MetricCard label="🆕 New" value={newCount} color="#3b82f6" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">Urgency:</span>
        {(["all", "hot", "warm", "cold"] as const).map((h) => (
          <button
            key={h}
            onClick={() => setUrgencyFilter(h)}
            className={[
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors capitalize",
              urgencyFilter === h
                ? "bg-[rgba(99,102,241,0.18)] text-[#a5b4fc] ring-1 ring-[rgba(99,102,241,0.4)]"
                : "bg-[rgba(255,255,255,0.04)] text-[#94a3b8] hover:bg-[rgba(255,255,255,0.08)] hover:text-white",
            ].join(" ")}
          >
            {h === "all" ? "All" : h}
          </button>
        ))}
        <span className="ml-4 text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#16161f] px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[11px] text-[#64748b]">
          {filtered.length} / {leads.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.05)] text-left text-[11px] uppercase tracking-wider text-[#64748b]">
              <th className="px-4 py-3 font-medium">Urgency</th>
              <th className="px-4 py-3 font-medium">Name + Phone</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#94a3b8]">
                  No leads match the current filter.
                  <br />
                  <span className="text-[11px] text-[#64748b]">
                    Try clearing filters or wait for new website / SMS leads.
                  </span>
                </td>
              </tr>
            )}
            {filtered.map((l) => {
              const urgency = String(l["Urgency"] ?? "unknown");
              const status = String(l["Lead Status"] ?? "New");
              const service = String(l["Service Type"] ?? "unknown");
              return (
                <tr
                  key={l.id}
                  className="text-[#cbd5e1] transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${
                        URGENCY_COLOR[urgency] ?? URGENCY_COLOR.unknown
                      }`}
                    >
                      {urgency}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">
                      {String(l["Full Name"] ?? "—")}
                    </div>
                    {Boolean(l["Phone"]) && (
                      <a
                        href={`tel:${l["Phone"]}`}
                        className="text-[11px] text-[#a5b4fc] hover:text-white"
                      >
                        {formatPhone(String(l["Phone"]))}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {SERVICE_LABEL[service] ?? service}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_COLOR[status] ?? "bg-[rgba(255,255,255,0.05)] text-[#94a3b8] border-[rgba(255,255,255,0.1)]"
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {String(l["City"] ?? "—")}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#64748b]">
                    {String(l["Source"] ?? "—")}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#64748b]">
                    {l.createdTime ? formatDate(l.createdTime) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://airtable.com/${baseId}/${tableId}/${l.id}`}
                      target="_blank"
                      rel="noopener"
                      className="text-[11px] font-medium text-[#a5b4fc] hover:text-white"
                    >
                      Open ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.07)] bg-[#16161f] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
