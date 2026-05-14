import { Hero } from "@/components/landing/Hero";
import { PricingCards } from "@/components/landing/PricingCards";
import { Features } from "@/components/landing/Features";

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <Hero />
      <Features />
      <PricingCards />
      <footer className="border-t border-[var(--color-border)] py-12 px-6 text-sm text-[var(--color-muted-foreground)]">
        <div className="mx-auto max-w-6xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-semibold text-[var(--color-foreground)]">InvestorOS</span> · The Operating System for Real Estate Investors
          </div>
          <div>© {new Date().getFullYear()} Pinnacle Holdings Group LLC</div>
        </div>
      </footer>
    </main>
  );
}
