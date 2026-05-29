/**
 * /[tenant]/agents — full 27-agent control panel.
 *
 * Shows every agent in the InvestorOS platform with its real status for the
 * current tenant. Three buckets:
 *  - active     → wired + production-ready for this tenant
 *  - available  → code exists, needs configuration or cron wiring
 *  - planned    → not yet built
 *
 * Within each bucket agents are grouped by role: analyst, executor,
 * researcher, validator, reporter, meta. This lets Jorge see at a glance
 * which detectors are running and which fixers can act on what they detect.
 */
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getRecentSEOAudits, getRecentMarketingAudits } from "@/lib/airtable";
import { AgentRunCard } from "@/components/dashboard/AgentRunCard";

export const metadata = { title: "Agents" };
export const revalidate = 60;

type AgentRole = "analyst" | "executor" | "researcher" | "validator" | "reporter" | "meta";

type AgentDef = {
  /** API slug used to trigger via /api/agents/[slug]. */
  slug: string;
  /** Customer-facing display name (matches the landing). */
  name: string;
  emoji: string;
  /** One-line description of what the agent does. */
  description: string;
  /** What kind of work it does in the loop. */
  role: AgentRole;
  /** What this agent fixes (for executors) or surfaces (for analysts). */
  scope: string;
  /** Schedule when it runs on its own. */
  cron?: string;
  /** Default --mode flag sent in the trigger payload. */
  defaultMode: string;
  /** Real status for the current tenant. */
  status: "active" | "available" | "planned";
};

const AGENTS: AgentDef[] = [
  // ── ANALYSTS — they detect issues ──
  { slug: "posicionador", name: "Rex (Posicionador)", emoji: "📊", role: "analyst",
    description: "SEO health audits — robots, sitemap, schema, on-page, Core Web Vitals.",
    scope: "Surfaces SEO issues that Eli, Nina, Nova, or Zed then fix.",
    cron: "Every 3 days · seo_health · Mondays · seo_deep",
    defaultMode: "seo_health", status: "active" },
  { slug: "mercader", name: "Echo (Mercader)", emoji: "📢", role: "analyst",
    description: "Marketing + UX audit — LCP, conversion friction, mobile-first violations.",
    scope: "Routes findings to Ava (UX), Chase (ads), or Marco (social).",
    cron: "Every 3 days · quick_health · Mondays · deep_audit",
    defaultMode: "quick_health", status: "active" },
  { slug: "audit_meta", name: "Echo+ (Meta Auditor)", emoji: "📋", role: "analyst",
    description: "Audits Facebook Page health, post engagement, ad account.",
    scope: "Findings feed Marco + Chase.",
    defaultMode: "audit", status: "available" },
  { slug: "analitico", name: "Sage (Analytics)", emoji: "📈", role: "analyst",
    description: "Cross-channel engagement analytics. Reads Meta Graph + Airtable.",
    scope: "Feeds Atlas weekly briefs.",
    defaultMode: "summary", status: "available" },
  { slug: "clasificador", name: "Kai (Lead Scorer)", emoji: "🎯", role: "analyst",
    description: "Scores incoming leads 0–100 → Hot / Warm / Cold routing.",
    scope: "Outputs feed Fer (SMS), Viper (close), and the dashboard pipeline.",
    defaultMode: "score_batch", status: "available" },
  { slug: "cartografo", name: "Carto (Territory Map)", emoji: "🗺️", role: "analyst",
    description: "Geo-grid rank tracker for Maps Pack across service-city combos.",
    scope: "Feeds Nova's GBP playbook.",
    defaultMode: "scan", status: "planned" },
  { slug: "penny", name: "Penny (Financial Intel)", emoji: "💰", role: "analyst",
    description: "Connects to bank + Stripe to surface MRR, churn, CAC, runway.",
    scope: "Feeds Atlas briefs and pricing/discount decisions.",
    defaultMode: "summary", status: "planned" },

  // ── EXECUTORS — they take action ──
  { slug: "fer", name: "Fer (AI Receptionist)", emoji: "📞", role: "executor",
    description: "24/7 bilingual SMS first-response. Books, qualifies, answers FAQ.",
    scope: "Triggers on every new inbound SMS or webform.",
    defaultMode: "respond", status: "available" },
  { slug: "marco", name: "Marco (Social Media)", emoji: "📱", role: "executor",
    description: "Plans, drafts, and publishes Facebook + Instagram content.",
    scope: "Acts on findings from Echo + analytics from Sage.",
    defaultMode: "generate_ideas", status: "available" },
  { slug: "sofia", name: "Sofia (Visual Creator)", emoji: "🎨", role: "executor",
    description: "Generates branded carousel + post visuals from Marco's queue.",
    scope: "Pairs with Marco and Leo.",
    defaultMode: "render_batch", status: "available" },
  { slug: "director_v2", name: "Leo (Video Director)", emoji: "🎬", role: "executor",
    description: "Produces 8-15s vertical reels with FFmpeg + branded narratives.",
    scope: "Output goes to Marco's publish queue.",
    defaultMode: "build_reel", status: "available" },
  { slug: "escriba", name: "Eli (Content Writer)", emoji: "✍️", role: "executor",
    description: "Bilingual SEO blog + page writer. Publishes weekly to WordPress.",
    scope: "Fixes content gaps surfaced by Rex (thin pages, missing pillars).",
    defaultMode: "weekly_draft", status: "available" },
  { slug: "reescritor", name: "Nina (Content Optimizer)", emoji: "✂️", role: "executor",
    description: "Rewrites underperforming posts/pages based on persona + intent.",
    scope: "Closes the loop on Rex's on-page recommendations.",
    defaultMode: "rewrite", status: "available" },
  { slug: "auditor", name: "Ava (UX Optimizer)", emoji: "🎯", role: "executor",
    description: "Patches conversion / mobile-first issues Echo surfaces.",
    scope: "Touches site code via the WP bridge.",
    defaultMode: "patch", status: "available" },
  { slug: "cazador", name: "Chase (Paid Ads)", emoji: "🎯", role: "executor",
    description: "Audits Google + Meta ads, recommends bid + creative changes.",
    scope: "Read-only today; action layer (auto-pause losers) ships later.",
    defaultMode: "audit", status: "available" },
  { slug: "nova", name: "Nova (GBP Manager)", emoji: "📍", role: "executor",
    description: "Posts to Google Business Profile, responds to reviews + Q&A.",
    scope: "Closes Rex's GBP gaps. Acts via delegated Manager access.",
    defaultMode: "post", status: "planned" },
  { slug: "embajador", name: "Luca (LinkedIn B2B)", emoji: "🤝", role: "executor",
    description: "Outreach drafts for realtor / inspector / partner network.",
    scope: "Drafts only today — send is manual until LinkedIn API approval.",
    defaultMode: "draft", status: "available" },
  { slug: "foro", name: "Remi (Community Manager)", emoji: "💬", role: "executor",
    description: "Watches r/HomeImprovement + Nextdoor, drafts helpful replies.",
    scope: "Drafts only — manual post for now to stay in karma rules.",
    defaultMode: "draft", status: "available" },
  { slug: "viper", name: "Viper (Sales Closer)", emoji: "🤖", role: "executor",
    description: "Picks up Hot leads from Kai, runs the closing playbook via SMS.",
    scope: "Triggers on Kai's score ≥ 75. Hand-off to Jorge at the call stage.",
    defaultMode: "close", status: "planned" },
  { slug: "ember", name: "Ember (Onboarding)", emoji: "🌅", role: "executor",
    description: "Walks new tenants through the 5-step setup + verifies integrations.",
    scope: "Wired in /onboard route — this card mirrors that flow.",
    defaultMode: "guide", status: "available" },
  { slug: "remitente", name: "Email Sender", emoji: "✉️", role: "executor",
    description: "Sends authenticated emails via Hostinger SMTP for any agent.",
    scope: "Shared utility — Fer, Eli, Viper, etc. all queue through it.",
    defaultMode: "send", status: "available" },

  // ── VALIDATORS — they gate quality ──
  { slug: "oraculo", name: "Max (Quality Gate)", emoji: "🛡️", role: "validator",
    description: "Reviews every social post + outbound draft before publish.",
    scope: "Blocks low-quality content from Marco, Sofia, Leo, Eli, Luca.",
    defaultMode: "review", status: "available" },
  { slug: "ward", name: "Ward (Compliance)", emoji: "⚖️", role: "validator",
    description: "TCPA, A2P 10DLC, contractor licensing — flags risky messaging.",
    scope: "Gates SMS from Fer/Viper, paid ad copy from Chase.",
    defaultMode: "check", status: "planned" },

  // ── RESEARCHERS — they find new info ──
  { slug: "tracy", name: "Tracy (Skip Tracer)", emoji: "🔍", role: "researcher",
    description: "Enriches contact records with owner phone, email, address.",
    scope: "Feeds Fer + Viper with contactable leads.",
    defaultMode: "trace", status: "available" },
  { slug: "rastreador", name: "Scout (Web Scraper)", emoji: "🕵️", role: "researcher",
    description: "Pulls leads from FSBO, foreclosures, public RFPs, permits.",
    scope: "Output flows into the Leads pipeline, scored by Kai.",
    defaultMode: "scan", status: "available" },
  { slug: "espia", name: "Espía (Competitor Intel)", emoji: "👁️", role: "researcher",
    description: "Watches competitor sites, ad libraries, GBP posts.",
    scope: "Feeds Echo + Marco with timely benchmarks.",
    defaultMode: "watch", status: "available" },

  // ── REPORTER ──
  { slug: "analista", name: "Atlas (Executive Brief)", emoji: "📰", role: "reporter",
    description: "Weekly executive summary across all agents' work.",
    scope: "Reads every analyst output + writes a one-page Monday brief.",
    defaultMode: "brief", status: "available" },

  // ── META — agents that watch other agents ──
  { slug: "supervisor", name: "Orion (Watchdog)", emoji: "🦉", role: "meta",
    description: "Monitors cron health, failed runs, vault drift, deploy state.",
    scope: "Pages Jorge on Telegram when any agent or service goes down.",
    defaultMode: "healthcheck", status: "available" },
  { slug: "flynn", name: "Flynn (Automation Builder)", emoji: "🔧", role: "meta",
    description: "Closes the loop — turns analyst findings into executor tasks.",
    scope: "The missing link Jorge keeps asking about. Building next.",
    defaultMode: "orchestrate", status: "planned" },
];

const ROLE_LABEL: Record<AgentRole, string> = {
  analyst:    "Analysts · detect issues",
  executor:   "Executors · take action",
  validator:  "Validators · gate quality",
  researcher: "Researchers · find new info",
  reporter:   "Reporters · summarize for Jorge",
  meta:       "Meta · watch the other agents",
};

const STATUS_DOT: Record<AgentDef["status"], string> = {
  active:    "#22c55e",
  available: "#f59e0b",
  planned:   "#6366f1",
};

const STATUS_LABEL: Record<AgentDef["status"], string> = {
  active:    "Active",
  available: "Code-ready",
  planned:   "Planned",
};

export default async function AgentsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  const user = await currentUser();
  if (!user) notFound();
  const userTenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (userTenantId !== tenantSlug) notFound();

  const [seoRes, mktRes] = await Promise.all([
    getRecentSEOAudits(1, tenantSlug).catch(() => ({ records: [] })),
    getRecentMarketingAudits(1, tenantSlug).catch(() => ({ records: [] })),
  ]);
  const lastSEO = seoRes.records?.[0]?.fields as { overall_score?: number; started_at?: string } | undefined;
  const lastMkt = mktRes.records?.[0]?.fields as { score?: number; started_at?: string } | undefined;

  const counts = {
    active:    AGENTS.filter((a) => a.status === "active").length,
    available: AGENTS.filter((a) => a.status === "available").length,
    planned:   AGENTS.filter((a) => a.status === "planned").length,
  };

  // Group by role for display
  const ROLES: AgentRole[] = ["analyst", "executor", "validator", "researcher", "reporter", "meta"];
  const grouped = ROLES.map((role) => ({
    role,
    label: ROLE_LABEL[role],
    items: AGENTS.filter((a) => a.role === role),
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Agents</p>
          <h1 className="mt-1 text-2xl font-bold text-white">The Team — 27 agents</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#94a3b8]">
            Every agent is configured at the platform level and lights up per-tenant as their
            integrations connect. Analysts detect issues; executors act on them.
          </p>
        </div>
        <div className="flex gap-2 text-[11px]">
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
            <span style={{ color: STATUS_DOT.active }}>●</span> {counts.active} active
          </span>
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-300">
            <span style={{ color: STATUS_DOT.available }}>●</span> {counts.available} code-ready
          </span>
          <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-indigo-300">
            <span style={{ color: STATUS_DOT.planned }}>●</span> {counts.planned} planned
          </span>
        </div>
      </header>

      {grouped.map((group) =>
        group.items.length === 0 ? null : (
          <section key={group.role} className="space-y-3">
            <header className="flex items-baseline gap-3 border-b border-[rgba(255,255,255,0.05)] pb-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">
                {group.label}
              </h2>
              <span className="text-[11px] text-[#64748b]">{group.items.length}</span>
            </header>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((a) => {
                let lastRunISO: string | undefined;
                let lastScore: number | undefined;
                if (a.slug === "posicionador" && lastSEO) {
                  lastScore = lastSEO.overall_score;
                  lastRunISO = lastSEO.started_at;
                } else if (a.slug === "mercader" && lastMkt) {
                  lastScore = lastMkt.score;
                  lastRunISO = lastMkt.started_at;
                }
                return (
                  <AgentCard
                    key={a.slug}
                    agent={a}
                    tenant={tenantSlug}
                    lastRunISO={lastRunISO}
                    lastScore={lastScore}
                  />
                );
              })}
            </div>
          </section>
        )
      )}

      <section className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">
          Execution loop
        </p>
        <h2 className="mt-1 text-base font-semibold text-white">
          Who fixes what Rex / Echo find?
        </h2>
        <p className="mt-3 text-sm text-[#94a3b8]">
          Analysts surface issues. Each kind of issue routes to a specific executor:
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Missing pages / thin content" exec="Eli (Escriba)" />
          <Row label="Schema or technical SEO" exec="Zed (Dev Ops) · planned" />
          <Row label="Internal linking / on-page" exec="Nina (Optimizer)" />
          <Row label="GBP posts / Q&A / reviews" exec="Nova · planned" />
          <Row label="LCP / mobile / conversion" exec="Ava (UX Optimizer)" />
          <Row label="Paid ads waste" exec="Chase" />
          <Row label="Lead response" exec="Fer → Viper · planned" />
          <Row label="Compliance flag" exec="Ward · planned" />
        </dl>
        <p className="mt-4 text-[11px] text-[#64748b]">
          Today this routing is manual — you read the audit and trigger the right executor.
          Flynn (planned) closes the loop: he turns analyst findings into executor tasks
          automatically and reports the cycle to Atlas.
        </p>
      </section>
    </div>
  );
}

function Row({ label, exec }: { label: string; exec: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[rgba(255,255,255,0.04)] pb-2 last:border-0">
      <dt className="text-[#cbd5e1]">{label}</dt>
      <dd className="text-[11px] text-[#a5b4fc]">{exec}</dd>
    </div>
  );
}

function AgentCard({
  agent, tenant, lastRunISO, lastScore,
}: {
  agent: AgentDef;
  tenant: string;
  lastRunISO?: string;
  lastScore?: number;
}) {
  const isActive = agent.status === "active";
  return (
    <article
      className={[
        "rounded-xl border p-4 transition-colors",
        isActive
          ? "border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.04)]"
          : "border-[rgba(255,255,255,0.07)] bg-[#111118]",
      ].join(" ")}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[rgba(255,255,255,0.04)] text-lg">
            {agent.emoji}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#64748b]">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: STATUS_DOT[agent.status] }} />
              {STATUS_LABEL[agent.status]}
            </p>
          </div>
        </div>
      </header>

      <p className="mt-3 text-xs text-[#94a3b8]">{agent.description}</p>
      <p className="mt-2 text-[11px] italic text-[#64748b]">{agent.scope}</p>

      {agent.cron && (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-[#64748b]">
          Schedule: <span className="text-[#cbd5e1] normal-case">{agent.cron}</span>
        </p>
      )}

      {isActive && (
        <div className="mt-3 border-t border-[rgba(255,255,255,0.05)] pt-3">
          <AgentRunCard
            tenant={tenant}
            slug={agent.slug}
            name={agent.name}
            emoji={agent.emoji}
            description=""
            status="production"
            defaultMode={agent.defaultMode}
            lastRunISO={lastRunISO}
            lastScore={lastScore}
          />
        </div>
      )}
    </article>
  );
}
