import Image from "next/image";
import Link from "next/link";
import styles from "./landing.module.css";

export const metadata = {
  title: "InvestorOS — The Business Operating System",
  description:
    "AI agents for lead capture, CRM, deal analysis, social media, and operations — automated, bilingual, and built for businesses that refuse to stay small.",
};

type AgentStatus = "production" | "code-complete" | "planned";

type Agent = {
  name: string;
  role: string;
  img: string;
  status: AgentStatus;
};

const AGENTS: Agent[] = [
  // Row 1: Production (1-9)
  { name: "Fer",    role: "Receptionist",       img: "agent-fer.png",    status: "production" },
  { name: "Tracy",  role: "Skip Tracer",        img: "agent-tracy.png",  status: "production" },
  { name: "Marco",  role: "Social Media",       img: "agent-marco.png",  status: "production" },
  { name: "Sofia",  role: "Visual Creator",     img: "agent-sofia.png",  status: "production" },
  { name: "Leo",    role: "Video Director",     img: "agent-leo.png",    status: "production" },
  { name: "Max",    role: "Quality Gate",       img: "agent-max.png",    status: "production" },
  { name: "Nina",   role: "Content Optimizer",  img: "agent-nina.png",   status: "production" },
  { name: "Sage",   role: "Analytics",          img: "agent-sage.png",   status: "production" },
  { name: "Rex",    role: "SEO Monitor",        img: "agent-rex.png",    status: "production" },
  // Row 2: Production cont + Code-complete start (10-18)
  { name: "Ava",    role: "UX Optimizer",       img: "agent-ava.png",    status: "production" },
  { name: "Echo",   role: "Meta Auditor",       img: "agent-echo.png",   status: "production" },
  { name: "Zed",    role: "Dev Ops",            img: "agent-zed.png",    status: "production" },
  { name: "Eli",    role: "Content Writer",     img: "agent-eli.png",    status: "code-complete" },
  { name: "Chase",  role: "Paid Ads",           img: "agent-chase.png",  status: "code-complete" },
  { name: "Nova",   role: "GBP Manager",        img: "agent-nova.png",   status: "code-complete" },
  { name: "Kai",    role: "Lead Scorer",        img: "agent-kai.png",    status: "code-complete" },
  { name: "Luca",   role: "LinkedIn B2B",       img: "agent-luca.png",   status: "code-complete" },
  { name: "Remi",   role: "Community",          img: "agent-remi.png",   status: "code-complete" },
  // Row 3: Code-complete cont + Planned (19-27)
  { name: "Scout",  role: "Web Scraper",        img: "agent-scout.png",  status: "code-complete" },
  { name: "Atlas",  role: "Executive Brief",    img: "agent-atlas.png",  status: "code-complete" },
  { name: "Orion",  role: "Watchdog",           img: "agent-orion.png",  status: "code-complete" },
  { name: "Viper",  role: "Sales Closer",       img: "agent-viper.png",  status: "code-complete" },
  { name: "Ember",  role: "Onboarding",         img: "agent-ember.png",  status: "code-complete" },
  { name: "Carto",  role: "Territory Map",      img: "agent-carto.png",  status: "planned" },
  { name: "Ward",   role: "Compliance",         img: "agent-ward.png",   status: "planned" },
  { name: "Flynn",  role: "Automation",         img: "agent-flynn.png",  status: "planned" },
  { name: "Penny",  role: "Financial Intel",    img: "agent-penny.png",  status: "planned" },
];

const STATUS_BORDER: Record<AgentStatus, string> = {
  "production":     "rgba(34,197,94,0.5)",
  "code-complete":  "rgba(245,158,11,0.5)",
  "planned":        "rgba(99,102,241,0.5)",
};

const STATUS_DOT: Record<AgentStatus, string> = {
  "production":     "#22c55e",
  "code-complete":  "#f59e0b",
  "planned":        "#6366f1",
};

export default function HomePage() {
  return (
    <div className={styles.landingRoot}>
      <div className={styles.heroGlow} aria-hidden="true" />

      <div className={styles.content}>

        {/* ── NAVBAR ── */}
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
            <a href="/sign-in" className={styles.btnGhost}>Sign in</a>
            <a href="/sign-up" className={styles.btnPrimary}>Start free trial →</a>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className={styles.hero}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Founder Rate — First 100 businesses only · <strong style={{ color: "#e879f9" }}>67 spots left</strong>
          </div>

          <h1 className={styles.heroH1}>
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
            No free trial — because you won't need one &nbsp;·&nbsp; 60-day money-back guarantee
          </p>
        </section>

        {/* ── STATS BAR ── */}
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

        {/* ── AGENTS ── */}
        <section id="features" className={styles.sectionAgents}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>What&apos;s inside</p>
              <h2 className={styles.sectionH2}>
                27 AI agents.<br />
                <span className={styles.gradientText}>One operating system.</span>
              </h2>
              <p className={styles.sectionP}>
                Every agent does one job exceptionally — and together they form a self-improving business brain.
                Production agents run 24/7 right now. The rest deploy as your business grows.
              </p>
            </div>

            <div className={styles.agentsGrid}>
              {AGENTS.map((agent) => (
                <div key={agent.name} className={styles.agentCard}>
                  <div className={styles.agentAvatarWrap}>
                    <Image
                      src={`/investoros-agents/${agent.img}`}
                      alt={`${agent.name} — ${agent.role}`}
                      width={72}
                      height={72}
                      className={styles.agentAvatar}
                      style={{ borderColor: STATUS_BORDER[agent.status] }}
                    />
                    <span
                      className={styles.agentStatusDot}
                      style={{ background: STATUS_DOT[agent.status] }}
                    />
                  </div>
                  <div className={styles.agentName}>{agent.name}</div>
                  <div className={styles.agentRole}>{agent.role}</div>
                </div>
              ))}
            </div>

            <div className={styles.agentsLegend}>
              <span><span style={{ color: "#22c55e", fontWeight: 700 }}>●</span> Production (12)</span>
              <span><span style={{ color: "#f59e0b", fontWeight: 700 }}>●</span> Code-complete (12)</span>
              <span><span style={{ color: "#6366f1", fontWeight: 700 }}>●</span> Planned (3)</span>
            </div>
          </div>
        </section>

        {/* ── VS COMPETITORS ── */}
        <section className={styles.sectionVs}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Why InvestorOS</p>
              <h2 className={styles.sectionH2}>
                One system.<br />
                <span className={styles.gradientText}>Not five duct-taped together.</span>
              </h2>
              <p className={styles.sectionP}>
                Most businesses pay $800–$1,500/mo across BatchLeads, Pipedrive, Hootsuite, a skip tracer, and a VA.
                InvestorOS replaces all of it — and adds AI they don&apos;t offer.
              </p>
            </div>

            <div className={styles.tableScroll}>
              <table className={styles.compareTable}>
                <thead>
                  <tr>
                    <th className={styles.thFeature}>Feature</th>
                    <th className={styles.thUs}>
                      <div className={styles.thUsName}>InvestorOS</div>
                      <div className={styles.thUsPrice}>from $297/mo</div>
                    </th>
                    <th className={styles.thThem}>BatchLeads<br /><span className={styles.thThemPrice}>$299+/mo</span></th>
                    <th className={styles.thThem}>Pipedrive<br /><span className={styles.thThemPrice}>$49+/user/mo</span></th>
                    <th className={styles.thThem}>Hootsuite<br /><span className={styles.thThemPrice}>$99+/mo</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.tdFeature}>AI SMS + Voice Receptionist</td>
                    <td className={styles.tdUsWin}>✓ 24/7 Bilingual</td>
                    <td className={styles.tdThem}>✗</td>
                    <td className={styles.tdThem}>✗</td>
                    <td className={styles.tdThem}>✗</td>
                  </tr>
                  <tr>
                    <td className={styles.tdFeature}>CRM + Lead Pipeline</td>
                    <td className={styles.tdUsWin}>✓ Included</td>
                    <td className={styles.tdPartial}>Partial</td>
                    <td className={styles.tdThemOk}>✓</td>
                    <td className={styles.tdThem}>✗</td>
                  </tr>
                  <tr>
                    <td className={styles.tdFeature}>Skip Tracing</td>
                    <td className={styles.tdUsWin}>✓ 50–1,000+/mo</td>
                    <td className={styles.tdThemOk}>✓</td>
                    <td className={styles.tdThem}>✗</td>
                    <td className={styles.tdThem}>✗</td>
                  </tr>
                  <tr>
                    <td className={styles.tdFeature}>AI Deal Analysis</td>
                    <td className={styles.tdUsWin}>✓ Comps + ARV + MAO</td>
                    <td className={styles.tdPartial}>Basic comps</td>
                    <td className={styles.tdThem}>✗</td>
                    <td className={styles.tdThem}>✗</td>
                  </tr>
                  <tr>
                    <td className={styles.tdFeature}>Social Media Automation</td>
                    <td className={styles.tdUsWin}>✓ AI-generated + publish</td>
                    <td className={styles.tdThem}>✗</td>
                    <td className={styles.tdThem}>✗</td>
                    <td className={styles.tdThemOk}>✓ (no AI)</td>
                  </tr>
                  <tr>
                    <td className={styles.tdFeature}>Bilingual (EN + ES)</td>
                    <td className={styles.tdUsWin}>✓ Native</td>
                    <td className={styles.tdThem}>✗</td>
                    <td className={styles.tdThem}>✗</td>
                    <td className={styles.tdThem}>✗</td>
                  </tr>
                  <tr>
                    <td className={`${styles.tdFeature} ${styles.tdBold}`}>Monthly cost (full stack)</td>
                    <td className={`${styles.tdUsWin} ${styles.tdBigPrice}`}>$297/mo</td>
                    <td className={`${styles.tdThem} ${styles.tdBold}`}>$299+</td>
                    <td className={`${styles.tdThem} ${styles.tdBold}`}>$245+</td>
                    <td className={`${styles.tdThem} ${styles.tdBold}`}>$99+</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={styles.compareNote}>
              Combined cost of competitors for same coverage: <strong>$800–$1,500+/mo</strong> — plus the headache of 4 different logins.
            </p>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className={styles.sectionPricing}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Pricing</p>
              <h2 className={styles.sectionH2}>
                Built premium.<br />
                <span className={styles.gradientText}>Priced to perform.</span>
              </h2>
              <p className={styles.sectionP}>
                One subscription replaces five tools. No per-seat traps, no surprise fees.
                60-day money-back if InvestorOS doesn&apos;t move the needle.
              </p>
            </div>

            <div className={styles.founderBanner}>
              <div>
                <div className={styles.founderLabel}>🔒 Founder Rate — First 100 Businesses Only</div>
                <div className={styles.founderHeadline}>Lock in $197/mo — saves you $100 every month, forever.</div>
                <div className={styles.founderSub}>Or pay $997 for 6 months upfront and save an extra $185. Price increases once we hit 100 clients.</div>
              </div>
              <div className={styles.founderProgress}>
                <div className={styles.founderProgressLabel}>Spots claimed</div>
                <div className={styles.founderBar}>
                  <div className={styles.founderBarFill} style={{ width: "33%" }} />
                </div>
                <div className={styles.founderProgressNum}>33 / 100 claimed</div>
              </div>
            </div>

            <div className={styles.pricingGrid}>

              <div className={styles.priceCard}>
                <div className={styles.priceTier}>Starter</div>
                <div className={styles.priceNumStrike}>$297</div>
                <div className={styles.priceNum}>$197<span>/mo</span></div>
                <div className={styles.priceFounderTag}>Founder rate · first 100 only</div>
                <div className={styles.priceDesc}>Small business owners and solo operators ready to automate and grow.</div>
                <button className={`${styles.priceBtn} ${styles.priceBtnGhost}`}>Claim founder rate →</button>
                <ul className={styles.priceFeatures}>
                  <li><span className={styles.check}>✓</span>1 AI phone number (SMS + voice)</li>
                  <li><span className={styles.check}>✓</span>50 skip traces/month</li>
                  <li><span className={styles.check}>✓</span>CRM + lead pipeline</li>
                  <li><span className={styles.check}>✓</span>1 user seat</li>
                  <li><span className={styles.check}>✓</span>Email support 48h</li>
                </ul>
              </div>

              <div className={`${styles.priceCard} ${styles.priceCardFeatured}`}>
                <div className={styles.popularBadge}>Most popular</div>
                <div className={styles.priceTier}>Growth</div>
                <div className={styles.priceNumStrike}>$697</div>
                <div className={styles.priceNum}>$397<span>/mo</span></div>
                <div className={styles.priceFounderTag}>Founder rate · first 100 only</div>
                <div className={styles.priceDesc}>Growing teams generating $10k–100k MRR ready to scale operations.</div>
                <button className={`${styles.priceBtn} ${styles.priceBtnPrimary}`}>Claim founder rate →</button>
                <ul className={styles.priceFeatures}>
                  <li><span className={styles.check}>✓</span>2 phone numbers + 5 user seats</li>
                  <li><span className={styles.check}>✓</span>200 skip traces, 30 social posts/mo</li>
                  <li><span className={styles.check}>✓</span>Full deal analysis suite</li>
                  <li><span className={styles.check}>✓</span>Email monitor + Calendar sync</li>
                  <li><span className={styles.check}>✓</span>Priority support 24h · 99% SLA</li>
                </ul>
              </div>

              <div className={styles.priceCard}>
                <div className={styles.priceTier}>Pro</div>
                <div className={styles.priceNumStrike}>$1,497</div>
                <div className={styles.priceNum}>$997<span>/mo</span></div>
                <div className={styles.priceFounderTag}>Founder rate · first 100 only</div>
                <div className={styles.priceDesc}>Agencies and multi-location operations running $100k+ MRR.</div>
                <button className={`${styles.priceBtn} ${styles.priceBtnGhost}`}>Claim founder rate →</button>
                <ul className={styles.priceFeatures}>
                  <li><span className={styles.check}>✓</span>5 numbers + 20 seats + API</li>
                  <li><span className={styles.check}>✓</span>1,000 skip traces, 100 posts/mo</li>
                  <li><span className={styles.check}>✓</span>White-label + custom domain</li>
                  <li><span className={styles.check}>✓</span>Advanced analytics dashboard</li>
                  <li><span className={styles.check}>✓</span>Priority 4h support · 99.5% SLA</li>
                </ul>
              </div>

              <div className={styles.priceCard}>
                <div className={styles.priceTier}>Enterprise</div>
                <div className={styles.priceNumCustom}>Custom</div>
                <div className={styles.priceSpacer} />
                <div className={styles.priceDesc}>Dedicated infrastructure, custom agents, SSO, 7-year audit logs.</div>
                <button className={`${styles.priceBtn} ${styles.priceBtnGhost}`}>Contact sales</button>
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
        <section className={styles.sectionTech}>
          <div className={styles.sectionInner}>
            <p className={styles.techHeader}>Built on production-grade infrastructure</p>
            <div className={styles.techPills}>
              <span className={styles.techPill}>Next.js 15 + React 19</span>
              <span className={styles.techPill}>Claude Sonnet 4.6</span>
              <span className={styles.techPill}>Airtable per-tenant</span>
              <span className={styles.techPill}>Meta Graph API</span>
              <span className={styles.techPill}>Vercel + VPS agents</span>
              <span className={styles.techPill}>Cloudinary CDN</span>
              <span className={styles.techPill}>Playwright + FFmpeg</span>
              <span className={styles.techPill}>Hostinger SMTP</span>
              <span className={styles.techPill}>Telnyx / OpenPhone SMS</span>
              <span className={styles.techPill}>Prisma + Supabase</span>
              <span className={styles.techPill}>Clerk Auth (planned)</span>
              <span className={styles.techPill}>Stripe Billing (planned)</span>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <div className={styles.divider} />
        <footer className={styles.footer}>
          <Link href="/" className={styles.footerBrand}>
            <span className={`${styles.navLogoIcon} ${styles.navLogoIconSmall}`}>IO</span>
            InvestorOS
          </Link>
          <ul className={styles.footerLinks}>
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
            <li><a href="#">Docs</a></li>
            <li><a href="mailto:hello@investoros.tech">Contact</a></li>
          </ul>
          <p className={styles.footerCopy}>© 2026 Pinnacle Holdings Group LLC</p>
        </footer>

      </div>
    </div>
  );
}
