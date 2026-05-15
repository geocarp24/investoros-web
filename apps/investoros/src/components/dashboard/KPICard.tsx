/**
 * KPICard — single metric tile for tenant dashboards.
 * Designed mobile-first, uses InvestorOS warm-editorial design tokens.
 */
import type { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: boolean;
}

export function KPICard({
  label,
  value,
  hint,
  trend,
  trendLabel,
  accent = false,
}: KPICardProps) {
  return (
    <article
      className={`rounded-lg border p-5 transition-colors ${
        accent
          ? "border-[var(--color-accent)] bg-[color-mix(in_oklch,var(--color-accent)_6%,var(--color-card))]"
          : "border-[var(--color-border)] bg-[var(--color-card)]"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {(hint || trendLabel) && (
        <div className="mt-1 flex items-baseline gap-2 text-xs">
          {trend && (
            <span
              className={`font-medium ${
                trend === "up"
                  ? "text-emerald-700"
                  : trend === "down"
                  ? "text-red-700"
                  : "text-[var(--color-muted-foreground)]"
              }`}
            >
              {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"} {trendLabel}
            </span>
          )}
          {hint && (
            <span className="text-[var(--color-muted-foreground)]">{hint}</span>
          )}
        </div>
      )}
    </article>
  );
}
