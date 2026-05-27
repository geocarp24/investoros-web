/**
 * SEOPanel — latest Posicionador audit summary + trend.
 *
 * Renders markdown-lite (`code` and **bold**) inline so audit reports from
 * the agent (which produce markdown) display cleanly.
 */
import type { GeoSEOAudit } from "@/lib/airtable";

interface Audit extends GeoSEOAudit {
  id: string;
  createdTime: string;
}

function scoreColor(score: number | undefined): string {
  if (score === undefined || score === null) return "var(--color-muted-foreground)";
  if (score >= 85) return "oklch(0.65 0.15 145)";
  if (score >= 70) return "oklch(0.72 0.12 60)";
  if (score >= 50) return "oklch(0.65 0.15 35)";
  return "oklch(0.55 0.15 25)";
}

/**
 * Render `inline code` and **bold** from the agent's markdown output.
 * Strips leading bullets, escapes HTML, then re-injects safe span/code tags.
 * Returns a React fragment array (not a string) for safe injection.
 */
function renderMarkdownLite(text: string, maxLen = 160): React.ReactNode[] {
  if (!text) return [];
  // First non-blank line, strip leading bullets/numbers
  const firstLine = text.split("\n").find((l) => l.trim()) ?? text;
  let cleaned = firstLine.replace(/^[-•*\d.\s]+/, "").trim();
  if (cleaned.length > maxLen) cleaned = cleaned.slice(0, maxLen) + "…";

  // Tokenize on `code` and **bold** in a single pass
  const tokens: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIdx) tokens.push(cleaned.slice(lastIdx, match.index));
    const tok = match[0];
    if (tok.startsWith("`")) {
      tokens.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-[var(--color-muted)] text-[0.85em] font-mono"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      tokens.push(
        <strong key={key++} className="font-semibold">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < cleaned.length) tokens.push(cleaned.slice(lastIdx));
  return tokens;
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
        <div className="min-w-0">
          <h3 className="text-base font-semibold">SEO Health</h3>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            From El Posicionador · {audits.length} audits on record
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p
            className="text-3xl font-semibold tabular-nums leading-none whitespace-nowrap"
            style={{ color: scoreColor(score) }}
          >
            {score ?? "—"}
            <span className="text-base text-[var(--color-muted-foreground)] font-normal">
              /100
            </span>
          </p>
          {delta !== null && (
            <p className="mt-1 text-xs whitespace-nowrap">
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

      {latest && (issues.length > 0 || wins.length > 0) && (
        <div className="space-y-4 text-sm">
          {issues.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-red-700 mb-2 font-semibold">
                Top Issues
              </p>
              <ul className="space-y-2">
                {issues.map((i, idx) => (
                  <li
                    key={idx}
                    className="leading-snug pl-3 border-l-2 border-red-200 text-[var(--color-foreground)]"
                  >
                    {renderMarkdownLite(i, 130)}
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
              <ul className="space-y-2">
                {wins.map((w, idx) => (
                  <li
                    key={idx}
                    className="leading-snug pl-3 border-l-2 border-emerald-200 text-[var(--color-foreground)]"
                  >
                    {renderMarkdownLite(w, 130)}
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
          <ol className="space-y-2 text-sm list-decimal list-inside marker:text-[var(--color-muted-foreground)]">
            {recs.map((r, idx) => (
              <li key={idx} className="leading-snug">
                {renderMarkdownLite(r, 180)}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
