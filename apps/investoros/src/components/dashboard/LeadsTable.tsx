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
 *
 * 2026-06-04 Phase 3 add: PipelineBar (status distribution) + inline row
 * expansion (full details + quick action links).
 */
import { Fragment, useMemo, useState } from "react";

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

const STATUS_BAR_COLOR: Record<string, string> = {
  New: "#3b82f6",
  Contacted: "#8b5cf6",
  Qualified: "#22c55e",
  "Appointment Set": "#06b6d4",
  "Not Interested": "#64748b",
  DNC: "#ef4444",
};

const STATUS_ORDER = [
  "New",
  "Contacted",
  "Qualified",
  "Appointment Set",
  "Not Interested",
  "DNC",
] as const;

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

function formatAppointment(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // Pipeline counts — by Lead Status, only for leads that are still in-flight.
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      const s = String(l["Lead Status"] ?? "New");
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return STATUS_ORDER.map((s) => ({ status: s, count: counts[s] ?? 0 }));
  }, [leads]);

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

      {/* Pipeline bar */}
      <PipelineBar
        counts={pipelineCounts}
        activeStatus={statusFilter === "all" ? null : statusFilter}
        onSelect={(s) => setStatusFilter(s === statusFilter ? "all" : s)}
      />

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
              const expanded = expandedId === l.id;
              return (
                <Fragment key={l.id}>
                  <tr
                    onClick={() => setExpandedId(expanded ? null : l.id)}
                    className={[
                      "cursor-pointer text-[#cbd5e1] transition-colors",
                      expanded
                        ? "bg-[rgba(99,102,241,0.06)]"
                        : "hover:bg-[rgba(255,255,255,0.02)]",
                    ].join(" ")}
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
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#475569]">{expanded ? "▼" : "▶"}</span>
                        <div>
                          <div className="font-medium text-white">
                            {String(l["Full Name"] ?? "—")}
                          </div>
                          {Boolean(l["Phone"]) && (
                            <a
                              href={`tel:${l["Phone"]}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-[#a5b4fc] hover:text-white"
                            >
                              {formatPhone(String(l["Phone"]))}
                            </a>
                          )}
                        </div>
                      </div>
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
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] font-medium text-[#a5b4fc] hover:text-white"
                      >
                        Open ↗
                      </a>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-[rgba(99,102,241,0.04)]">
                      <td colSpan={8} className="px-6 py-4">
                        <LeadDetail lead={l} baseId={baseId} tableId={tableId} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PipelineBar({
  counts,
  activeStatus,
  onSelect,
}: {
  counts: Array<{ status: string; count: number }>;
  activeStatus: string | null;
  onSelect: (status: string) => void;
}) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) return null;
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
          Pipeline
        </div>
        <div className="text-[11px] text-[#64748b]">click a stage to filter</div>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
        {counts.map((c) => {
          if (c.count === 0) return null;
          const pct = (c.count / total) * 100;
          const isActive = activeStatus === c.status;
          return (
            <button
              key={c.status}
              onClick={() => onSelect(c.status)}
              title={`${c.status}: ${c.count}`}
              className="h-full transition-opacity hover:opacity-80"
              style={{
                width: `${pct}%`,
                background: STATUS_BAR_COLOR[c.status] ?? "#64748b",
                opacity: activeStatus && !isActive ? 0.35 : 1,
              }}
            />
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {counts.map((c) => {
          const isActive = activeStatus === c.status;
          const color = STATUS_BAR_COLOR[c.status] ?? "#64748b";
          return (
            <button
              key={c.status}
              onClick={() => onSelect(c.status)}
              className={[
                "rounded-md border px-2 py-1.5 text-left transition-colors",
                isActive
                  ? "border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.1)]"
                  : "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]",
              ].join(" ")}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#94a3b8]">
                  {c.status}
                </span>
              </div>
              <div className="mt-0.5 text-base font-bold text-white">{c.count}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LeadDetail({
  lead,
  baseId,
  tableId,
}: {
  lead: Lead;
  baseId: string;
  tableId: string;
}) {
  const phone = lead["Phone"] ? String(lead["Phone"]) : null;
  const phone2 = lead["Phone2"] ? String(lead["Phone2"]) : null;
  const address = lead["Home Address"] ? String(lead["Home Address"]) : null;
  const description = lead["Project Description"] ? String(lead["Project Description"]) : null;
  const notes = lead["Notes"] ? String(lead["Notes"]) : null;
  const budget = lead["Budget Range"] ? String(lead["Budget Range"]) : null;
  const timeline = lead["Timeline"] ? String(lead["Timeline"]) : null;
  const appointment = lead["Appointment Date"] ? String(lead["Appointment Date"]) : null;
  const language = lead["Language"] ? String(lead["Language"]) : null;
  const lastContact = lead["Last Contact Date"] ? String(lead["Last Contact Date"]) : null;
  const dnc = Boolean(lead["Do Not Contact"]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left: project info */}
      <div className="space-y-3 lg:col-span-2">
        {description && (
          <DetailBlock label="Project">
            <p className="text-sm text-white whitespace-pre-wrap">{description}</p>
          </DetailBlock>
        )}
        {notes && (
          <DetailBlock label="Notes">
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-[#cbd5e1] leading-relaxed">
              {notes}
            </pre>
          </DetailBlock>
        )}
        {address && (
          <DetailBlock label="Address">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener"
              className="text-sm text-[#a5b4fc] hover:text-white hover:underline underline-offset-2"
            >
              {address}
            </a>
          </DetailBlock>
        )}
      </div>

      {/* Right: facts + actions */}
      <div className="space-y-3">
        <DetailBlock label="Quick actions">
          <div className="flex flex-col gap-1.5">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="rounded-md border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] px-3 py-1.5 text-center text-xs font-medium text-[#86efac] hover:bg-[rgba(34,197,94,0.2)]"
              >
                📞 Call {formatPhone(phone)}
              </a>
            )}
            {phone && (
              <a
                href={`sms:${phone}`}
                className="rounded-md border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.1)] px-3 py-1.5 text-center text-xs font-medium text-[#a5b4fc] hover:bg-[rgba(99,102,241,0.2)]"
              >
                💬 SMS
              </a>
            )}
            <a
              href={`https://airtable.com/${baseId}/${tableId}/${lead.id}`}
              target="_blank"
              rel="noopener"
              className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-[rgba(255,255,255,0.08)]"
            >
              ✏️ Edit in Airtable ↗
            </a>
          </div>
        </DetailBlock>

        <DetailBlock label="Facts">
          <dl className="space-y-1.5 text-xs">
            {phone2 && (
              <FactRow label="Phone 2">{formatPhone(phone2)}</FactRow>
            )}
            {budget && <FactRow label="Budget">{budget}</FactRow>}
            {timeline && <FactRow label="Timeline">{timeline}</FactRow>}
            {appointment && (
              <FactRow label="Appointment">
                <span className="text-[#86efac]">{formatAppointment(appointment)}</span>
              </FactRow>
            )}
            {language && <FactRow label="Language">{language}</FactRow>}
            {lastContact && <FactRow label="Last contact">{lastContact}</FactRow>}
            {dnc && (
              <FactRow label="DNC">
                <span className="text-red-400">⛔ Do not contact</span>
              </FactRow>
            )}
            {lead.createdTime && (
              <FactRow label="Created">
                {new Date(lead.createdTime).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </FactRow>
            )}
          </dl>
        </DetailBlock>
      </div>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[#16161f] p-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
        {label}
      </div>
      {children}
    </div>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[#64748b]">{label}</dt>
      <dd className="text-right text-[#cbd5e1]">{children}</dd>
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
