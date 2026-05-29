/**
 * /settings — tenant configuration overview.
 *
 * Read-only summary of the current tenant's identity, integrations, and
 * agent activity. The provisioning UIs (connect Telnyx, Buffer, GBP)
 * live under /settings/connections — that's wired in Fase C when
 * Cowork delivers the provisioning scripts.
 */
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { Mail, Phone, Globe, KeyRound, MessageCircle } from "lucide-react";

export const metadata = { title: "Settings" };

type Integration = {
  service: string;
  label: string;
  icon: typeof KeyRound;
  blurb: string;
  status: "connected" | "pending" | "manual";
};

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userTenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (!userTenantId) {
    return (
      <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-8 text-center text-sm text-[#94a3b8]">
        Your account is pending tenant assignment. Settings unlock once an admin links you to an organization.
      </div>
    );
  }

  // Look up tenant + credentials (without exposing decrypted values)
  let tenantName = userTenantId;
  let credentials: Array<{ service: string; keyName: string; updatedAt: Date }> = [];
  try {
    const tenant = await db.tenant.findUnique({
      where: { slug: userTenantId },
      include: { credentials: { select: { service: true, keyName: true, updatedAt: true } } },
    });
    if (tenant) {
      tenantName = tenant.name;
      credentials = tenant.credentials;
    }
  } catch {
    /* DB unreachable — fall back to slug */
  }

  const credByService = new Map<string, { keyName: string; updatedAt: Date }[]>();
  credentials.forEach((c) => {
    if (!credByService.has(c.service)) credByService.set(c.service, []);
    credByService.get(c.service)!.push({ keyName: c.keyName, updatedAt: c.updatedAt });
  });

  const integrations: Integration[] = [
    { service: "airtable",        label: "Airtable",            icon: KeyRound,
      blurb: "Per-tenant base for leads, content, audits.",
      status: credByService.has("airtable") ? "connected" : "pending" },
    { service: "telnyx",          label: "Telnyx (SMS phone)",  icon: Phone,
      blurb: "Dedicated business number for Fer (AI receptionist).",
      status: credByService.has("telnyx") ? "connected" : "pending" },
    { service: "hostinger_email", label: "Business Email",      icon: Mail,
      blurb: "admin@yourdomain via Hostinger SMTP.",
      status: credByService.has("hostinger_email") ? "connected" : "pending" },
    { service: "google_business", label: "Google Business",     icon: Globe,
      blurb: "Manage GBP listing — posts, Q&A, reviews.",
      status: credByService.has("google_business") ? "connected" : "manual" },
    { service: "social",          label: "Social (FB / IG)",    icon: MessageCircle,
      blurb: "Buffer-mediated publishing for Marco + Sofia.",
      status: credByService.has("social") ? "connected" : "manual" },
    { service: "wordpress",       label: "WordPress",           icon: Globe,
      blurb: "Auto-publish from Escriba via WP bridge.",
      status: credByService.has("wordpress") ? "connected" : "manual" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Settings</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Tenant Settings</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Configuration for <span className="text-white">{tenantName}</span> (<code className="text-[#a5b4fc]">{userTenantId}</code>).
        </p>
      </header>

      <section className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-5">
        <h2 className="text-sm font-semibold text-white">Identity</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[#64748b]">Tenant slug</dt>
            <dd className="mt-0.5 text-white">{userTenantId}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[#64748b]">Display name</dt>
            <dd className="mt-0.5 text-white">{tenantName}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[#64748b]">Signed in as</dt>
            <dd className="mt-0.5 text-white">{user.emailAddresses[0]?.emailAddress}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-[#64748b]">Credentials in vault</dt>
            <dd className="mt-0.5 text-white">{credentials.length}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">Integrations</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {integrations.map((i) => {
            const Icon = i.icon;
            const badge =
              i.status === "connected"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : i.status === "pending"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-slate-500/30 bg-slate-500/10 text-slate-300";
            const label =
              i.status === "connected" ? "Connected" : i.status === "pending" ? "Not connected" : "Manual";
            return (
              <article
                key={i.service}
                className="flex items-start gap-4 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[rgba(255,255,255,0.04)] text-[#a5b4fc]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{i.label}</h3>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${badge}`}>
                      {label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#94a3b8]">{i.blurb}</p>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-[#64748b]">
          Connect / disconnect flows ship in Fase C when Cowork delivers the provisioning scripts.
        </p>
      </section>
    </div>
  );
}
