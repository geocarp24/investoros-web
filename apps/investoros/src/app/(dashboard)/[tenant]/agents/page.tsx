/**
 * /[tenant]/agents — InvestorOS organizational chart.
 *
 * The 27 agents organized like a real company: 8 departments, each with a
 * clear purpose and roster. Within each department the analysts (who detect
 * issues) lead, followed by executors (who act), validators (who gate),
 * and any specialists.
 *
 * Run Now appears only for agents that are actively wired for this tenant.
 *
 * Renders three sections after the departments:
 *   1. Cross-department flow — how outputs of one team feed another
 *   2. Distribution channels — who publishes where
 *   3. Execution loop — which executor fixes each kind of audit finding
 */
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getRecentSEOAudits, getRecentMarketingAudits } from "@/lib/airtable";
import { AgentRunCard } from "@/components/dashboard/AgentRunCard";

export const metadata = { title: "Agents" };
export const revalidate = 60;

type AgentStatus = "active" | "available" | "planned";

type AgentDef = {
  slug: string;
  name: string;
  role: string;
  emoji: string;
  description: string;
  defaultMode: string;
  status: AgentStatus;
  cron?: string;
};

type Department = {
  slug: string;
  name: string;
  emoji: string;
  purpose: string;
  accent: string; // tailwind colorway
  members: AgentDef[];
};

const DEPARTMENTS: Department[] = [
  {
    slug: "seo",
    name: "SEO",
    emoji: "🔍",
    purpose: "Get your site found when prospects search Google.",
    accent: "emerald",
    members: [
      { slug: "posicionador", name: "Rex", role: "SEO Monitor", emoji: "📊",
        description: "Audits geocarpentry.com every 3 days: schema, robots, sitemap, Core Web Vitals, ranking drift across 17 cities.",
        defaultMode: "seo_health", status: "active",
        cron: "seo_health every 3d · seo_deep Mondays" },
      { slug: "escriba", name: "Eli", role: "Content Writer", emoji: "✍️",
        description: "Writes SEO-optimized blog posts + city × service pages. Publishes 2× per week to WordPress.",
        defaultMode: "weekly_draft", status: "available" },
      { slug: "cartografo", name: "Carto", role: "Territory Map", emoji: "🗺️",
        description: "Tracks your rank in Google Maps Pack across 17 cities × 6 services (102 geo combos).",
        defaultMode: "scan", status: "planned" },
    ],
  },
  {
    slug: "content",
    name: "Content & Editorial",
    emoji: "✍️",
    purpose: "Write, rewrite, and quality-gate every outbound piece of text.",
    accent: "sky",
    members: [
      { slug: "reescritor", name: "Nina", role: "Content Optimizer", emoji: "✂️",
        description: "Rewrites underperforming pages and posts based on intent + persona signals.",
        defaultMode: "rewrite", status: "available" },
      { slug: "oraculo", name: "Max", role: "Quality Gate", emoji: "🛡️",
        description: "Reviews every social post, email, and blog draft before it ships. Blocks low-quality content.",
        defaultMode: "review", status: "available" },
    ],
  },
  {
    slug: "social",
    name: "Social Media",
    emoji: "📱",
    purpose: "Plan, create, and ship Facebook + Instagram content weekly.",
    accent: "pink",
    members: [
      { slug: "social_media", name: "Marco", role: "Social Media Manager", emoji: "📱",
        description: "Plans the weekly calendar for FB + IG. Researches trends, drafts captions, briefs visuals.",
        defaultMode: "generate_ideas", status: "available" },
      { slug: "creativo_runner", name: "Sofia", role: "Visual Creator", emoji: "🎨",
        description: "Renders branded carousel visuals + post images from Marco's briefs. Puppeteer + Cloudinary.",
        defaultMode: "render_batch", status: "available" },
      { slug: "director_v2", name: "Leo", role: "Video Director", emoji: "🎬",
        description: "Produces 8–15s vertical reels with FFmpeg + branded narrative templates.",
        defaultMode: "build_reel", status: "available" },
    ],
  },
  {
    slug: "marketing",
    name: "Marketing & Ads",
    emoji: "📢",
    purpose: "Audit your full funnel and run paid acquisition profitably.",
    accent: "orange",
    members: [
      { slug: "mercader", name: "Echo", role: "Marketing Auditor", emoji: "📢",
        description: "Audits the full funnel: LCP, mobile conversion, form friction, CTA strength, trust signals.",
        defaultMode: "quick_health", status: "active",
        cron: "quick_health every 3d · deep_audit Mondays" },
      { slug: "cazador", name: "Chase", role: "Paid Ads", emoji: "🎯",
        description: "Audits Google + Meta ads, surfaces wasted spend, recommends bid + creative changes.",
        defaultMode: "audit", status: "available" },
      { slug: "auditor", name: "Ava", role: "UX Optimizer", emoji: "🎯",
        description: "Patches conversion + mobile UX issues from Echo's audit. Touches WordPress via the bridge.",
        defaultMode: "patch", status: "available" },
      { slug: "analitico", name: "Sage", role: "Analytics", emoji: "📈",
        description: "Cross-channel engagement reports — Meta Graph + GA4 + Airtable, weekly.",
        defaultMode: "summary", status: "available" },
    ],
  },
  {
    slug: "leadgen",
    name: "Lead Generation",
    emoji: "🎯",
    purpose: "Find new prospects you don't already know about.",
    accent: "amber",
    members: [
      { slug: "rastreador", name: "Scout", role: "Web Scraper", emoji: "🕵️",
        description: "Hunts new leads from FSBO listings, foreclosure dockets, public RFPs, building permits.",
        defaultMode: "scan", status: "available" },
      { slug: "tracy", name: "Tracy", role: "Skip Tracer", emoji: "🔍",
        description: "Enriches scraped contacts with owner phone, email, address via skip-trace APIs.",
        defaultMode: "trace", status: "available" },
      { slug: "embajador", name: "Luca", role: "LinkedIn B2B", emoji: "🤝",
        description: "Drafts cold outreach to realtors, inspectors, partner contractors. Manual send for now.",
        defaultMode: "draft", status: "available" },
      { slug: "foro", name: "Remi", role: "Community", emoji: "💬",
        description: "Watches r/Wisconsin + r/GreenBay + Nextdoor. Drafts helpful replies (manual post).",
        defaultMode: "draft", status: "available" },
    ],
  },
  {
    slug: "crm",
    name: "CRM & Sales",
    emoji: "💼",
    purpose: "Score, respond to, and close every inbound lead.",
    accent: "violet",
    members: [
      { slug: "clasificador", name: "Kai", role: "Lead Scorer", emoji: "🎯",
        description: "Scores every new lead 0–100. Routes to Hot / Warm / Cold. Triggers Fer or Viper.",
        defaultMode: "score_batch", status: "available" },
      { slug: "fer", name: "Fer", role: "AI Receptionist", emoji: "📞",
        description: "Replies to inbound SMS + webform leads within 30s. Bilingual. Books appointments.",
        defaultMode: "respond", status: "available" },
      { slug: "viper", name: "Viper", role: "Sales Closer", emoji: "🤖",
        description: "Picks up Kai's Hot leads. Runs the closing playbook via SMS. Hands off to you at the call stage.",
        defaultMode: "close", status: "planned" },
    ],
  },
  {
    slug: "local",
    name: "Local Presence",
    emoji: "📍",
    purpose: "Win the Google Maps Pack and review velocity.",
    accent: "rose",
    members: [
      { slug: "nova", name: "Nova", role: "GBP Manager", emoji: "📍",
        description: "Posts to Google Business Profile, answers Q&A, requests reviews automatically. Acts via delegated Manager access.",
        defaultMode: "post", status: "planned" },
    ],
  },
  {
    slug: "ops",
    name: "Operations & Reports",
    emoji: "🦉",
    purpose: "Keep the system healthy + summarize everything for you.",
    accent: "slate",
    members: [
      { slug: "supervisor", name: "Orion", role: "Watchdog", emoji: "🦉",
        description: "Monitors cron health, failed runs, vault drift. Pages you on Telegram when anything breaks.",
        defaultMode: "healthcheck", status: "available" },
      { slug: "analista", name: "Atlas", role: "Executive Brief", emoji: "📰",
        description: "Reads every agent's output. Writes a one-page Monday brief for you across all departments.",
        defaultMode: "brief", status: "available" },
      { slug: "zed", name: "Zed", role: "Dev Ops", emoji: "⚙️",
        description: "Patches site code, schema markup, redirects. Closes Rex's technical findings.",
        defaultMode: "patch", status: "planned" },
      { slug: "ember", name: "Ember", role: "Onboarding", emoji: "🌅",
        description: "Walks new tenants through the 5-step setup. Lives at /onboard — this card mirrors that flow.",
        defaultMode: "guide", status: "available" },
      { slug: "ward", name: "Ward", role: "Compliance", emoji: "⚖️",
        description: "Gates SMS for TCPA + A2P 10DLC. Reviews ad copy for licensing claims.",
        defaultMode: "check", status: "planned" },
      { slug: "penny", name: "Penny", role: "Financial Intel", emoji: "💰",
        description: "MRR, churn, CAC, runway — reads Stripe + bank when wired (Sprint B4).",
        defaultMode: "summary", status: "planned" },
      { slug: "flynn", name: "Flynn", role: "Automation Builder", emoji: "🔧",
        description: "Closes the execution loop. Routes analyst findings to the right executor automatically.",
        defaultMode: "orchestrate", status: "planned" },
    ],
  },
];

const ACCENT_STYLES: Record<string, { border: string; bg: string; chipBg: string; chipText: string; dot: string }> = {
  emerald: { border: "border-emerald-500/30", bg: "from-emerald-500/10",  chipBg: "bg-emerald-500/15",  chipText: "text-emerald-300",  dot: "#10b981" },
  sky:     { border: "border-sky-500/30",     bg: "from-sky-500/10",      chipBg: "bg-sky-500/15",      chipText: "text-sky-300",      dot: "#0ea5e9" },
  pink:    { border: "border-pink-500/30",    bg: "from-pink-500/10",     chipBg: "bg-pink-500/15",     chipText: "text-pink-300",     dot: "#ec4899" },
  orange:  { border: "border-orange-500/30",  bg: "from-orange-500/10",   chipBg: "bg-orange-500/15",   chipText: "text-orange-300",   dot: "#f97316" },
  amber:   { border: "border-amber-500/30",   bg: "from-amber-500/10",    chipBg: "bg-amber-500/15",    chipText: "text-amber-300",    dot: "#f59e0b" },
  violet:  { border: "border-violet-500/30",  bg: "from-violet-500/10",   chipBg: "bg-violet-500/15",   chipText: "text-violet-300",   dot: "#8b5cf6" },
  rose:    { border: "border-rose-500/30",    bg: "from-rose-500/10",     chipBg: "bg-rose-500/15",     chipText: "text-rose-300",     dot: "#f43f5e" },
  slate:   { border: "border-slate-500/30",   bg: "from-slate-500/10",    chipBg: "bg-slate-500/15",    chipText: "text-slate-300",    dot: "#64748b" },
};

const STATUS_DOT: Record<AgentStatus, string> = {
  active:    "#22c55e",
  available: "#f59e0b",
  planned:   "#6366f1",
};
const STATUS_LABEL: Record<AgentStatus, string> = {
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

  const allAgents = DEPARTMENTS.flatMap((d) => d.members);
  const counts = {
    total:     allAgents.length,
    active:    allAgents.filter((a) => a.status === "active").length,
    available: allAgents.filter((a) => a.status === "available").length,
    planned:   allAgents.filter((a) => a.status === "planned").length,
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">
            Organization
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">The Team — {counts.total} agents, 8 departments</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#94a3b8]">
            Your AI staff organized like a real company. Each agent reports to one department; cross-team
            flows are mapped at the bottom.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
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

      {/* DEPARTMENTS */}
      {DEPARTMENTS.map((dept) => (
        <DepartmentSection
          key={dept.slug}
          dept={dept}
          tenant={tenantSlug}
          lastSEO={lastSEO}
          lastMkt={lastMkt}
        />
      ))}

      {/* CROSS-DEPT FLOW */}
      <section className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">How they connect</p>
        <h2 className="mt-1 text-base font-semibold text-white">Cross-department flow</h2>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Each output below feeds the next team. Atlas writes the executive brief reading everything.
        </p>
        <div className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
          <FlowRow from="Lead Generation" via="Scout · Tracy · Luca · Remi" to="CRM & Sales (Kai → Fer → Viper)" />
          <FlowRow from="SEO" via="Rex audits → Eli writes → Nina rewrites" to="Marketing (Echo sees the lift)" />
          <FlowRow from="Social Media" via="Marco plans → Sofia + Leo render → Max gates" to="Marketing analytics (Sage)" />
          <FlowRow from="Marketing" via="Echo → Ava patches UX → Chase trims ad waste" to="CRM (better conversion ratio)" />
          <FlowRow from="Local Presence" via="Nova posts + asks for reviews" to="SEO (Rex sees Maps Pack lift)" />
          <FlowRow from="Operations" via="Orion watches everyone · Flynn routes" to="Atlas Monday brief" />
        </div>
      </section>

      {/* DISTRIBUTION CHANNELS */}
      <section className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Publishers</p>
        <h2 className="mt-1 text-base font-semibold text-white">Who publishes where</h2>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Every outbound channel maps to exactly one agent. If you change channels, change the agent's config.
        </p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <ChannelRow channel="WordPress (blog + pages)"        agent="Eli (Escriba)" />
          <ChannelRow channel="Facebook + Instagram"            agent="Marco · Sofia · Leo" />
          <ChannelRow channel="Google Business Profile"          agent="Nova · planned" />
          <ChannelRow channel="LinkedIn outreach"                agent="Luca (Embajador)" />
          <ChannelRow channel="Reddit / Nextdoor"                agent="Remi (Foro)" />
          <ChannelRow channel="SMS (inbound + closing)"          agent="Fer → Viper" />
          <ChannelRow channel="Email (transactional + drips)"    agent="Eli / Atlas via Hostinger SMTP" />
          <ChannelRow channel="Telegram (internal alerts)"       agent="Orion (Watchdog)" />
        </dl>
      </section>

      {/* EXECUTION LOOP */}
      <section className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Execution loop</p>
        <h2 className="mt-1 text-base font-semibold text-white">Who fixes what Rex and Echo find?</h2>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Analysts detect; executors act. Each kind of finding routes to a specific fixer.
        </p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <ExecRow finding="Missing pages / thin content"     exec="Eli (Escriba)" />
          <ExecRow finding="Schema or technical SEO"          exec="Zed (Dev Ops) · planned" />
          <ExecRow finding="Internal linking / on-page edits" exec="Nina (Optimizer)" />
          <ExecRow finding="GBP posts, Q&A, reviews"          exec="Nova · planned" />
          <ExecRow finding="LCP / mobile / conversion friction" exec="Ava (UX Optimizer)" />
          <ExecRow finding="Paid-ad waste"                    exec="Chase" />
          <ExecRow finding="Inbound lead response"            exec="Fer → Viper" />
          <ExecRow finding="Compliance flag"                  exec="Ward · planned" />
        </dl>
        <p className="mt-4 text-[11px] text-[#64748b]">
          Today this routing is manual — you read the audit and trigger the right fixer. Flynn (planned)
          turns it into a closed loop: analyst finding → auto-create task → assign executor → Atlas reports.
        </p>
      </section>
    </div>
  );
}

function DepartmentSection({
  dept, tenant, lastSEO, lastMkt,
}: {
  dept: Department;
  tenant: string;
  lastSEO?: { overall_score?: number; started_at?: string };
  lastMkt?: { score?: number; started_at?: string };
}) {
  const style = ACCENT_STYLES[dept.accent];
  const activeCount = dept.members.filter((m) => m.status === "active").length;

  return (
    <section className={`rounded-2xl border ${style.border} bg-gradient-to-br ${style.bg} via-transparent to-transparent p-6`}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.04)] text-2xl">
            {dept.emoji}
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">{dept.name}</h2>
            <p className="mt-0.5 text-xs text-[#94a3b8]">{dept.purpose}</p>
          </div>
        </div>
        <span className={`rounded-md ${style.chipBg} ${style.chipText} px-2.5 py-1 text-[11px] font-medium`}>
          {dept.members.length} member{dept.members.length === 1 ? "" : "s"} · {activeCount} active
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dept.members.map((agent) => {
          let lastRunISO: string | undefined;
          let lastScore: number | undefined;
          if (agent.slug === "posicionador" && lastSEO) {
            lastScore = lastSEO.overall_score;
            lastRunISO = lastSEO.started_at;
          } else if (agent.slug === "mercader" && lastMkt) {
            lastScore = lastMkt.score;
            lastRunISO = lastMkt.started_at;
          }
          return (
            <AgentCard
              key={agent.slug}
              agent={agent}
              tenant={tenant}
              lastRunISO={lastRunISO}
              lastScore={lastScore}
            />
          );
        })}
      </div>
    </section>
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
        "flex flex-col rounded-xl border p-4",
        isActive
          ? "border-emerald-500/30 bg-emerald-500/[0.04]"
          : "border-[rgba(255,255,255,0.07)] bg-[#0d0d14]",
      ].join(" ")}
    >
      <header className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[rgba(255,255,255,0.04)] text-lg">
          {agent.emoji}
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">
            {agent.name} <span className="font-normal text-[#94a3b8]">· {agent.role}</span>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#64748b]">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: STATUS_DOT[agent.status] }} />
            {STATUS_LABEL[agent.status]}
          </p>
        </div>
      </header>

      <p className="mt-3 flex-1 text-xs leading-relaxed text-[#94a3b8]">{agent.description}</p>

      {agent.cron && (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-[#64748b]">
          Schedule: <span className="normal-case text-[#cbd5e1]">{agent.cron}</span>
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

function FlowRow({ from, via, to }: { from: string; via: string; to: string }) {
  return (
    <div className="rounded-md border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#64748b]">{from}</p>
      <p className="mt-1 text-[#cbd5e1]">{via}</p>
      <p className="mt-1 text-[11px] text-[#a5b4fc]">→ {to}</p>
    </div>
  );
}

function ChannelRow({ channel, agent }: { channel: string; agent: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[rgba(255,255,255,0.04)] pb-2 last:border-0">
      <dt className="text-[#cbd5e1]">{channel}</dt>
      <dd className="text-[11px] text-[#a5b4fc]">{agent}</dd>
    </div>
  );
}

function ExecRow({ finding, exec }: { finding: string; exec: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[rgba(255,255,255,0.04)] pb-2 last:border-0">
      <dt className="text-[#cbd5e1]">{finding}</dt>
      <dd className="text-[11px] text-[#a5b4fc]">{exec}</dd>
    </div>
  );
}
