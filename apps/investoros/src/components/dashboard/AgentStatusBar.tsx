/**
 * AgentStatusBar — 6-agent panel at top of Geo dashboard.
 *
 * Statuses currently hardcoded (B5 scaffold). TODO B6:
 * - Read live status from Airtable SEO_Audits / Marketing_Audits
 * - Derive next-run time from cron schedule
 * - Show "running" pulse when an agent is actively executing
 */

const AGENTS = [
  { emoji: "🔍", name: "Rastreador",   status: "on",   label: "Scanning..." },
  { emoji: "🎯", name: "Clasificador", status: "on",   label: "Active" },
  { emoji: "📊", name: "Posicionador", status: "idle", label: "Next: 6am" },
  { emoji: "✍️", name: "Escriba",      status: "on",   label: "Generating" },
  { emoji: "📱", name: "Social Media", status: "idle", label: "Post @ 6pm" },
  { emoji: "📢", name: "Mercader",     status: "idle", label: "Tomorrow" },
] as const;

const statusColors: Record<string, string> = {
  on:   "#059669",
  idle: "#d97706",
  off:  "#94a3b8",
};

export function AgentStatusBar() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {AGENTS.map((a) => (
        <div
          key={a.name}
          className="bg-white border border-[#e5e2db] rounded-lg p-3 text-center cursor-pointer hover:border-[#FF6B00] hover:shadow-sm transition-all"
        >
          <div className="text-xl mb-1">{a.emoji}</div>
          <div className="text-[10px] font-bold text-[#1B2A4A] mb-0.5">{a.name}</div>
          <div className="flex items-center justify-center gap-1">
            <span
              className="w-[5px] h-[5px] rounded-full inline-block flex-shrink-0"
              style={{ background: statusColors[a.status] }}
            />
            <span className="text-[9px]" style={{ color: statusColors[a.status] }}>
              {a.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
