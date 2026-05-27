"use client";

/**
 * AgentStatusBar — 6-agent panel with live status + "Run now" trigger.
 *
 * Reads live status per agent from props (derived from Airtable audits in
 * page.tsx). Falls back to "idle" if no data available.
 *
 * Click on a card → POST /api/agents/{slug}/trigger → VPS webhook fires the
 * agent → Airtable record created with status='Running'.
 */

import { useState } from "react";

export interface AgentStatus {
  slug: string;            // matches API path param (lowercase, no spaces)
  name: string;            // display name
  emoji: string;
  status: "on" | "running" | "idle" | "off" | "error";
  label: string;           // human-readable status (e.g. "Last: 2h ago · 62/100")
}

const STATUS_COLORS: Record<AgentStatus["status"], string> = {
  on:      "#059669",
  running: "#2563eb",
  idle:    "#d97706",
  off:     "#94a3b8",
  error:   "#dc2626",
};

const DEFAULT_AGENTS: AgentStatus[] = [
  { slug: "rastreador",   name: "Rastreador",   emoji: "🔍", status: "idle", label: "Stand by" },
  { slug: "clasificador", name: "Clasificador", emoji: "🎯", status: "idle", label: "Stand by" },
  { slug: "posicionador", name: "Posicionador", emoji: "📊", status: "idle", label: "Stand by" },
  { slug: "escriba",      name: "Escriba",      emoji: "✍️", status: "idle", label: "Stand by" },
  { slug: "social_media", name: "Social Media", emoji: "📱", status: "idle", label: "Stand by" },
  { slug: "mercader",     name: "Mercader",     emoji: "📢", status: "idle", label: "Stand by" },
];

interface Props {
  agents?: AgentStatus[];
  tenant?: string;
}

export function AgentStatusBar({ agents = DEFAULT_AGENTS, tenant = "geo-carpentry" }: Props) {
  const [triggered, setTriggered] = useState<Record<string, "pending" | "ok" | "error">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function runAgent(slug: string) {
    if (triggered[slug] === "pending") return;
    setTriggered((s) => ({ ...s, [slug]: "pending" }));
    setErrors((e) => ({ ...e, [slug]: "" }));

    try {
      const res = await fetch(`/api/agents/${slug}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTriggered((s) => ({ ...s, [slug]: "ok" }));
      // Reset after 3s so user can trigger again
      setTimeout(() => setTriggered((s) => ({ ...s, [slug]: undefined as never })), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTriggered((s) => ({ ...s, [slug]: "error" }));
      setErrors((e) => ({ ...e, [slug]: msg }));
      setTimeout(() => setTriggered((s) => ({ ...s, [slug]: undefined as never })), 5000);
    }
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {agents.map((a) => {
        const trig = triggered[a.slug];
        const isPending = trig === "pending";
        const isOk = trig === "ok";
        const isErr = trig === "error";
        return (
          <button
            key={a.slug}
            type="button"
            onClick={() => runAgent(a.slug)}
            disabled={isPending}
            className={`bg-white border rounded-lg p-3 text-center transition-all text-left ${
              isPending ? "opacity-70 cursor-wait border-blue-400" :
              isOk      ? "border-emerald-500" :
              isErr     ? "border-red-500" :
              "border-[#e5e2db] hover:border-[#FF6B00] hover:shadow-sm cursor-pointer"
            }`}
            title={errors[a.slug] || `Click to run ${a.name} now`}
          >
            <div className="text-xl mb-1">{a.emoji}</div>
            <div className="text-[10px] font-bold text-[#1B2A4A] mb-0.5">{a.name}</div>
            <div className="flex items-center justify-center gap-1">
              <span
                className="w-[5px] h-[5px] rounded-full inline-block flex-shrink-0"
                style={{ background: STATUS_COLORS[a.status] }}
              />
              <span className="text-[9px] truncate" style={{ color: STATUS_COLORS[a.status] }}>
                {isPending ? "Running…" :
                 isOk      ? "Triggered ✓" :
                 isErr     ? "Error" :
                 a.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
