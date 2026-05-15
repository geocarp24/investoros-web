/**
 * PipelineList — leads grouped by Stage (Airtable singleSelect options).
 */
interface StageCount {
  stage: string;
  count: number;
}

const STAGE_ORDER = ["New", "Quote Requested", "Quote Sent", "Negotiating", "Won", "Lost", "Ghost"];

const STAGE_COLORS: Record<string, string> = {
  New: "oklch(0.85 0.05 80)",            // warm cream
  "Quote Requested": "oklch(0.82 0.08 60)",
  "Quote Sent": "oklch(0.75 0.10 50)",   // orange-ish
  Negotiating: "oklch(0.72 0.12 40)",
  Won: "oklch(0.65 0.15 145)",            // green
  Lost: "oklch(0.65 0.08 25)",            // muted red
  Ghost: "oklch(0.80 0.02 270)",          // gray
};

export function PipelineList({ counts }: { counts: StageCount[] }) {
  // Order known stages first, then any unknown ones
  const map = new Map(counts.map((c) => [c.stage, c.count]));
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  const ordered: StageCount[] = [
    ...STAGE_ORDER.filter((s) => map.has(s)).map((s) => ({ stage: s, count: map.get(s) ?? 0 })),
    ...counts.filter((c) => !STAGE_ORDER.includes(c.stage)),
  ];

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="text-base font-semibold mb-1">Lead Pipeline</h3>
      <p className="text-xs text-[var(--color-muted-foreground)] mb-4">
        {total} total · grouped by stage
      </p>
      <div className="space-y-2.5">
        {ordered.length === 0 && (
          <p className="text-sm text-[var(--color-muted-foreground)] italic">
            No leads yet. They'll appear here when the contact form is submitted.
          </p>
        )}
        {ordered.map(({ stage, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={stage} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{stage}</span>
                <span className="tabular-nums text-[var(--color-muted-foreground)]">
                  {count} <span className="text-xs">({pct}%)</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: STAGE_COLORS[stage] ?? "var(--color-accent)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
