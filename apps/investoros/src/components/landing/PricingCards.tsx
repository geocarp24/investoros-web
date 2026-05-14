import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type Tier = {
  id: "starter" | "growth" | "pro" | "enterprise";
  name: string;
  price: number | "Custom";
  blurb: string;
  features: string[];
  highlight?: boolean;
  cta: string;
};

// Pricing approved Jorge 2026-04-22 — see docs/commercialization/01_pricing_model.md
const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 297,
    blurb: "Solo investors, part-time flippers, wholesalers under $10k MRR",
    features: [
      "1 phone number (Fer AI)",
      "50 skip traces/month",
      '"Powered by InvestorOS" badge',
      "Email support 48h",
      "1 user seat",
    ],
    cta: "Start free trial",
  },
  {
    id: "growth",
    name: "Growth",
    price: 697,
    blurb: "Active investors and small teams generating $10-100k MRR",
    features: [
      "2 phone numbers + 5 user seats",
      "200 skip traces, 30 social posts/mo",
      "Deal analysis (Scout + Mat + Fact-Checker)",
      "Email monitor + Calendar sync",
      "99% SLA, priority support 24h",
    ],
    highlight: true,
    cta: "Start free trial",
  },
  {
    id: "pro",
    name: "Pro",
    price: 1497,
    blurb: "Agencies and multi-location operations $100k+ MRR",
    features: [
      "5 numbers + 20 seats + API access",
      "1,000 skip traces, 100 social posts/mo",
      "White-label branding + custom domain",
      "Multi-location, advanced analytics",
      "99.5% SLA, priority 4h support",
    ],
    cta: "Start free trial",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    blurb: "Dedicated infra, custom agents, SSO, audit logs 7yr",
    features: [
      "Unlimited everything",
      "Dedicated CSM + 99.9% SLA",
      "Custom agent prompts",
      "SSO + SAML + SCIM",
      "Multi-region deployment",
    ],
    cta: "Contact sales",
  },
];

export function PricingCards() {
  return (
    <section id="pricing" className="px-6 py-24 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-accent)]">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Subscription that pays for itself
          </h2>
          <p className="mt-4 text-base text-[var(--color-muted-foreground)] leading-relaxed">
            Performance fee only on deals we attribute. Cancel anytime. 30-day money-back if we don't generate
            a single deal in your first 60 days.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-4">
          {TIERS.map((t) => (
            <article
              key={t.id}
              className={[
                "relative flex flex-col rounded-lg border bg-[var(--color-card)] p-6",
                t.highlight
                  ? "border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]"
                  : "border-[var(--color-border)]",
              ].join(" ")}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-foreground)]">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t.blurb}</p>

              <div className="mt-6 flex items-baseline gap-1">
                {typeof t.price === "number" ? (
                  <>
                    <span className="text-4xl font-semibold">
                      {formatCurrency(t.price)}
                    </span>
                    <span className="text-sm text-[var(--color-muted-foreground)]">/mo</span>
                  </>
                ) : (
                  <span className="text-3xl font-semibold">{t.price}</span>
                )}
              </div>

              <ul className="mt-6 space-y-2 text-sm flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={t.highlight ? "accent" : "outline"}
                className="mt-8 w-full"
              >
                {t.cta}
              </Button>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-[var(--color-muted-foreground)]">
          Setup fee $997 one-time · Annual save 16.6% · Performance fee 0/5/4/3/2% on attributable deals
        </p>
      </div>
    </section>
  );
}
