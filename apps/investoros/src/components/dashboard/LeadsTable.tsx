"use client";

import { useMemo, useState } from "react";

type Lead = Record<string, unknown> & { id: string; createdTime?: string };

const HEAT_COLOR: Record<string, string> = {
  Hot: "bg-red-500/15 text-red-300 border-red-500/30",
  Warm: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Cold: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function LeadsTable({
  leads, baseId, tableId,
}: { leads: Lead[]; baseId: string; tableId: string }) {
  const [heatFilter, setHeatFilter] = useState<"all" | "Hot" | "Warm" | "Cold">("all");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const stages = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => l["Stage"] && s.add(String(l["Stage"])));
    return Array.from(s);
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (heatFilter !== "all" && l["Heat"] !== heatFilter) return false;
      if (stageFilter !== "all" && l["Stage"] !== stageFilter) return false;
      return true;
    });
  }, [leads, heatFilter, stageFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">Heat:</span>
        {(["all", "Hot", "Warm", "Cold"] as const).map((h) => (
          <button
            key={h}
            onClick={() => setHeatFilter(h)}
            className={[
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              heatFilter === h
                ? "bg-[rgba(99,102,241,0.18)] text-[#a5b4fc] ring-1 ring-[rgba(99,102,241,0.4)]"
                : "bg-[rgba(255,255,255,0.04)] text-[#94a3b8] hover:bg-[rgba(255,255,255,0.08)] hover:text-white",
            ].join(" ")}
          >
            {h === "all" ? "All" : h}
          </button>
        ))}
        <span className="ml-4 text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">Stage:</span>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#16161f] px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
        >
          <option value="all">All stages</option>
          {stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto text-[11px] text-[#64748b]">
          {filtered.length} / {leads.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.05)] text-left text-[11px] uppercase tracking-wider text-[#64748b]">
              <th className="px-4 py-3 font-medium">Heat</th>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#94a3b8]">
                  No leads match the current filter.
                  <br />
                  <span className="text-[11px] text-[#64748b]">Try clearing the filter or wait for the next agent run.</span>
                </td>
              </tr>
            )}
            {filtered.map((l) => {
              const heat = String(l["Heat"] ?? "");
              const value = typeof l["Estimated value"] === "number" ? Number(l["Estimated value"]) : null;
              return (
                <tr key={l.id} className="text-[#cbd5e1] transition-colors hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="px-4 py-3">
                    {heat && (
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${HEAT_COLOR[heat] ?? "bg-[rgba(255,255,255,0.05)] text-[#94a3b8] border-[rgba(255,255,255,0.1)]"}`}>
                        {heat}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-white">{String(l["Lead title"] ?? "Untitled lead")}</span>
                    {Boolean(l["ZIP"]) && <span className="ml-2 text-[11px] text-[#64748b]">· {String(l["ZIP"])}</span>}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">{String(l["Service"] ?? "—")}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{String(l["Stage"] ?? "New")}</td>
                  <td className="px-4 py-3 text-[11px] text-[#64748b]">{String(l["Source"] ?? "—")}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white">
                    {value !== null ? `$${value.toLocaleString()}` : "—"}
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
