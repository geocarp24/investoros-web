/**
 * Dashboard placeholder (Sprint B5 will replace with real tRPC-backed UI).
 *
 * For B1 scaffold this just demonstrates the App Router (dashboard) group
 * works correctly with Tailwind v4 + the design tokens.
 */

const stats = [
  { label: "Active leads", value: "—", hint: "Connect Airtable to populate" },
  { label: "Deals in pipeline", value: "—", hint: "Wire Stripe + onboarding" },
  { label: "MRR atribuible", value: "$0", hint: "First deal closes the loop" },
  { label: "AI conversations", value: "—", hint: "Fer SMS not connected yet" },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-accent)]">
            Dashboard preview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Welcome back to InvestorOS
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Sprint B1 placeholder — Sprint B5 will wire real data from tRPC + Prisma.
          </p>
        </header>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <article
              key={s.label}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5"
            >
              <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                {s.label}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{s.hint}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Sprint B5 builds out the real dashboard: tenant management, lead pipeline, deal kanban,
            social media calendar, and Audit_Tier rankings live from El Analítico.
          </p>
        </section>
      </div>
    </main>
  );
}
