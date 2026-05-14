#!/usr/bin/env node
/**
 * El Espía — daily competitor watchdog orchestrator.
 *
 * Usage:
 *   node agents/espia/espia.mjs --tenant <slug> --mode daily|weekly_deep|on_demand [--competitor URL] [--dry-run]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseArgs, loadTenant, runClaude,
  airtableFetch, airtableCreate, airtableUpsert, telegramSend,
  extractScore, extractNumber, extractBlock, genRunId, isoNow,
} from "../_shared/runner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "runs");
const VALID_MODES = ["daily", "weekly_deep", "on_demand"];
const TABLE_KEY = "competitor_intel_table_id";
const UA = "Mozilla/5.0 (compatible; PinnacleBot/1.0; +https://pinnaclegroupwi.com)";

function uniq(arr) { return [...new Set(arr)]; }

async function fetchPage(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html" }, redirect: "follow" });
    const html = (await r.text()).slice(0, 200_000);
    return { status: r.status, html };
  } catch (e) {
    return { status: 0, html: "", error: e.message };
  }
}

function extractHtml(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1].trim().slice(0, 200);
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [, ""])[1].replace(/<[^>]+>/g, "").trim().slice(0, 300);
  const heroMatch = html.match(/<(?:p|h2|div)[^>]*class="[^"]*(?:hero|lead|intro)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|h2|div)>/i);
  const hero = (heroMatch ? heroMatch[1] : (html.match(/<p[^>]*>([\s\S]{30,300}?)<\/p>/) || [, ""])[1] || "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);

  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                   .replace(/<style[\s\S]*?<\/style>/gi, "")
                   .replace(/<[^>]+>/g, " ")
                   .replace(/\s+/g, " ");
  const word_count = text.split(" ").filter(Boolean).length;

  const ctas = uniq(
    [...html.matchAll(/<(?:button|a)[^>]*(?:class="[^"]*(?:btn|cta|button)[^"]*")[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, "").trim())
      .filter(s => s.length > 2 && s.length < 80)
  ).slice(0, 20).join(" | ");

  const phones = uniq(
    (text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || []).map(p => p.trim())
  ).slice(0, 10).join(", ");

  const addresses = uniq(
    (text.match(/\d{1,6}\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Blvd|Drive|Dr|Way|Lane|Ln|Ct|Place|Pl)[^,]*,\s*[A-Z]{2}\s+\d{5}/g) || [])
  ).slice(0, 5).join("; ");

  const socials = uniq(
    [...html.matchAll(/href="(https?:\/\/(?:www\.)?(?:facebook|instagram|twitter|x|linkedin|tiktok|youtube)\.com\/[^"]+)"/gi)]
      .map(m => m[1])
  ).slice(0, 10).join("\n");

  const pricing = uniq(
    (text.match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:k|K|,000|M)?/g) || [])
      .filter(p => !/^\$\s?0+$/.test(p))
  ).slice(0, 20).join(", ");

  const offerPatterns = [
    /(?:cash|sell)[^.]{0,80}(?:7|14|21)\s*days?/gi,
    /no\s+(?:fees?|commission|repairs?)/gi,
    /as[- ]is/gi,
    /fair\s+(?:cash\s+)?offer/gi,
  ];
  const offers = uniq(
    offerPatterns.flatMap(re => [...(text.match(re) || [])].map(s => s.trim()))
  ).slice(0, 15).join(" | ");

  const schemaBlocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1].slice(0, 1200)).join("\n---\n").slice(0, 3000);

  return { title, h1, hero, word_count, ctas, phones, addresses, socials, pricing, offers, schemaBlocks };
}

async function priorScan(cfg, competitor_url) {
  const esc = competitor_url.replace(/'/g, "\\'");
  const res = await airtableFetch(cfg, TABLE_KEY,
    `filterByFormula=${encodeURIComponent(`{competitor_url}='${esc}'`)}&maxRecords=1&sort[0][field]=scanned_at&sort[0][direction]=desc`);
  return res.records?.[0]?.fields || null;
}

function buildPrompt(cfg, comp, snap, prior, httpStatus) {
  const priorBlock = prior ? `Prior scan (${prior.scanned_at}):
- title: ${prior.title_tag}
- h1: ${prior.h1_text}
- hero: ${(prior.hero_copy_snippet || "").slice(0, 200)}
- ctas: ${prior.cta_buttons}
- phones: ${prior.phone_numbers}
- pricing: ${prior.pricing_observed}
- offers: ${prior.offers_observed}
- word_count: ${prior.word_count}` : "(No prior scan — this is the baseline.)";

  return `You are El Espía, always-on competitor watchdog for the R9 plantel.
Tenant: ${cfg.tenant_name} | Competitor: ${comp.name} (${comp.url})

Current scan:
- HTTP status: ${httpStatus}
- title: ${snap.title}
- h1: ${snap.h1}
- hero: ${snap.hero}
- word_count: ${snap.word_count}
- CTAs: ${snap.ctas}
- phones: ${snap.phones}
- addresses: ${snap.addresses}
- social: ${snap.socials}
- pricing observed: ${snap.pricing}
- offers observed: ${snap.offers}
- schema (first 3000 chars): ${snap.schemaBlocks.slice(0, 1500)}

${priorBlock}

Compare current vs prior. Rate change severity 0-10:
- 0-2 cosmetic (ignore)
- 3-5 moderate (daily digest)
- 6-8 significant (Telegram alert)
- 9-10 critical (🚨 immediate)

Output STRICT markdown:

# ${comp.name} — Scan ${new Date().toISOString().slice(0,10)}

## Changes Summary
[What changed vs prior scan. Specific. If baseline, say "baseline scan, no diff".]

## change_severity: N/10

## Recommended Action
[What Pinnacle should do in response. 2-4 bullets. Owner + timeline.]

## New Pages Detected
- (from sitemap or internal links diff, if any)

## Removed Pages
- (if any)

## Schema Changes
- (if any structured data delta)

## Ad Copy Samples (if visible)
- (ad library or homepage hero variants)

Be concrete. Quote actual strings. Do NOT invent data not in the current scan.`;
}

function parseOutput(text) {
  return {
    changes_summary:       extractBlock(text, "Changes Summary").slice(0, 2000),
    change_severity:       extractScore(text, "change[_\\s]+severity") ?? extractNumber(text, "change[_\\s]+severity"),
    recommended_action:    extractBlock(text, "Recommended Action").slice(0, 1500),
    new_pages_detected:    extractBlock(text, "New Pages Detected").slice(0, 800),
    removed_pages_detected:extractBlock(text, "Removed Pages").slice(0, 600),
    schema_changes:        extractBlock(text, "Schema Changes").slice(0, 800),
    ad_copy_samples:       extractBlock(text, "Ad Copy Samples").slice(0, 1200),
  };
}

async function scanOne(cfg, comp, mode, dryRun) {
  const runId = genRunId();
  const scanStart = isoNow();

  const page = await fetchPage(comp.url);
  if (page.status !== 200) {
    console.error(`[espia] fetch failed ${comp.name}: status=${page.status} err=${page.error || ""}`);
    if (!dryRun) {
      await airtableCreate(cfg, TABLE_KEY, {
        run_id: runId,
        tenant_id: cfg.tenant_id,
        competitor_name: comp.name,
        competitor_url: comp.url,
        status: "Failed",
        trigger: process.env.ESPIA_TRIGGER || "alex_manual",
        scanned_at: scanStart,
      });
    }
    return { comp, status: page.status, severity: null };
  }

  const snap = extractHtml(page.html);
  const prior = await priorScan(cfg, comp.url);
  const prompt = buildPrompt(cfg, comp, snap, prior, page.status);

  if (dryRun) {
    console.log(`\n=== DRY RUN [espia] ${comp.name} ===`);
    console.log(`status: ${page.status}, word_count: ${snap.word_count}`);
    console.log(`prior_exists: ${!!prior}`);
    console.log("\n--- PROMPT ---\n", prompt);
    return { comp, status: page.status, severity: null, dryRun: true };
  }

  await airtableCreate(cfg, TABLE_KEY, {
    run_id: runId,
    tenant_id: cfg.tenant_id,
    competitor_name: comp.name,
    competitor_url: comp.url,
    status: "Running",
    trigger: process.env.ESPIA_TRIGGER || "alex_manual",
    scanned_at: scanStart,
    title_tag: snap.title,
    h1_text: snap.h1,
    hero_copy_snippet: snap.hero,
    word_count: snap.word_count,
    cta_buttons: snap.ctas,
    pricing_observed: snap.pricing,
    offers_observed: snap.offers,
    phone_numbers: snap.phones,
    addresses: snap.addresses,
    social_links: snap.socials,
    raw_html_snippet: page.html.slice(0, 10_000),
  });

  let out = "";
  try {
    out = await runClaude(cfg.claude.binary_path, prompt);
  } catch (e) {
    await airtableUpsert(cfg, TABLE_KEY, runId, { status: "Failed" });
    return { comp, status: page.status, severity: null, error: e.message };
  }

  const parsed = parseOutput(out);
  const scanEnd = isoNow();
  const duration = Math.round((Date.parse(scanEnd) - Date.parse(scanStart)) / 1000);

  await airtableUpsert(cfg, TABLE_KEY, runId, {
    status: "Done",
    duration_sec: duration,
    ...parsed,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  const mdPath = join(OUTPUT_DIR, `${runId}.md`);
  await writeFile(mdPath, out, "utf8");

  return { comp, status: page.status, severity: parsed.change_severity, parsed, runId };
}

async function main() {
  const args = parseArgs(process.argv, VALID_MODES, { competitor: null });
  const cfg = await loadTenant(args.tenant);
  console.error(`[espia] tenant=${cfg.tenant_id} mode=${args.mode} dry_run=${args.dryRun}`);

  let targets = cfg.competitors || [];
  if (args.mode === "on_demand" && args.competitor) {
    targets = [{ name: new URL(args.competitor).hostname, url: args.competitor }];
  }
  if (targets.length === 0) {
    console.error("[espia] no competitors configured in tenant.competitors — exiting");
    return;
  }

  const results = [];
  for (const comp of targets) {
    const res = await scanOne(cfg, comp, args.mode, args.dryRun);
    results.push(res);
    await new Promise(r => setTimeout(r, 1100)); // 1s rate limit
  }

  if (args.dryRun) {
    console.log(`\n[espia] dry-run complete. ${results.length} competitors.`);
    return;
  }

  // Telegram digest
  const byName = results.map(r => {
    const sev = r.severity;
    const emoji = sev == null ? "⚪"
      : sev >= 9 ? "🚨"
      : sev >= 6 ? "⚠️"
      : sev >= 3 ? "🟡"
      : "✅";
    return `${emoji} ${r.comp.name}: sev ${sev ?? "n/a"}/10`;
  }).join("\n");

  const topAlerts = results
    .filter(r => (r.severity ?? 0) >= 6)
    .map(r => `\n*${r.comp.name}* (sev ${r.severity}/10)\n${(r.parsed?.changes_summary || "").slice(0, 400)}\n→ ${(r.parsed?.recommended_action || "").slice(0, 300)}`)
    .join("\n---");

  const msg = `🕵️ *El Espía — ${cfg.tenant_name}*\nmode \`${args.mode}\` · ${results.length} competitors scanned\n\n${byName}${topAlerts ? `\n\n*Significant changes:*${topAlerts}` : ""}`;
  await telegramSend(cfg, msg.slice(0, 3900));

  console.error(`[espia] done competitors=${results.length}`);
}

main().catch(e => { console.error("[espia] FATAL:", e); process.exit(1); });
