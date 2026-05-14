import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div className="mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          Built by investors, for investors
        </span>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl text-balance">
          The Operating System
          <span className="block text-[var(--color-accent)]">for Real Estate Investors</span>
        </h1>

        <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-[var(--color-muted-foreground)] text-pretty leading-relaxed">
          Lead capture, CRM, AI receptionist, deal analysis, social media, and skip tracing — bilingual,
          automated, and built for the way investors actually work.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" variant="accent" asChild>
            <a href="#pricing">Start free trial</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#features">See how it works</a>
          </Button>
        </div>

        <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
          14 days free · No credit card · Cancel anytime
        </p>
      </div>
    </section>
  );
}
