const features = [
  {
    title: "AI Receptionist",
    body: "Bilingual SMS + voice that answers leads in 30 seconds, 24/7. Never miss another deal.",
    label: "Fer",
  },
  {
    title: "Skip Tracing",
    body: "Find owner phone + email from any address. 50/200/1,000+ traces per month by tier.",
    label: "Tracy",
  },
  {
    title: "Deal Analysis",
    body: "Scout finds comps, the Mathematician underwrites, the Fact-Checker verifies. Confidence score 1-10.",
    label: "ALEX",
  },
  {
    title: "Social Media Engine",
    body: "Posts, reels, and videos generated and published to FB + IG on schedule. Bilingual variants.",
    label: "El Creativo + Director v2",
  },
  {
    title: "Email + Calendar",
    body: "Inbox monitoring with auto-replies, calendar sync, and 24-touch follow-up sequences.",
    label: "El Secretario",
  },
  {
    title: "Multi-Tenant Ready",
    body: "Built for agencies and teams. White-label, custom domains, role-based access, audit logs.",
    label: "Pro + Enterprise",
  },
];

export function Features() {
  return (
    <section id="features" className="px-6 py-24 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-accent)]">
            What's inside
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Six AI agents, one subscription
          </h2>
          <p className="mt-4 text-base text-[var(--color-muted-foreground)] leading-relaxed">
            Each agent does one job exceptionally. Together they replace four or five separate tools
            most investors stitch together with duct tape and hope.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-colors hover:border-[var(--color-accent)]"
            >
              <p className="text-xs font-mono text-[var(--color-muted-foreground)]">{f.label}</p>
              <h3 className="mt-2 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
