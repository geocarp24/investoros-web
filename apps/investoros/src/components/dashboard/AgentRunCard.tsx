"use client";

import { useState } from "react";
import { Play, Loader2, Check, X } from "lucide-react";

interface AgentRunCardProps {
  tenant: string;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  cron?: string;
  status: "production" | "code-complete" | "planned";
  /** Default agent mode (e.g. "seo_health" for posicionador). Sent in trigger payload. */
  defaultMode: string;
  lastRunISO?: string;
  lastScore?: number;
}

const STATUS_STYLE: Record<AgentRunCardProps["status"], { dot: string; label: string }> = {
  "production":    { dot: "#22c55e", label: "Production" },
  "code-complete": { dot: "#f59e0b", label: "Code-complete" },
  "planned":       { dot: "#6366f1", label: "Planned" },
};

function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AgentRunCard({
  tenant, slug, name, emoji, description, cron, status, defaultMode, lastRunISO, lastScore,
}: AgentRunCardProps) {
  const [runState, setRunState] = useState<"idle" | "pending" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function runAgent() {
    if (runState === "pending") return;
    setRunState("pending");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/agents/${slug}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant, mode: defaultMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRunState("ok");
      setTimeout(() => setRunState("idle"), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setRunState("error");
      setTimeout(() => setRunState("idle"), 8000);
    }
  }

  const style = STATUS_STYLE[status];
  const isDisabled = status === "planned" || runState === "pending";

  return (
    <article className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-5 transition-colors hover:border-[rgba(255,255,255,0.14)]">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[rgba(255,255,255,0.04)] text-xl">
            {emoji}
          </span>
          <div>
            <h3 className="text-base font-semibold text-white">{name}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#64748b]">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
              {style.label}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runAgent}
          disabled={isDisabled}
          className={[
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            isDisabled
              ? "cursor-not-allowed bg-[rgba(255,255,255,0.04)] text-[#475569]"
              : runState === "ok"
              ? "bg-emerald-500/20 text-emerald-300"
              : runState === "error"
              ? "bg-red-500/20 text-red-300"
              : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:opacity-90",
          ].join(" ")}
          aria-label={`Run ${name} now`}
        >
          {runState === "pending" && <Loader2 className="h-3 w-3 animate-spin" />}
          {runState === "ok" && <Check className="h-3 w-3" />}
          {runState === "error" && <X className="h-3 w-3" />}
          {runState === "idle" && <Play className="h-3 w-3" />}
          {runState === "ok" ? "Queued" : runState === "error" ? "Failed" : runState === "pending" ? "Sending…" : "Run Now"}
        </button>
      </header>

      <p className="mt-3 text-sm text-[#94a3b8]">{description}</p>

      {(lastRunISO !== undefined || lastScore !== undefined || cron) && (
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[rgba(255,255,255,0.05)] pt-3 text-[11px]">
          <div>
            <dt className="uppercase tracking-wider text-[#64748b]">Last run</dt>
            <dd className="mt-0.5 text-[#cbd5e1]">
              {lastRunISO ? timeAgo(lastRunISO) : "—"}
              {typeof lastScore === "number" && (
                <span className="ml-1 text-[#a5b4fc]">· {lastScore}/100</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-[#64748b]">Schedule</dt>
            <dd className="mt-0.5 text-[#cbd5e1]">{cron ?? "Manual only"}</dd>
          </div>
        </dl>
      )}

      {runState === "error" && errorMsg && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          {errorMsg}
        </p>
      )}
      {runState === "ok" && (
        <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
          Trigger sent to VPS. Agent is running — check Airtable in a few minutes for results.
        </p>
      )}
    </article>
  );
}
