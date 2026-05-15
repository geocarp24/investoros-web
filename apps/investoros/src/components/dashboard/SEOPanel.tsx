/**
 * SEOPanel — latest Posicionador audit summary + trend.
 */
import type { GeoSEOAudit } from "@/lib/airtable";

interface Audit extends GeoSEOAudit {
  id: string;
  createdTime: string;
}

function scoreColor(score: number | undefined): string {
  if (score === undefined || score === null) return "var(--color-muted-foreground)";
  if (score >= 85) return "oklch(0.65 0.15 145)"; // green
  if (score >= 70) return "oklch(0.72 0.12 60)"; // amber
  if (score >= 50) return "oklch(0.65 0.15 35)"; // orange
  return "oklch(0.55 0.15 25)"; // red
}

function shortIssue(text: string | undefined, maxLen = 110): string {
  if (!text) return "";
  const firstLine = text.split("\n").find((l) => l.trim()) ?? text;
  const cleaned = firstLine.replace(/^[-•*\d.\s]+/, "").trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "…" : cleaned;
}

export function SEOPanel({ audits }: { audits: Audit[] }) {
  const latest = audits[0];
  const previous = audits[1];

  const score = latest?.overall_score;
  const prevScore = previous?.overall_score;
  const delta =
    typeof score === "number" && typeof prevScore === "number" ? score - prevScore : null;

  const issues =
    latest?.top_issues?.split(/\n+/).filter((l) => l.trim()).slice(0, 3) ?? [];
  const wins =
    latest?.top_wins?.split(/\n+/).filter((l) => l.trim()).slice(0, 3) ?? [];
  const recs =
    latest?.recommendations?.split(/\n+/).filter((l) => l.trim()).slice(0, 3) ?? [];

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold">SEO Health</h3>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            From El Posicionador · {audits.length} audits on record
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-3xl font-semibold tabular-nums leading-none"
            style={{ color: scoreColor(score) }}
          >
            {score ?? "—"}
            <span className="text-base text-[var(--color-muted-foreground)] font-normal">
              /100
            </span>
          </p>
          {delta !== null && (
            <p className="mt-1 text-xs">
              <span className={delta >= 0 ? "text-emerald-700" : "text-red-700"}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} pts
              </span>
              <span className="text-[var(--color-muted-foreground)]"> vs prev</span>
            </p>
          )}
        </div>
      </div>

      {!latest && (
        <p className="text-sm text-[var(--color-muted-foreground)] italic">
          No audits yet. Run El Posicionador to generate a baseline.
        </p>
      )}

      {latest && (
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          {issues.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-red-700 mb-2 font-semibold">
                Top Issues
              </p>
              <ul className="space-y-1.5">
                {issues.map((i, idx) => (
                  <li key={idx} className="leading-snug pl-2 border-l-2 border-red-200">
                    {shortIssue(i)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {wins.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-700 mb-2 font-semibold">
                Top Wins
              </p>
              <ul className="space-y-1.5">
                {wins.map((w, idx) => (
                  <li key={idx} className="leading-snug pl-2 border-l-2 border-emerald-200">
                    {shortIssue(w)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {recs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <p className="text-xs uppercase tracking-wider text-[var(--color-accent)] mb-2 font-semibold">
            Priority Recommendations
          </p>
          <ol className="space-y-1.5 text-sm list-decimal list-inside marker:text-[var(--color-muted-foreground)]">
            {recs.map((r, idx) => (
              <li key={idx} className="leading-snug">
                {shortIssue(r, 160)}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
