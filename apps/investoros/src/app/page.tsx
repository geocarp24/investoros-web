/**
 * InvestorOS landing — the public marketing page.
 *
 * Source: investoros-landing-mockup.html (Cowork 2026-05-27).
 * Styles isolated in landing.module.css so the dark mockup palette
 * doesn't bleed into tenant dashboards.
 *
 * Agent portrait PNGs live in /public/agents/.
 */
import Image from "next/image";
import Link from "next/link";
import styles from "./landing.module.css";

export const metadata = {
  title: "InvestorOS — The Business Operating System",
  description:
    "AI agents for lead capture, CRM, deal analysis, social media, and operations — automated, bilingual, and built for businesses that refuse to stay small.",
};

type AgentRow = { status: "live" | "soon" | "planned"; name: string; sub: string };

const LEAD_GEN: AgentRow[] = [
  { status: "live",   name: "Fer",             sub: "SMS AI receptionist · bilingual · 24/7" },
  { status: "live",   name: "Tracy",           sub: "Skip tracer · owner lookup · enrichment" },
  { status: "soon",   name: "El Clasificador", sub: "Lead scoring 0–100 · Hot/Warm/Cold routing" },
  { status: "soon",   name: "El Rastreador",   sub: "Web scraper · foreclosures · probate · FSBO" },
  { status: "soon",   name: "El Cazador",      sub: "Paid ads audit · Google · Meta · TikTok" },
];

const CONTENT_SOCIAL: AgentRow[] = [
  { status: "live", name: "El Social Media Manager", sub: "Content planning · 3 tables · Meta API direct" },
  { status: "live", name: "El Creativo",             sub: "Post/reel visuals · HTML→PNG · Cloudinary CDN" },
  { status: "live", name: "El Director",             sub: "15s reels · FFmpeg · HeyGen avatar · Pexels" },
  { status: "live", name: "El Oráculo",              sub: "Quality gate · brand compliance · anti-waste" },
  { status: "live", name: "El Reescritor",           sub: "AI learning loop · rewrites rejected content" },
  { status: "live", name: "El Analítico",            sub: "FB+IG engagement metrics · performance tiers" },
];

const SEO_VISIBILITY: AgentRow[] = [
  { status: "live", name: "El Posicionador", sub: "7 search engines · geo-grid · CWV · GBP audit" },
  { status: "soon", name: "El Escriba",      sub: "SEO content writer · city pages · bilingual" },
  { status: "soon", name: "El Cartógrafo",   sub: "GBP write-side · posts · reviews · photos" },
  { status: "soon", name: "El Espía",        sub: "Daily competitor watchdog · price + copy diffs" },
  { status: "live", name: "El Mercader",     sub: "UX + conversion audit · LCP · CTAs · mobile" },
];

const INTEL_OPS: AgentRow[] = [
  { status: "soon", name: "El Analista",     sub: "Monday 7am executive brief · 8 agents unified" },
  { status: "soon", name: "El Supervisor",   sub: "System watchdog · self-repair · evolves weekly" },
  { status: "live", name: "El Auditor Meta", sub: "FB+IG account health pull · 30-day baseline" },
  { status: "soon", name: "El Auditor",      sub: "TCPA · CAN-SPAM · Fair Housing · ADA weekly" },
  { status: "live", name: "GitHub Monitor",  sub: "Telegram→GitHub tasks · 24/7 queue on VPS" },
];

const OUTREACH_EMAIL: AgentRow[] = [
  { status: "soon", name: "El Remitente", sub: "Email campaigns · drip sequences · own SMTP" },
  { status: "soon", name: "El Embajador", sub: "LinkedIn B2B · ICP targeting · nurture drip" },
  { status: "soon", name: "El Foro",      sub: "Reddit community · HomeImprovement · r/GreenBay" },
];

const ROADMAP: AgentRow[] = [
  { status: "planned", name: "El Guardián", sub: "KYC/AML · anti-bot · lead validation" },
  { status: "planned", name: "El Corredor", sub: "CRM automation · deal scoring · close probability" },
  { status: "planned", name: "El Contable", sub: "Billing · Stripe metering · tax compliance" },
];

function StatusDot({ status }: { status: AgentRow["status"] }) {
  if (status === "live")    return <span className={styles.ecoStatus} style={{ color: "#22c55e" }}>●</span>;
  if (status === "soon")    return <span className={styles.ecoStatus} style={{ color: "#f59e0b" }}>●</span>;
  return <span className={styles.ecoStatus} style={{ color: "#6366f1" }}>●</span>;
}

function EcoColumn({
  title,
  color,
  icon,
  rows,
  variant,
  note,
}: {
  title: string;
  color: string;
  icon: string;
  rows: AgentRow[];
  variant?: "roadmap";
  note?: string;
}) {
  return (
    <div className={`${styles.ecoCol} ${variant === "roadmap" ? styles.ecoColRoadmap : ""}`}>
      <div className={styles.ecoColTitle} style={{ color }}>
        {icon} {title}
      </div>
      <div className={styles.ecoList}>
        {rows.map((row) => (
          <div key={row.name} className={styles.ecoRow}>
            <StatusDot status={row.status} />
            <div>
              <div className={styles.ecoName}>{row.name}</div>
              <div className={styles.ecoSub}>{row.sub}</div>
            </div>
          </div>
        ))}
      </div>
      {note && <div className={styles.ecoNote}>{note}</div>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.landingRoot}>
      <div className={styles.heroGlow} aria-hidden="true" />

      <div className={styles.content}>
        {/* ── NAV ── */}
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLogo}>
            <span className={styles.navLogoIcon}>IO</span>
            InvestorOS
          </Link>
          <ul className={styles.navLinks}>
            <li><a href="#features">Agents</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#">Docs</a></li>
            <li><a href="#">Blog</a></li>
          </ul>
          <div className={styles.navCta}>
            <a href="#" className={styles.btnGhost}>Sign in</a>
            <a href="#pricing" className={styles.btnPrimary}>Start free trial →</a>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className={styles.hero}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Founder Rate · First 100 businesses only ·{" "}
            <strong style={{ color: "#e879f9" }}>67 spots left</strong>
          </div>

          <h1>
            The Business<br />
            <span className={styles.gradientText}>Operating System</span>
          </h1>

          <p className={styles.heroSub}>
            AI agents for lead capture, CRM, deal analysis, social media, and operations —
            automated, bilingual, and built for businesses that refuse to stay small.
          </p>

          <div className={styles.heroActions}>
            <a href="#pricing" className={styles.btnHero}>Claim Founder Rate — $197/mo →</a>
            <a href="#features" className={styles.btnHeroGhost}>▶ See how it works</a>
          </div>
          <p className={styles.heroTrust}>
            No free trial — because you won&apos;t need one &nbsp;·&nbsp; 60-day money-back guarantee
          </p>
        </section>

        {/* ── STATS ── */}
        <div className={styles.statsWrap}>
          <div className={styles.statsBar}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>30s</span>
              <span className={styles.statLabel}>Avg lead response time</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>27</span>
              <span className={styles.statLabel}>AI agents, one subscription</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>24/7</span>
              <span className={styles.statLabel}>Bilingual coverage, EN + ES</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>60d</span>
              <span className={styles.statLabel}>Money-back guarantee</span>
            </div>
          </div>
        </div>

        {/* ── AGENTS HIGHLIGHT ── */}
        <section id="features" className={styles.section} style={{ background: "rgba(255,255,255,0.01)" }}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>What&apos;s inside</p>
              <h2>27 AI agents.<br /><span className={styles.gradientText}>One operating system.</span></h2>
              <p>
                Every agent does one job exceptionally — and together they form a self-improving
                business brain. Production agents run 24/7 right now. The rest deploy as your business grows.
              </p>
            </div>

            <div className={styles.agentsGrid}>
              <article className={styles.agentCard}>
                <Image className={styles.agentIcon} src="/agents/agent-fer.png" alt="Fer — AI Receptionist" width={80} height={80} />
                <div className={styles.agentTag}>Fer · AI Lead Receptionist</div>
                <h3 className={styles.agentName}>Never miss another lead</h3>
                <p className={styles.agentDesc}>
                  Bilingual SMS that responds in 30 seconds, 24/7. Qualifies intent, books appointments,
                  runs follow-up sequences, and escalates hot leads to Telegram instantly.
                </p>
                <span className={styles.agentPill}>SMS · Bilingual · CRM sync</span>
              </article>

              <article className={styles.agentCard}>
                <Image className={styles.agentIcon} src="/agents/agent-tracy.png" alt="Tracy — Skip Tracing" width={80} height={80} />
                <div className={styles.agentTag}>Tracy · Skip Tracer</div>
                <h3 className={styles.agentName}>Find any owner, anywhere</h3>
                <p className={styles.agentDesc}>
                  Phone, email, and equity data from any address. Enriches every lead with ownership history,
                  length of ownership, and contact info — automatically.
                </p>
                <span className={styles.agentPill}>Owner lookup · Enrichment</span>
              </article>

              <article className={styles.agentCard}>
                <Image className={styles.agentIcon} src="/agents/agent-alex.png" alt="El Posicionador — SEO AI" width={80} height={80} />
                <div className={styles.agentTag}>El Posicionador · SEO AI</div>
                <h3 className={styles.agentName}>Rank on every search engine</h3>
                <p className={styles.agentDesc}>
                  Monitors Google, Bing, ChatGPT Search, Perplexity, and AI Overviews simultaneously.
                  Tracks geo-grid rankings city by city and fires Telegram alerts when scores drop.
                </p>
                <span className={styles.agentPill}>7 search engines · Geo-grid</span>
              </article>

              <article className={styles.agentCard}>
                <Image className={styles.agentIcon} src="/agents/agent-creativo.png" alt="El Creativo — Visual Content" width={80} height={80} />
                <div className={styles.agentTag}>El Creativo · Visual Content</div>
                <h3 className={styles.agentName}>Content factory on autopilot</h3>
                <p className={styles.agentDesc}>
                  Generates posts, carousels, and reels in your brand voice — bilingual EN+ES — then publishes
                  directly to Facebook + Instagram via Meta Graph API. No Canva, no Hootsuite needed.
                </p>
                <span className={styles.agentPill}>FB · IG · Bilingual · Meta API</span>
              </article>

              <article className={styles.agentCard}>
                <Image className={styles.agentIcon} src="/agents/agent-secretario.png" alt="El Remitente — Email Marketing" width={80} height={80} />
                <div className={styles.agentTag}>El Remitente · Email Marketing</div>
                <h3 className={styles.agentName}>Email marketing, zero overhead</h3>
                <p className={styles.agentDesc}>
                  Full email pipeline with zero Mailchimp fees — drafts campaigns, runs drip sequences, handles
                  welcome flows, tracks opens/clicks, and delivers via your own SMTP. Gmail/Yahoo 2024 compliant.
                </p>
                <span className={styles.agentPill}>No Mailchimp · Own SMTP · SPF/DKIM</span>
              </article>

              <article className={`${styles.agentCard} ${styles.agentCardFeatured}`}>
                <Image className={styles.agentIcon} src="/agents/agent-enterprise.png" alt="El Supervisor — Watchdog AI" width={80} height={80} />
                <div className={styles.agentTag}>El Supervisor · Watchdog AI</div>
                <h3 className={styles.agentName}>The system that watches itself</h3>
                <p className={styles.agentDesc}>
                  Meta-agent that runs heartbeat checks every 15 min, repairs ghost leads, detects pipeline drift,
                  and writes weekly evolution proposals — so your business improves without you lifting a finger.
                </p>
                <span className={styles.agentPill}>Self-healing · Auto-repair · Evolves</span>
              </article>
            </div>

            {/* ── FULL ECOSYSTEM ── */}
            <div className={styles.ecosystem}>
              <div className={styles.ecosystemHeader}>
                <p className={styles.sectionLabel}>Full ecosystem</p>
                <h3>All 27 agents, organized by function</h3>
                <p className={styles.ecosystemLegend}>
                  <span style={{ color: "#22c55e" }}>● Production</span>
                  <span style={{ color: "#f59e0b" }}>● Code-complete</span>
                  <span style={{ color: "#6366f1" }}>● Planned</span>
                </p>
              </div>

              <div className={styles.ecosystemGrid}>
                <EcoColumn title="Lead Generation"    color="#f97316" icon="🎯" rows={LEAD_GEN} />
                <EcoColumn title="Content & Social"   color="#a855f7" icon="🎨" rows={CONTENT_SOCIAL} />
                <EcoColumn title="SEO & Visibility"   color="#06b6d4" icon="🔍" rows={SEO_VISIBILITY} />
                <EcoColumn title="Intelligence & Ops" color="#f59e0b" icon="📊" rows={INTEL_OPS} />
                <EcoColumn title="Outreach & Email"   color="#10b981" icon="📧" rows={OUTREACH_EMAIL} />
                <EcoColumn
                  title="On the Roadmap"
                  color="#818cf8"
                  icon="🔮"
                  rows={ROADMAP}
                  variant="roadmap"
                  note="New agents deploy automatically to your account — no plan changes needed."
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── VS COMPETITORS ── */}
        <section className={styles.section} style={{ background: "rgba(255,255,255,0.01)" }}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Why InvestorOS</p>
              <h2>One system.<br /><span className={styles.gradientText}>Not five duct-taped together.</span></h2>
              <p>
                Most businesses pay $800–$1,500/mo across BatchLeads, Pipedrive, Hootsuite, a skip tracer,
                and a VA. InvestorOS replaces all of it — and adds AI they don&apos;t offer.
              </p>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.compareTable}>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th className="us">
                      <div>InvestorOS</div>
                      <div>from $297/mo</div>
                    </th>
                    <th>BatchLeads<br /><span style={{ fontSize: "11px" }}>$299+/mo</span></th>
                    <th>Pipedrive<br /><span style={{ fontSize: "11px" }}>$49+/user/mo</span></th>
                    <th>Hootsuite<br /><span style={{ fontSize: "11px" }}>$99+/mo</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>AI SMS + Voice Receptionist</td>
                    <td className="us">✓ 24/7 Bilingual</td>
                    <td className="other">✗</td>
                    <td className="other">✗</td>
                    <td className="other">✗</td>
                  </tr>
                  <tr>
                    <td>CRM + Lead Pipeline</td>
                    <td className="us">✓ Included</td>
                    <td className="other">Partial</td>
                    <td className="other" style={{ color: "#a5b4fc" }}>✓</td>
                    <td className="other">✗</td>
                  </tr>
                  <tr>
                    <td>Skip Tracing</td>
                    <td className="us">✓ 50–1,000+/mo</td>
                    <td className="other" style={{ color: "#a5b4fc" }}>✓</td>
                    <td className="other">✗</td>
                    <td className="other">✗</td>
                  </tr>
                  <tr>
                    <td>AI Deal Analysis</td>
                    <td className="us">✓ Comps + ARV + MAO</td>
                    <td className="other">Basic comps</td>
                    <td className="other">✗</td>
                    <td className="other">✗</td>
                  </tr>
                  <tr>
                    <td>Social Media Automation</td>
                    <td className="us">✓ AI-generated + publish</td>
                    <td className="other">✗</td>
                    <td className="other">✗</td>
                    <td className="other" style={{ color: "#a5b4fc" }}>✓ (no AI)</td>
                  </tr>
                  <tr>
                    <td>Bilingual (EN + ES)</td>
                    <td className="us">✓ Native</td>
                    <td className="other">✗</td>
                    <td className="other">✗</td>
                    <td className="other">✗</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Monthly cost (full stack)</td>
                    <td className="us" style={{ fontSize: "16px", fontWeight: 800 }}>$297/mo</td>
                    <td className="other" style={{ fontWeight: 600 }}>$299+</td>
                    <td className="other" style={{ fontWeight: 600 }}>$245+</td>
                    <td className="other" style={{ fontWeight: 600 }}>$99+</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={styles.compareNote}>
              Combined cost of competitors for same coverage:{" "}
              <strong style={{ color: "var(--text-muted)" }}>$800–$1,500+/mo</strong> — plus the headache of 4 different logins.
            </p>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Pricing</p>
              <h2>Built premium.<br /><span className={styles.gradientText}>Priced to perform.</span></h2>
              <p>
                One subscription replaces five tools. No per-seat traps, no surprise fees. 60-day money-back
                if InvestorOS doesn&apos;t move the needle.
              </p>
            </div>

            <div className={styles.founderBanner}>
              <div>
                <div className={styles.founderTag}>🔥 Founder Rate — First 100 Businesses Only</div>
                <div className={styles.founderHook}>Lock in $197/mo — saves you $100 every month, forever.</div>
                <div className={styles.founderSub}>
                  Or pay $997 for 6 months upfront and save an extra $185. Price increases once we hit 100 clients.
                </div>
              </div>
              <div className={styles.founderProgress}>
                <div className={styles.founderProgressLabel}>Spots claimed</div>
                <div className={styles.founderProgressBar}>
                  <div className={styles.founderProgressFill} />
                </div>
                <div className={styles.founderProgressCount}>33 / 100 claimed</div>
              </div>
            </div>

            <div className={styles.pricingGrid}>
              {/* Starter */}
              <div className={styles.priceCard}>
                <div className={styles.priceTier}>Starter</div>
                <div className={styles.priceStrike}>$297</div>
                <div className={styles.priceNum}>$197<span>/mo</span></div>
                <div className={styles.priceFounderTag}>Founder rate · first 100 only</div>
                <p className={styles.priceDesc}>Small business owners and solo operators ready to automate and grow.</p>
                <button type="button" className={`${styles.priceBtn} ${styles.priceBtnGhost}`}>Claim founder rate →</button>
                <ul className={styles.priceFeatures}>
                  <li><span className={styles.check}>✓</span>1 AI phone number (SMS + voice)</li>
                  <li><span className={styles.check}>✓</span>50 skip traces/month</li>
                  <li><span className={styles.check}>✓</span>CRM + lead pipeline</li>
                  <li><span className={styles.check}>✓</span>1 user seat</li>
                  <li><span className={styles.check}>✓</span>Email support 48h</li>
                </ul>
              </div>

              {/* Growth (featured) */}
              <div className={`${styles.priceCard} ${styles.priceCardFeatured}`}>
                <div className={styles.popularBadge}>Most popular</div>
                <div className={styles.priceTier}>Growth</div>
                <div className={styles.priceStrike}>$697</div>
                <div className={styles.priceNum}>$397<span>/mo</span></div>
                <div className={styles.priceFounderTag}>Founder rate · first 100 only</div>
                <p className={styles.priceDesc}>Growing teams generating $10k–100k MRR ready to scale operations.</p>
                <button type="button" className={`${styles.priceBtn} ${styles.priceBtnPrimary}`}>Claim founder rate →</button>
                <ul className={styles.priceFeatures}>
                  <li><span className={styles.check}>✓</span>2 phone numbers + 5 user seats</li>
                  <li><span className={styles.check}>✓</span>200 skip traces, 30 social posts/mo</li>
                  <li><span className={styles.check}>✓</span>Full deal analysis suite</li>
                  <li><span className={styles.check}>✓</span>Email monitor + Calendar sync</li>
                  <li><span className={styles.check}>✓</span>Priority support 24h · 99% SLA</li>
                </ul>
              </div>

              {/* Pro */}
              <div className={styles.priceCard}>
                <div className={styles.priceTier}>Pro</div>
                <div className={styles.priceStrike}>$1,497</div>
                <div className={styles.priceNum}>$997<span>/mo</span></div>
                <div className={styles.priceFounderTag}>Founder rate · first 100 only</div>
                <p className={styles.priceDesc}>Agencies and multi-location operations running $100k+ MRR.</p>
                <button type="button" className={`${styles.priceBtn} ${styles.priceBtnGhost}`}>Claim founder rate →</button>
                <ul className={styles.priceFeatures}>
                  <li><span className={styles.check}>✓</span>5 numbers + 20 seats + API</li>
                  <li><span className={styles.check}>✓</span>1,000 skip traces, 100 posts/mo</li>
                  <li><span className={styles.check}>✓</span>White-label + custom domain</li>
                  <li><span className={styles.check}>✓</span>Advanced analytics dashboard</li>
                  <li><span className={styles.check}>✓</span>Priority 4h support · 99.5% SLA</li>
                </ul>
              </div>

              {/* Enterprise */}
              <div className={styles.priceCard}>
                <div className={styles.priceTier}>Enterprise</div>
                <div className={styles.priceCustom}>Custom</div>
                <div style={{ height: "28px" }} />
                <p className={styles.priceDesc}>Dedicated infrastructure, custom agents, SSO, 7-year audit logs.</p>
                <button type="button" className={`${styles.priceBtn} ${styles.priceBtnGhost}`}>Contact sales</button>
                <ul className={styles.priceFeatures}>
                  <li><span className={styles.check}>✓</span>Unlimited everything</li>
                  <li><span className={styles.check}>✓</span>Dedicated CSM + 99.9% SLA</li>
                  <li><span className={styles.check}>✓</span>Custom agent prompts</li>
                  <li><span className={styles.check}>✓</span>SSO + SAML + SCIM</li>
                  <li><span className={styles.check}>✓</span>Multi-region deployment</li>
                </ul>
              </div>
            </div>

            <p className={styles.pricingNote}>
              Setup fee $997 one-time · 6-month upfront: $997 (saves $185 vs monthly) · 60-day money-back guarantee
            </p>
          </div>
        </section>

        {/* ── TECH STACK ── */}
        <section className={styles.stackSection}>
          <div className={styles.stackInner}>
            <p className={styles.stackHeader}>Built on production-grade infrastructure</p>
            <div className={styles.stackTags}>
              <span className={styles.stackTag}>Next.js 15 + React 19</span>
              <span className={styles.stackTag}>Claude Sonnet 4.6</span>
              <span className={styles.stackTag}>Airtable per-tenant</span>
              <span className={styles.stackTag}>Meta Graph API</span>
              <span className={styles.stackTag}>Vercel + VPS agents</span>
              <span className={styles.stackTag}>Cloudinary CDN</span>
              <span className={styles.stackTag}>Playwright + FFmpeg</span>
              <span className={styles.stackTag}>Hostinger SMTP</span>
              <span className={styles.stackTag}>Telnyx / OpenPhone SMS</span>
              <span className={styles.stackTag}>Prisma + Supabase</span>
              <span className={styles.stackTag}>Clerk Auth (planned)</span>
              <span className={styles.stackTag}>Stripe Billing (planned)</span>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <div className={styles.footerWrap}>
          <div className={styles.divider} />
          <footer className={styles.footer}>
            <Link href="/" className={styles.footerBrand}>
              <span className={styles.navLogoIcon} style={{ width: 24, height: 24, fontSize: 11, borderRadius: 6 }}>IO</span>
              InvestorOS
            </Link>
            <ul className={styles.footerLinks}>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Terms</a></li>
              <li><a href="#">Docs</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
            <p className={styles.footerCopy}>© {new Date().getFullYear()} Pinnacle Holdings Group LLC</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
