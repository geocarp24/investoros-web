/**
 * Geo Carpentry tenant dashboard — production Sprint B5.
 * Server component, reads from Airtable, revalidates every 60s.
 * Route: /geo
 *
 * Layout: KPI row + AgentStatusBar + 2/3 (RecentLeads + Pipeline) + 1/3 (SEO + Content + Subs).
 * Brand colors: navy #1B2A4A, orange #FF6B00, bg #f8f7f5.
 */
import {
  getGeoLeads,
  getGeoContacts,
  getRecentSEOAudits,
  getRecentMarketingAudits,
  getContentQueue,
  getSubcontractors,
} from "@/lib/airtable";
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
  if (lastRun.status === "Running")  return { slug, name, emoji, status: "running", label: "Running now" };
  if (lastRun.status === "Failed")   return { slug, name, emoji, status: "error",   label: `Failed ${when}` };
  if (typeof score === "number")     return { slug, name, emoji, status: "on",      label: `${score}/100 · ${when}` };
  return { slug, name, emoji, status: "idle", label: `Last ${when}` };
}

export const metadata = { title: "Geo Carpentry · Dashboard" };
export const revalidate = 60;

async function loadData() {
  const [leadsRes, contactsRes, auditsRes, marketingRes, queueRes, subsRes] = await Promise.all([
    getGeoLeads({ maxRecords: 100 }),
    getGeoContacts({ maxRecords: 100 }),
    getRecentSEOAudits(10),
    getRecentMarketingAudits(10).catch(() => ({ records: [] })),
    getContentQueue({ maxRecords: 20 }),
    getSubcontractors({ maxRecords: 8 }),
  ]);

  const leads = (leadsRes.records ?? []).map((r) => ({
    id: r.id,
    createdTime: r.createdTime,
    ...r.fields,
  }));
  const audits = (auditsRes.records ?? []).map((r) => ({
    id: r.id,
    createdTime: r.createdTime,
    ...r.fields,
  }));
  const marketingAudits = (marketingRes.records ?? []).map((r) => ({ id: r.id, ...r.fields }));
  const queue = (queueRes.records ?? []).map((r) => ({ id: r.id, ...r.fields }));
  const subs = (subsRes.records ?? []).map((r) => ({ id: r.id, ...r.fields }));

  // Build agent status list from latest runs
  const latestSEO = audits[0];
  const latestMarketing = marketingAudits[0];
  const agentStatuses: AgentStatus[] = [
    { slug: "rastreador",   name: "Rastreador",   emoji: "🔍", status: "idle", label: "Not yet active" },
    { slug: "clasificador", name: "Clasificador", emoji: "🎯", status: "idle", label: "Not yet active" },
    deriveAgentStatus("posicionador", "Posicionador", "📊", latestSEO ?? null),
    { slug: "escriba",      name: "Escriba",      emoji: "✍️", status: queue.length > 0 ? "on" : "idle",
      label: queue.length > 0 ? `${queue.length} in queue` : "Idle" },
    { slug: "social_media", name: "Social Media", emoji: "📱", status: "idle", label: "Not yet active" },
    deriveAgentStatus("mercader", "Mercader", "📢", latestMarketing ?? null),
  ];

  const hotLeads = leads.filter((l) => l["Heat"] === "Hot");
  const warmLeads = leads.filter((l) => l["Heat"] === "Warm");
  const stageMap = new Map<string, number>();
  leads.forEach((l) => {
    const s = l["Stage"] ?? "New";
    stageMap.set(s, (stageMap.get(s) ?? 0) + 1);
  });

  const latestScore = audits[0]?.overall_score;
  const prevScore = audits[1]?.overall_score;
  const scoreDelta =
    typeof latestScore === "number" && typeof prevScore === "number"
      ? latestScore - prevScore
      : null;

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
      queueActive: queue.filter((q) => ["Drafting", "Review"].includes(q.status ?? "")).length,
    },
  };
}

export default async function GeoDashboard() {
  const data = await loadData().catch((err) => {
    console.error("[geo dashboard] fetch failed:", err);
    return null;
  });

  if (!data) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
          Could not load Airtable data. Verify <code>AIRTABLE_TOKEN_GEO</code> in <code>.env.local</code>.
        </p>
      </main>
    );
  }

  const { leads, audits, queue, subs, warmLeads, pipelineCounts, kpis, agentStatuses } = data;

  return (
    <main className="min-h-screen bg-[#f8f7f5] p-6 space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#FF6B00]">
            Tenant Dashboard
          </p>
          <h1 className="text-2xl font-bold text-[#1B2A4A] mt-1">Geo Carpentry LLC</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Built to Last. Crafted with Pride. · Northeast Wisconsin
          </p>
        </div>
        <a
          href="https://geocarpentry.com"
          target="_blank"
          rel="noopener"
          className="text-xs font-medium text-[#FF6B00] underline underline-offset-2"
        >
          geocarpentry.com ↗
        </a>
      </header>

      {/* KPI Row */}
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
          hint={
            kpis.pipeline > 0
              ? `${kpis.hot} hot · ${warmLeads.length} warm`
              : "awaiting first lead"
          }
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
          hint={kpis.queueActive > 0 ? "drafting + review" : "queue empty"}
        />
      </section>

      {/* Agent Status (live from Airtable + clickable Run-now) */}
      <AgentStatusBar agents={agentStatuses} tenant="geo-carpentry" />

      {/* Main grid */}
      <section className="grid lg:grid-cols-3 gap-4">
        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <RecentLeads leads={leads} />
          <PipelineList counts={pipelineCounts} />
        </div>
        {/* Right 1/3 */}
        <div className="space-y-4">
          <SEOPanel audits={audits} />
          <ContentQueue items={queue} />
          <SubcontractorsPreview subs={subs} />
        </div>
      </section>

      <footer className="text-center text-xs text-[#94a3b8] pt-2">
        AgentOS · Geo Carpentry LLC · Refreshes every 60s · base appAQpveuAec077jF
      </footer>
    </main>
  );
}
