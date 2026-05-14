#!/usr/bin/env node
/**
 * El Auditor — weekly compliance sweep orchestrator.
 *
 * Usage:
 *   node agents/auditor/auditor.mjs --tenant <slug> --mode weekly|reg_focus|incident [--reg tcpa|can_spam|fair_housing|gdpr|wi_wholesaler|ada_web] [--dry-run]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseArgs, loadTenant, runClaude,
  airtableFetch, airtableUpsert, telegramSend,
  extractScore, extractBlock, genRunId, isoNow,
} from "../_shared/runner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "runs");
const VALID_MODES = ["weekly", "reg_focus", "incident"];
const VALID_REGS = ["tcpa", "can_spam", "fair_housing", "gdpr", "wi_wholesaler", "ada_web", "all"];
const TABLE_KEY = "compliance_audits_table_id";

function buildPrompt(cfg, args, signals) {
  const tenant = cfg.tenant_name;
  const site = cfg.website;
  const state = cfg.markets?.[0]?.state || "";
  const today = new Date().toISOString().slice(0, 10);
  const regFocus = args.reg && args.reg !== "all" ? args.reg : null;

  const regsList = regFocus ? [regFocus] : ["wi_wholesaler", "tcpa", "can_spam", "fair_housing", "gdpr", "ada_web"];

  const regDescriptions = {
    wi_wholesaler: `**Wisconsin Wholesaler Law (WI Act 205, 2024)** — License / disclosure for assignable contracts, P&S language, buyer/seller disclosure obligations, marketing "wholesaler" vs "buyer"`,
    tcpa:          `**TCPA (SMS)** — Prior express written consent documented, STOP keyword handling, 8am-9pm local time window, identity disclosure in first message, no auto-dialer to cell without consent`,
    can_spam:      `**CAN-SPAM (Email)** — Physical address in every email, clear unsubscribe, honored within 10 business days, non-deceptive subject lines, accurate From/Reply-To, List-Unsubscribe header (2024+ Gmail/Yahoo)`,
    fair_housing:  `**Fair Housing Act** — No steering language, no discriminatory terms ("perfect for single mom", "christian neighborhood", "no children"), equal access, accessibility statement`,
    gdpr:          `**GDPR** — Cookie consent banner, privacy policy linked everywhere, data export/delete rights, third-party tracker disclosures`,
    ada_web:       `**ADA Web Accessibility (WCAG 2.1 AA)** — Alt text, keyboard navigation, contrast ratios, form labels, ARIA landmarks`,
  };

  const regsBlock = regsList.map(r => regDescriptions[r]).join("\n\n");

  return `You are El Auditor, always-on compliance sub-agent for the R9 plantel.
Tenant: ${tenant} | Market: ${state} | Website: ${site} | Date: ${today} | Mode: ${args.mode}${regFocus ? ` | Focus: ${regFocus}` : ""}

You audit the ENTIRE Pinnacle stack (site + emails + SMS + schema) against each regulation below. For EACH regulation, score 0-100, list specific evidence snippets quoted from the actual stack, and classify findings as Critical / Warning / Passing.

Regulations in scope:

${regsBlock}

Signals collected from the stack:

${signals}

Skills to invoke where helpful:
- /seo-accessibility or /a11y-audit for ADA
- WebFetch ${site} and ${site}/privacy-policy, ${site}/contact, ${site}/blog for page-level language
- Review Email_Campaigns recent samples for CAN-SPAM + List-Unsubscribe
- Review SMS templates if referenced

Output format (STRICT markdown):

# ${tenant} — Compliance Audit ${today}

## Overall Score: N/100

### Per-regulation scores
- wi_wholesaler_score: N/100 [skip if focus]
- tcpa_score: N/100
- can_spam_score: N/100
- fair_housing_score: N/100
- gdpr_score: N/100
- adaweb_score: N/100

## Critical Issues (lawsuit exposure — fix NOW)
- [specific finding + quoted evidence + regulation + $ exposure estimate]
- ...

## Warnings (fix this month)
- ...

## Passing (currently compliant)
- ...

## Recommendations (prioritized)
1. ...
2. ...
3. ...

## Evidence Snippets
> "quoted line from site/email/SMS that triggered the finding"
> source: URL or template name
> rule: which regulation clause

Be SPECIFIC and EVIDENCE-BASED. Do NOT flag things you didn't actually see. If a regulation is N/A (e.g. GDPR with no EU traffic), score it 100 and note N/A in evidence.`;
}

async function gatherSignals(cfg) {
  const [emails, marketing, seo] = await Promise.all([
    airtableFetch(cfg, "email_campaigns_table_id", "maxRecords=5&sort[0][field]=sent_at&sort[0][direction]=desc").catch(() => ({ records: [] })),
    airtableFetch(cfg, "table_id", "maxRecords=1&sort[0][field]=started_at&sort[0][direction]=desc").catch(() => ({ records: [] })),
    airtableFetch(cfg, "seo_table_id", "maxRecords=1&sort[0][field]=started_at&sort[0][direction]=desc").catch(() => ({ records: [] })),
  ]);

  const recentEmails = (emails.records || []).slice(0, 5).map(r => {
    const f = r.fields || {};
    return `- subject: "${(f.subject || "").slice(0, 100)}" | sent_at: ${f.sent_at || "n/a"} | has_unsub: ${!!f.unsubscribe_url}`;
  }).join("\n") || "(no recent campaigns)";

  const mktgSummary = marketing.records?.[0]?.fields?.top_issues?.slice(0, 600) || "(no recent Mercader audit)";
  const seoSummary = seo.records?.[0]?.fields?.top_issues?.slice(0, 600) || "(no recent Posicionador audit)";

  return `### Email campaigns (last 5)
${recentEmails}

### Latest Mercader top issues
${mktgSummary}

### Latest Posicionador top issues
${seoSummary}

### Site sections to check (via WebFetch if needed)
- ${cfg.website}/
- ${cfg.website}/privacy-policy
- ${cfg.website}/terms-of-service
- ${cfg.website}/contact
- ${cfg.website}/blog

### Brand
- phone: ${cfg.brand?.phone}
- email: ${cfg.brand?.email}
- state: ${cfg.markets?.[0]?.state}`;
}

function parseOutput(text) {
  return {
    overall_score:          extractScore(text, "overall"),
    wi_wholesaler_score:    extractScore(text, "wi[_\\s]?wholesaler"),
    tcpa_score:             extractScore(text, "tcpa"),
    can_spam_score:         extractScore(text, "can[_\\s]?spam"),
    fair_housing_score:     extractScore(text, "fair[_\\s]?housing"),
    gdpr_score:             extractScore(text, "gdpr"),
    adaweb_score:           extractScore(text, "(?:adaweb|ada[_\\s]?web|a11y)"),
    critical_issues:        extractBlock(text, "Critical Issues").slice(0, 2500),
    warnings:               extractBlock(text, "Warnings").slice(0, 2000),
    passing:                extractBlock(text, "Passing").slice(0, 1500),
    recommendations:        extractBlock(text, "Recommendations").slice(0, 2500),
    evidence_snippets:      extractBlock(text, "Evidence Snippets").slice(0, 2500),
    summary_md:             text.slice(0, 8000),
  };
}

async function main() {
  const args = parseArgs(process.argv, VALID_MODES, { reg: "all" });
  if (args.reg && !VALID_REGS.includes(args.reg)) {
    console.error(`ERROR: --reg must be one of ${VALID_REGS.join(", ")}`);
    process.exit(2);
  }
  const cfg = await loadTenant(args.tenant);
  const runId = genRunId();
  const startedAt = isoNow();

  console.error(`[auditor] tenant=${cfg.tenant_id} mode=${args.mode} reg=${args.reg} run_id=${runId} dry_run=${args.dryRun}`);

  const signals = await gatherSignals(cfg);
  const prompt = buildPrompt(cfg, args, signals);

  if (args.dryRun) {
    console.log("=== DRY RUN [auditor] ===");
    console.log(prompt);
    return;
  }

  await airtableUpsert(cfg, TABLE_KEY, runId, {
    tenant_id: cfg.tenant_id,
    status: "Running",
    trigger: process.env.AUDITOR_TRIGGER || "alex_manual",
    started_at: startedAt,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });

  let out = "";
  try {
    out = await runClaude(cfg.claude.binary_path, prompt);
  } catch (e) {
    await airtableUpsert(cfg, TABLE_KEY, runId, { status: "Failed", completed_at: isoNow() });
    await telegramSend(cfg, `❌ *El Auditor — ${cfg.tenant_name}*\nmode \`${args.mode}\` error: \`${e.message}\``);
    process.exit(1);
  }

  const parsed = parseOutput(out);
  const completedAt = isoNow();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);

  const mdPath = join(OUTPUT_DIR, `${runId}.md`);
  await writeFile(mdPath, out, "utf8");

  await airtableUpsert(cfg, TABLE_KEY, runId, {
    status: "Done",
    completed_at: completedAt,
    duration_sec: duration,
    ...parsed,
    report_url: mdPath,
  });

  const thr = cfg.alert_thresholds || {};
  const score = parsed.overall_score;
  let emoji = "⚖️", flag = "";
  if (score != null) {
    if (score < (thr.critical_score ?? 50)) { emoji = "🚨"; flag = "LAWSUIT RISK"; }
    else if (score < (thr.warn_score ?? 70)) { emoji = "⚠️"; flag = "GAPS"; }
    else { emoji = "✅"; flag = "COMPLIANT"; }
  }

  const scoreLine = [
    parsed.tcpa_score != null ? `TCPA ${parsed.tcpa_score}` : null,
    parsed.can_spam_score != null ? `CAN-SPAM ${parsed.can_spam_score}` : null,
    parsed.fair_housing_score != null ? `FH ${parsed.fair_housing_score}` : null,
    parsed.wi_wholesaler_score != null ? `WI-W ${parsed.wi_wholesaler_score}` : null,
    parsed.adaweb_score != null ? `ADA ${parsed.adaweb_score}` : null,
  ].filter(Boolean).join(" · ");

  const head = `${emoji} *El Auditor — ${cfg.tenant_name}*\nmode \`${args.mode}\` · overall *${score ?? "?"}/100* (${flag})\n${scoreLine}`;
  const body = parsed.critical_issues
    ? `\n\n*Critical:*\n${parsed.critical_issues.split("\n").slice(0, 6).join("\n")}`
    : "";
  await telegramSend(cfg, (head + body).slice(0, 3900));

  console.error(`[auditor] done run_id=${runId} score=${score} duration=${duration}s`);
}

main().catch(e => { console.error("[auditor] FATAL:", e); process.exit(1); });
