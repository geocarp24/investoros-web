import { PricingCards } from "@/components/landing/PricingCards";

export const metadata = {
  title: "Pricing",
  description:
    "Subscription that pays for itself. Starter $297, Growth $697, Pro $1,497, Enterprise custom. Performance fee only on attributable deals.",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen pt-12">
      <PricingCards />

      <section className="px-6 py-16 border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold">Frequently asked</h2>
          <dl className="mt-8 space-y-6">
            <div>
              <dt className="font-semibold">What's the performance fee?</dt>
              <dd className="mt-1 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                A small percentage (2-5%) charged only on the gross profit of deals our system generated for you.
                Below $10k MRR atribuible, performance fee is 0%. Window: 90 days from first contact.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Money-back guarantee?</dt>
              <dd className="mt-1 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                30 days. If you cancel within 30 days for any reason, full refund of subscription. If we don't
                generate a single attributable deal in your first 60 days, refund — even past day 30.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Setup fee — what's included?</dt>
              <dd className="mt-1 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                $997 one-time covers onboarding, Airtable base provisioning, Quo phone setup, Telegram bot,
                Fer prompt tuning to your tone, and 2 hours of training. Discounted from 1st month if annual.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Annual discount?</dt>
              <dd className="mt-1 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                Pay annually and get 2 months free (16.6% off). Pay 2 years upfront and get 25% off.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Can I export my data?</dt>
              <dd className="mt-1 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                Always. One-click export from your Airtable base. You own your data, period.
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
