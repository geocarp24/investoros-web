/**
 * /[tenant]/agents — agent control panel.
 *
 * Lists all agents available for the tenant with:
 *  - Status badge (idle / running / error / on)
 *  - Last run timestamp + score (if SEO/marketing audit)
 *  - "Run Now" button → POST /api/agents/[slug]/trigger
 *  - Cron schedule info
 *
 * Server component for the data load; the trigger button is in the
 * AgentRunCard client component so the click handler can manage state.
 */
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getRecentSEOAudits, getRecentMarketingAudits } from "@/lib/airtable";
import { AgentRunCard } from "@/components/dashboard/AgentRunCard";

export const metadata = { title: "Agents" };
export const revalidate = 60;

type AgentDef = {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  cron?: string;
  status: "production" | "code-complete" | "planned";
};

const AGENTS: AgentDef[] = [
  { slug: "posicionador", name: "Posicionador", emoji: "📊", description: "SEO health audits — robots, sitemap, schema, on-page, Core Web Vitals.",
    cron: "Every 3 days · seo_health · Mondays · seo_deep", status: "production" },
  { slug: "mercader",     name: "Mercader",     emoji: "📢", description: "Marketing + UX audit — LCP, conversion friction, mobile-first violations.",
    cron: "Every 3 days · quick_health · Mondays · deep_audit", status: "production" },
  { slug: "escriba",      name: "Escriba",      emoji: "✍️", description: "Bilingual content writer — weekly blog drafts to Airtable Content_Queue.",
    cron: "Pending wiring (Fase B)", status: "code-complete" },
  { slug: "rastreador",   name: "Rastreador",   emoji: "🔍", description: "Web scraper — leads from FSBO, foreclosures, public RFPs.",
    cron: "Pending wiring (Fase B)", status: "code-complete" },
  { slug: "clasificador", name: "Clasificador", emoji: "🎯", description: "Lead scorer 0–100 → Hot/Warm/Cold routing in Airtable Leads.",
    cron: "Pending wiring (Fase B)", status: "code-complete" },
  { slug: "social_media", name: "Social Media", emoji: "📱", description: "Posts + reels ideation for FB/IG. Pairs with Sofia + Leo for visuals.",
    cron: "Pending wiring (Fase B)", status: "code-complete" },
];

export default async function AgentsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  const user = await currentUser();
  if (!user) notFound();

  const userTenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (userTenantId !== tenantSlug) notFound();

  // Last-run lookups (Geo only for now)
  const [seoRes, mktRes] = await Promise.all([
    getRecentSEOAudits(1, tenantSlug).catch(() => ({ records: [] })),
    getRecentMarketingAudits(1, tenantSlug).catch(() => ({ records: [] })),
  ]);
  const lastSEO = seoRes.records?.[0]?.fields as { overall_score?: number; started_at?: string } | undefined;
  const lastMkt = mktRes.records?.[0]?.fields as { score?: number; started_at?: string } | undefined;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Agents</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Agent Control Panel</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Trigger agents on-demand or let them run on schedule. Production agents run automatically via cron on VPS ALEX.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {AGENTS.map((a) => {
          let lastRunLabel: string | undefined;
          let lastScore: number | undefined;
          if (a.slug === "posicionador" && lastSEO) {
            lastScore = lastSEO.overall_score;
            lastRunLabel = lastSEO.started_at;
          } else if (a.slug === "mercader" && lastMkt) {
            lastScore = lastMkt.score;
            lastRunLabel = lastMkt.started_at;
          }
          return (
            <AgentRunCard
              key={a.slug}
              tenant={tenantSlug}
              slug={a.slug}
              name={a.name}
              emoji={a.emoji}
              description={a.description}
              cron={a.cron}
              status={a.status}
              lastRunISO={lastRunLabel}
              lastScore={lastScore}
            />
          );
        })}
      </div>

      <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Pipeline</p>
        <h2 className="mt-1 text-base font-semibold text-white">How agent triggers flow</h2>
        <ol className="mt-3 space-y-2 text-sm text-[#94a3b8] list-decimal pl-5">
          <li>You click <span className="text-white">Run Now</span> here.</li>
          <li>Next.js API route <code className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[#a5b4fc]">/api/agents/[slug]/trigger</code> validates your tenant + signs an HMAC-SHA256 payload.</li>
          <li>Vercel forwards the signed POST to VPS ALEX <code className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[#a5b4fc]">geo-webhook.service:3003/trigger</code>.</li>
          <li>VPS spawns the agent as a detached node process, reads tenant config from the credential vault, and writes results back to your Airtable base.</li>
          <li>This dashboard refreshes the agent status every 60s.</li>
        </ol>
      </div>
    </div>
  );
}
