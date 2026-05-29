import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OnboardComplete() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const tenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;

  return (
    <main className="space-y-8">
      <section className="rounded-2xl border border-[rgba(99,102,241,0.3)] bg-gradient-to-br from-[rgba(99,102,241,0.10)] to-[rgba(168,85,247,0.05)] p-8 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(34,197,94,0.15)] text-emerald-300">
          <Check className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-white">You're in.</h1>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Your workspace is provisioned and the production agents (Posicionador, Mercader) are
          already monitoring your site. The remaining agents activate as their integrations connect.
        </p>
        {tenantId ? (
          <a
            href={`/${tenantId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Open my dashboard →
          </a>
        ) : (
          <p className="mt-4 text-xs text-[#94a3b8]">
            Refresh in a moment — we&apos;re still finishing the provisioning.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Agents online", value: "2", hint: "Posicionador, Mercader" },
          { label: "Integrations pending", value: "—", hint: "Configure from Settings" },
          { label: "Next audit", value: "≤3d", hint: "Auto-scheduled" },
        ].map((kpi) => (
          <article key={kpi.label} className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#a5b4fc]">{kpi.label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-[#64748b]">{kpi.hint}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
