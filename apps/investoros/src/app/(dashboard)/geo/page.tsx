/**
 * Geo Carpentry tenant dashboard — server component, reads directly from Airtable.
 *
 * Routes: /geo
 * Auth: temporary (no Clerk yet) — expose only on internal subdomain or behind basic auth in B5.
 * Data: revalidate every 60s via Next.js fetch cache.
 */
import { Suspense } from "react";
import {
  getGeoLeads,
  getGeoContacts,
  getRecentSEOAudits,
  getContentQueue,
} from "@/lib/airtable";
import { KPICard } from "@/components/dashboard/KPICard";
import { PipelineList } from "@/components/dashboard/PipelineList";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import { SEOPanel } from "@/components/dashboard/SEOPanel";

export const metadata = {
  title: "Geo Carpentry · Tenant Dashboard",
  description: "Operations overview for Geo Carpentry LLC — leads, SEO, content, jobs.",
};

// Force dynamic — we want fresh Airtable data on every request (or via revalidate=60)
export const revalidate = 60;

async function loadDashboardData() {
  // Parallel fetches
  const [leadsRes, contactsRes, auditsRes, queueRes] = await Promise.all([
    getGeoLeads({ maxRecords: 100 }),
    getGeoContacts({ maxRecords: 100 }),
    getRecentSEOAudits(10),
    getContentQueue({ maxRecords: 50 }),
  ]);

  const leads = leadsRes.records.map((r) => ({
    id: r.id,
    createdTime: r.createdTime,
    ...r.fields,
  }));

  const contacts = contactsRes.records;
  const audits = auditsRes.records.map((r) => ({
    id: r.id,
    createdTime: r.createdTime,
    ...r.fields,
  }));
  const queue = queueRes.records;

  // Aggregate pipeline
  const stageMap = new Map<string, number>();
  leads.forEach((l) => {
    const stage = l["Stage"] ?? "(no stage)";
    stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
  });
  const pipelineCounts = Array.from(stageMap.entries()).map(([stage, count]) => ({
    stage,
    count,
  }));

  // KPIs
  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l["Stage"] === "Won").length;
  const newThisWeek = leads.filter((l) => {
    const ts = l["Created date"];
    if (!ts) return false;
    return Date.now() - new Date(ts).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const totalContacts = contacts.length;

  // Content queue summary
  const queueByStatus = new Map<string, number>();
  queue.forEach((r) => {
    const s = (r.fields.status as string) ?? "(unknown)";
    queueByStatus.set(s, (queueByStatus.get(s) ?? 0) + 1);
  });
  const queuedDrafts = (queueByStatus.get("Drafting") ?? 0) + (queueByStatus.get("Review") ?? 0);
  const planned = queueByStatus.get("Planned") ?? 0;
  const published = queueByStatus.get("Published") ?? 0;

  return {
    leads,
    audits,
    queue,
    pipelineCounts,
    kpis: {
      totalLeads,
      wonLeads,
      newThisWeek,
      totalContacts,
      queuedDrafts,
      planned,
      published,
    },
  };
}

export default async function GeoDashboard() {
  const data = await loadDashboardData().catch((err) => {
    console.error("[geo dashboard] fetch failed:", err);
    return null;
  });

  if (!data) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-semibold">Geo Carpentry Dashboard</h1>
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-4">
            Could not load Airtable data. Verify <code>AIRTABLE_TOKEN_GEO</code> is set in
            <code> .env.local</code>.
          </p>
        </div>
      </main>
    );
  }

  const { leads, audits, pipelineCounts, kpis } = data;
  const latestScore = audits[0]?.overall_score;
  const prevScore = audits[1]?.overall_score;
  const scoreDelta =
    typeof latestScore === "number" && typeof prevScore === "number"
      ? latestScore - prevScore
      : null;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-accent)]">
            Tenant Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Geo Carpentry LLC
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Built to Last. Crafted with Pride. · Northeast Wisconsin ·{" "}
            <a
              href="https://geocarpentry.com"
              target="_blank"
              rel="noopener"
              className="underline decoration-[var(--color-accent)] underline-offset-4 hover:text-[var(--color-accent)]"
            >
              geocarpentry.com
            </a>
          </p>
        </header>

        {/* KPI grid */}
        <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
          <KPICard
            label="Total Leads"
            value={kpis.totalLeads}
            hint={`${kpis.newThisWeek} this week`}
          />
          <KPICard
            label="Contacts"
            value={kpis.totalContacts}
            hint="across all sources"
          />
          <KPICard
            label="SEO Score"
            value={latestScore ?? "—"}
            hint={`${audits.length} audits`}
            trend={
              scoreDelta === null ? undefined : scoreDelta >= 0 ? "up" : "down"
            }
            trendLabel={scoreDelta !== null ? `${Math.abs(scoreDelta)} pts` : undefined}
            accent
          />
          <KPICard
            label="Content Queue"
            value={kpis.planned + kpis.queuedDrafts}
            hint={`${kpis.planned} planned · ${kpis.queuedDrafts} drafting · ${kpis.published} live`}
          />
        </section>

        {/* SEO + Pipeline */}
        <section className="grid gap-4 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2">
            <SEOPanel audits={audits} />
          </div>
          <div>
            <PipelineList counts={pipelineCounts} />
          </div>
        </section>

        {/* Recent Leads */}
        <section className="mb-8">
          <RecentLeads leads={leads} />
        </section>

        {/* Footer meta */}
        <footer className="mt-12 pt-6 border-t border-[var(--color-border)] text-xs text-[var(--color-muted-foreground)]">
          <p>
            Data refreshes every 60 seconds · Airtable base{" "}
            <code className="text-xs">appAQpveuAec077jF</code> · Built on InvestorOS multi-tenant
            framework
          </p>
          <p className="mt-1">
            Sprint 2 milestone · 2026-05-15 · auth pending (Clerk in B5)
          </p>
        </footer>
      </div>
    </main>
  );
}
