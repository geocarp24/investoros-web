/**
 * Tenant dashboard — dynamic route.
 *
 * URL: /[tenant] (e.g. /geo-carpentry, /pinnacle, /<external-customer-slug>)
 *
 * Authorization:
 *  - Clerk middleware ensures the user is authenticated
 *  - This component validates that params.tenant === user.publicMetadata.tenantId
 *  - Tenant must exist in the DB
 *
 * Data:
 *  - For now, Geo Carpentry has typed fetchers (getGeoLeads, etc.) that hardcode the
 *    Geo Airtable base. Other tenants get a "Coming soon" state until their schema
 *    is wired. New tenants are provisioned via the onboarding wizard (Fase D).
 *
 * Replaces the old /geo route (which now redirects here).
 */
import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import {
  getGeoLeads,
  getGeoContacts,
  getRecentSEOAudits,
  getRecentMarketingAudits,
  getContentQueue,
  getSubcontractors,
} from "@/lib/airtable";
import { db } from "@/server/db";
import { KPICard } from "@/components/dashboard/KPICard";
import { PipelineList } from "@/components/dashboard/PipelineList";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import { SEOPanel } from "@/components/dashboard/SEOPanel";
import { AgentStatusBar, type AgentStatus } from "@/components/dashboard/AgentStatusBar";
import { ContentQueue } from "@/components/dashboard/ContentQueue";
import { SubcontractorsPreview } from "@/components/dashboard/SubcontractorsPreview";

function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function deriveAgentStatus(
  slug: string,
  name: string,
  emoji: string,
  lastRun: { status?: string; started_at?: string; overall_score?: number; score?: number } | null
): AgentStatus {
  if (!lastRun) return { slug, name, emoji, status: "idle", label: "No runs yet" };
  const score = lastRun.overall_score ?? lastRun.score;
  const when = timeAgo(lastRun.started_at);
  if (lastRun.status === "Running") return { slug, name, emoji, status: "running", label: "Running now" };
  if (lastRun.status === "Failed") return { slug, name, emoji, status: "error", label: `Failed ${when}` };
  if (typeof score === "number") return { slug, name, emoji, status: "on", label: `${score}/100 · ${when}` };
  return { slug, name, emoji, status: "idle", label: `Last ${when}` };
}

export const metadata = { title: "Tenant Dashboard" };
export const revalidate = 60;

async function loadGeoData(tenantSlug: string) {
  const [leadsRes, contactsRes, auditsRes, marketingRes, queueRes, subsRes] = await Promise.all([
    getGeoLeads({ maxRecords: 100, tenantSlug }),
    getGeoContacts({ maxRecords: 100, tenantSlug }),
    getRecentSEOAudits(10, tenantSlug),
    getRecentMarketingAudits(10, tenantSlug).catch(() => ({ records: [] })),
    getContentQueue({ maxRecords: 20, tenantSlug }),
    getSubcontractors({ maxRecords: 8, tenantSlug }),
  ]);

  const leads = (leadsRes.records ?? []).map((r) => ({ id: r.id, createdTime: r.createdTime, ...r.fields }));
  const audits = (auditsRes.records ?? []).map((r) => ({ id: r.id, createdTime: r.createdTime, ...r.fields }));
  const marketingAudits = (marketingRes.records ?? []).map((r) => ({ id: r.id, ...r.fields }));
  const queue = (queueRes.records ?? []).map((r) => ({ id: r.id, ...r.fields }));
  const subs = (subsRes.records ?? []).map((r) => ({ id: r.id, ...r.fields }));

  const latestSEO = audits[0];
  const latestMarketing = marketingAudits[0];
  const agentStatuses: AgentStatus[] = [
    { slug: "rastreador", name: "Rastreador", emoji: "🔍", status: "idle", label: "Not yet active" },
    { slug: "clasificador", name: "Clasificador", emoji: "🎯", status: "idle", label: "Not yet active" },
    deriveAgentStatus("posicionador", "Posicionador", "📊", latestSEO ?? null),
    {
      slug: "escriba",
      name: "Escriba",
      emoji: "✍️",
      status: queue.length > 0 ? "on" : "idle",
      label: queue.length > 0 ? `${queue.length} in queue` : "Idle",
    },
    { slug: "social_media", name: "Social Media", emoji: "📱", status: "idle", label: "Not yet active" },
    deriveAgentStatus("mercader", "Mercader", "📢", latestMarketing ?? null),
  ];

  const hotLeads = leads.filter((l) => l["Urgency"] === "hot");
  const warmLeads = leads.filter((l) => l["Urgency"] === "warm");
  const stageMap = new Map<string, number>();
  leads.forEach((l) => {
    const s = l["Lead Status"] ?? "New";
    stageMap.set(s, (stageMap.get(s) ?? 0) + 1);
  });

  const latestScore = audits[0]?.overall_score;
  const prevScore = audits[1]?.overall_score;
  const scoreDelta =
    typeof latestScore === "number" && typeof prevScore === "number" ? latestScore - prevScore : null;

  return {
    leads,
    audits,
    queue,
    subs,
    hotLeads,
    warmLeads,
    agentStatuses,
    pipelineCounts: Array.from(stageMap.entries()).map(([stage, count]) => ({ stage, count })),
    kpis: {
      hot: hotLeads.length,
      pipeline: leads.length,
      seoScore: latestScore ?? null,
      scoreDelta,
      contacts: contactsRes.records?.length ?? 0,
      queueActive: queue.filter((q) => ["draft", "ready_to_publish", "Drafting", "Review", "Planned"].includes(q.status ?? "")).length,
    },
  };
}

export default async function TenantDashboard({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;

  // ── Auth ──
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userTenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;

  if (!userTenantId) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f7f5] p-8">
        <div className="max-w-md text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#FF6B00]">
            Pending assignment
          </p>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Welcome to InvestorOS</h1>
          <p className="text-sm text-[#64748b]">
            Tu cuenta fue creada pero todavía no tiene un tenant asignado. El admin va a asignarte
            acceso en los próximos minutos.
          </p>
          <p className="text-xs text-[#94a3b8]">
            Logged in as <strong>{user.emailAddresses[0]?.emailAddress}</strong>
          </p>
        </div>
      </main>
    );
  }

  if (userTenantId !== tenantSlug) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">
            Access denied
          </p>
          <h1 className="text-2xl font-bold text-white">Esta no es tu organización</h1>
          <p className="text-sm text-[#94a3b8]">
            Estás asignado a <code className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[#a5b4fc]">{userTenantId}</code>.
            La página solicitada es para <code className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[#a5b4fc]">{tenantSlug}</code>.
          </p>
          <a
            href={`/${userTenantId}`}
            className="inline-block text-sm font-medium text-[#a5b4fc] underline underline-offset-2 hover:text-white"
          >
            Ir a tu dashboard →
          </a>
        </div>
      </div>
    );
  }

  // ── Tenant lookup (with graceful fallback if DB row missing or unreachable) ──
  // We fall back to a hardcoded display for the well-known bootstrap tenants
  // (geo-carpentry, pinnacle) whenever the DB lookup returns null or throws.
  // This covers both pre-seed (tables exist, no rows) and DB-unreachable cases.
  let tenant: { slug: string; name: string; status: string } | null = null;
  try {
    tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { slug: true, name: true, status: true },
    });
  } catch (err) {
    console.warn(
      `[dashboard] tenant lookup failed for ${tenantSlug}, using hardcoded fallback:`,
      err instanceof Error ? err.message : err
    );
  }

  if (!tenant) {
    if (tenantSlug === "geo-carpentry") {
      tenant = { slug: "geo-carpentry", name: "Geo Carpentry LLC", status: "ACTIVE" };
    } else if (tenantSlug === "pinnacle") {
      tenant = { slug: "pinnacle", name: "Pinnacle Holdings Group", status: "ACTIVE" };
    }
  }

  if (!tenant) notFound();

  // ── Load tenant data ──
  // For now, only Geo Carpentry has a fully wired Airtable schema. Other tenants
  // see a "Coming soon" state until their data layer is provisioned.
  if (tenantSlug !== "geo-carpentry") {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">
            Tenant Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">{tenant.name}</h1>
        </header>
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-8 text-center">
          <p className="text-sm text-[#94a3b8]">
            Tu workspace está siendo configurado. Completá el wizard de onboarding para activar
            las integraciones (Airtable, Telnyx, GBP, social).
          </p>
          <a
            href="/onboard/step-1"
            className="mt-3 inline-block text-sm font-medium text-[#a5b4fc] underline underline-offset-2 hover:text-white"
          >
            Continuar onboarding →
          </a>
        </div>
      </div>
    );
  }

  // ── Geo Carpentry dashboard ──
  const data = await loadGeoData(tenantSlug).catch((err) => {
    console.error("[geo dashboard] fetch failed:", err);
    return null;
  });

  if (!data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
        Could not load Airtable data. Verify the Airtable credential in{" "}
        <code className="rounded bg-red-500/20 px-1.5 py-0.5">/settings/connections</code>{" "}
        or set <code className="rounded bg-red-500/20 px-1.5 py-0.5">AIRTABLE_TOKEN_GEO</code> in env vars.
      </div>
    );
  }

  const { leads, audits, queue, subs, warmLeads, pipelineCounts, kpis, agentStatuses } = data;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">
            Overview
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">{tenant.name}</h1>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Built to Last. Crafted with Pride. · Northeast Wisconsin
          </p>
        </div>
        <a
          href="https://geocarpentry.com"
          target="_blank"
          rel="noopener"
          className="text-xs font-medium text-[#a5b4fc] underline underline-offset-2 hover:text-white"
        >
          geocarpentry.com ↗
        </a>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="🔴 HOT Leads"
          value={kpis.hot}
          hint={kpis.hot > 0 ? "action required now" : "no hot leads"}
          accent={kpis.hot > 0}
        />
        <KPICard
          label="Pipeline Active"
          value={kpis.pipeline}
          hint={kpis.pipeline > 0 ? `${kpis.hot} hot · ${warmLeads.length} warm` : "awaiting first lead"}
        />
        <KPICard
          label="SEO Score"
          value={kpis.seoScore ?? "—"}
          hint={`${audits.length} audits logged`}
          trend={kpis.scoreDelta === null ? undefined : kpis.scoreDelta >= 0 ? "up" : "down"}
          trendLabel={kpis.scoreDelta !== null ? `${Math.abs(kpis.scoreDelta)} pts` : undefined}
        />
        <KPICard
          label="Content Queue"
          value={kpis.queueActive}
          hint={kpis.queueActive > 0 ? `${queue.filter(q => q.status === "ready_to_publish").length} ready · ${queue.filter(q => q.status === "draft").length} drafts` : "queue empty"}
        />
      </section>

      <AgentStatusBar agents={agentStatuses} tenant={tenantSlug} />

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <RecentLeads leads={leads} />
          <PipelineList counts={pipelineCounts} />
        </div>
        <div className="space-y-4">
          <SEOPanel audits={audits} />
          <ContentQueue items={queue} />
          <SubcontractorsPreview subs={subs} />
        </div>
      </section>

      <footer className="space-y-1 pt-2 text-center text-xs text-[#64748b]">
        <p>AgentOS · {tenant.name} · Refreshes every 60s</p>
        <p>
          <a href="/privacy" className="hover:text-white hover:underline underline-offset-2">
            Privacy
          </a>{" "}
          ·{" "}
          <a href="/terms" className="hover:text-white hover:underline underline-offset-2">
            Terms
          </a>
        </p>
      </footer>
    </div>
  );
}
