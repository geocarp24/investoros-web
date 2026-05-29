/**
 * /billing — placeholder until Stripe is wired (Sprint B4).
 */
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Billing</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Plan & Billing</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Stripe checkout + invoices ship in Sprint B4. For now you are on the founder rate.
        </p>
      </header>

      <section className="rounded-xl border border-[rgba(99,102,241,0.35)] bg-gradient-to-br from-[rgba(99,102,241,0.10)] to-[rgba(168,85,247,0.06)] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Current plan</p>
        <h2 className="mt-1 text-xl font-bold text-white">Founder Rate · $0/mo</h2>
        <p className="mt-2 text-sm text-[#cbd5e1]">
          You are an internal/founder tenant — billing is disabled until we open external access.
          When Sprint B4 ships, you will be able to upgrade to Starter ($197), Growth ($397), or
          Pro ($997) directly from this page.
        </p>
      </section>

      <section className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-5">
        <h3 className="text-sm font-semibold text-white">What ships in Sprint B4</h3>
        <ul className="mt-3 space-y-2 text-sm text-[#94a3b8] list-disc pl-5">
          <li>Stripe checkout for new tenants from the landing pricing page.</li>
          <li>Stripe webhook → Tenant row auto-provisioned + credential vault initialized.</li>
          <li>Invoices list with PDF download.</li>
          <li>Self-serve upgrade / downgrade / cancel.</li>
          <li>60-day money-back guarantee window tracked here.</li>
        </ul>
      </section>
    </div>
  );
}
