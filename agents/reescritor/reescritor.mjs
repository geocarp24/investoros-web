#!/usr/bin/env node
/**
 * El Reescritor — Learning loop between Oráculo and SM Manager.
 *
 * Mission (Jorge 2026-05-07): "el Reescritor rediseñe el o los prompts y le
 * enseñe al Social Media Manager, y este aprenda a reescribir pero no solo a
 * reescribir pero a escribir de una vez las ideas acorde a lo que el Oráculo
 * le ha venido enseñando."
 *
 * Pipeline:
 *   SM Manager → idea (Status=Nueva)
 *     ↓ Oráculo review
 *     ↓ REJECT → Error_Reason set with critique
 *   Reescritor (this agent):
 *     1. Reads each rejected record + Oráculo critique
 *     2. Sonnet rewrites Hook / Caption ES/EN / Visual_Prompt to address feedback
 *     3. Appends a structured lesson to oraculo_inputs/sm_lessons.md
 *     4. Patches record (new fields, Error_Reason cleared, ready for re-review)
 *
 * SM Manager reads sm_lessons.md before generating new ideas → ideas get better
 * over time → Oráculo rejects less → "el oráculo va trabajando cada vez menos".
 *
 * Cost: ~$0.005/record (Sonnet input ~2k + output ~1k).
 */

import { parseArgs, loadTenant, telegramSend, genRunId, isoNow } from "../_shared/runner.mjs";
import { SM_BASE_ID as SM_BASE, SM_TOKEN, SM_TABLES, STATUS } from "../_shared/sm_tables.mjs";
import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ORACULO_DIR = join(__dirname, "..", "oraculo_inputs");
const LESSONS_FILE = join(ORACULO_DIR, "sm_lessons.md");

const VALID_MODES = ["batch", "one"];

const ANTHROPIC_KEY=[REDACTED] || "";
const SONNET_MODEL  = "claude-sonnet-4-6";

const BATCH_MAX_PER_RUN = Number(process.env.REESCRITOR_BATCH_MAX || 8);

// ─── Persona context (cached) ───
let _personaCache = null;
async function loadPersona() {
  if (_personaCache !== null) return _personaCache;
  try {
    _personaCache = (await readFile(join(ORACULO_DIR, "wi_homeowner_persona.md"), "utf8")).slice(0, 4000);
  } catch { _personaCache = ""; }
  return _personaCache;
}

// ─── Airtable SM helpers ───
async function smFetch(tableId, params = "") {
  const r = await fetch(`https://api.airtable.com/v0/${SM_BASE}/${tableId}?${params}`, {
    headers: { Authorization: `Bearer ${SM_TOKEN}` },
  });
  return r.json();
}
async function smUpdate(tableId, recordId, fields) {
  const r = await fetch(`https://api.airtable.com/v0/${SM_BASE}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SM_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return r.json();
}
async function smGet(tableId, recordId) {
  const r = await fetch(`https://api.airtable.com/v0/${SM_BASE}/${tableId}/${recordId}`, {
    headers: { Authorization: `Bearer ${SM_TOKEN}` },
  });
  return r.json();
}

// ─── Sonnet rewrite + lesson extraction ───
// New 3-table architecture (2026-05-07): each record is single-language.
// rewriteRecord receives format ("Post" | "Reel" | "Video") and the record's
// language so the rewrite stays in the same language only.
async function rewriteRecord(record, persona, format) {
  const f = record.fields || {};
  const titulo = f.Title || "";
  const lang   = String(f.Language || "ES").toUpperCase();
  const tipo   = f.Tipo || "";
  const errorReason = f.Error_Reason || "";

  // Pull format-specific source content.
  let hook, caption, cta, visualHints;
  if (format === "Reel") {
    hook = f.Slide_1_Hook || "";
    caption = [f.Slide_2_Text, f.Slide_3_Text, f.Slide_4_Text].filter(Boolean).join(" / ");
    cta = f.Slide_5_CTA || "";
    visualHints = [f.Slide_2_Visual, f.Slide_3_Visual, f.Slide_4_Visual].filter(Boolean).join(" | ");
  } else if (format === "Video") {
    hook = f.Hook || "";
    caption = [f.Main_Message, f.Script_Outline].filter(Boolean).join(" / ");
    cta = f.CTA || "";
    visualHints = f.Script_Outline || "";
  } else { // Post
    hook = f.Hook || "";
    caption = f.Caption || "";
    cta = f.CTA || "";
    visualHints = f.Visual_Concept || "";
  }

  const langLabel = lang === "EN" ? "English" : "Spanish";

  // Build per-format JSON shape spec for the rewrite output.
  let outputShape;
  if (format === "Reel") {
    outputShape = `{
  "title": "${langLabel} title (max 80 chars)",
  "hook": "${langLabel} hook for Slide_1 (5-7 words, opens curiosity to a SPECIFIC distressed segment)",
  "slide_2_text": "${langLabel} 8-14 words — point 1, derived from original message",
  "slide_2_visual": "Pexels search query 4-6 words | flux: cinematic prompt 12-20 words",
  "slide_3_text": "${langLabel} 8-14 words — point 2",
  "slide_3_visual": "same format as slide_2_visual",
  "slide_4_text": "${langLabel} 8-14 words — point 3",
  "slide_4_visual": "same format",
  "slide_5_cta": "${langLabel} closing CTA 5-7 words including phone (920) 777-9886",
  "caption": "Full IG/FB caption 200-400 chars in ${langLabel}, ends with phone + pinnaclegroupwi.com",
  "theme_code": "T1|T2|T3|T4|T5",
  "template": "hybrid|pip|voiceover|talkinghead|editorial — pick the template that best matches the record's Tipo. talkinghead = full-screen Jorge speaking (script-driven, no slides). hybrid = Jorge in hook+CTA + slides for points. voiceover = no avatar, slides + voice over. editorial = 70/30 split. pip = Jorge in corner.",
  "lesson": { "rejected_pattern":"...", "oraculo_critique_summary":"...", "rewrite_pattern":"...", "segment_anchor":"Pre-Foreclosure|Inherited|Divorce|Back-Taxes|Tired-Landlord|Relocation" }
}`;
  } else if (format === "Video") {
    outputShape = `{
  "title": "${langLabel} title",
  "hook": "${langLabel} 3-second opening hook",
  "main_message": "${langLabel} core narrative 1-2 paragraphs",
  "script_outline": "${langLabel} segmented script with timecodes",
  "cta": "${langLabel} CTA with phone + website",
  "caption": "Full caption 200-400 chars in ${langLabel}",
  "theme_code": "T1|T2|T3|T4|T5",
  "template": "hybrid|pip|voiceover|editorial",
  "lesson": { ... same shape as Reel }
}`;
  } else { // Post
    outputShape = `{
  "title": "${langLabel} title (max 80 chars)",
  "hook": "${langLabel} 1-line hook (max 100 chars, opens curiosity to a SPECIFIC distressed segment)",
  "caption": "${langLabel} 200-400 chars, ends with phone (920) 777-9886 + pinnaclegroupwi.com",
  "cta": "Single-line ${langLabel} CTA (max 100 chars)",
  "visual_concept": "Pexels query OR FLUX prompt for the editorial bg",
  "theme_code": "T1|T2|T3|T4|T5",
  "lesson": { ... same shape }
}`;
  }

  const systemPrompt = `You are El Reescritor — Pinnacle Holdings' content rewriter. Your job: take a ${format} record El Oráculo rejected and rewrite it to pass the gate while preserving the original concept.

This record is in ${langLabel} (Language=${lang}). DO NOT mix languages — output 100% in ${langLabel}.

Output ONLY a JSON object — no prose, no markdown fences:
${outputShape}

REWRITE PRINCIPLES (apply ALL):
1. Anchor to ONE distressed segment from the 6 — pick the most relevant.
2. Frame from the homeowner's POV (their pain, their fear, their relief), NOT from Pinnacle's POV.
3. Warm tone, no investor jargon (no ROI / cap rate / off-market / deal / flip).
4. ${lang === "ES" ? "Spanish must have perfect ortografía (acentos á é í ó ú, ñ)." : "English must be natural and warm, no marketing-speak."}
5. NO FTC red flags ("guaranteed", "no risk", "100%").
6. NO HUD Fair Housing violations.
7. NO promotion of homosexuality in visual concepts.
8. CTA / caption must include phone (920) 777-9886 AND pinnaclegroupwi.com.
${format === "Reel" ? "9. Reels are 5 slides × 2s = 10s total. Each slide_N_text must be a substantive line (NOT generic placeholder). For Tipo=Personal use template=hybrid (Jorge in hook+CTA, b-roll on points)." : ""}
${format === "Video" ? "9. Videos are 30-90s longer-form, segmented script with timecodes." : ""}

[AUDIENCE PERSONA]
${persona}`;

  const userPrompt = `ORIGINAL ${format.toUpperCase()} (rejected by Oráculo):

Título: ${titulo}
Tipo: ${tipo} | Language: ${lang}

Hook actual:
${hook}

Caption / Slides actual:
${(caption || "").slice(0, 600)}

CTA actual: ${cta}

Visual hints:
${(visualHints || "").slice(0, 400)}

ORACULO REJECTION FEEDBACK:
${errorReason}

Rewrite to address the feedback (stay in ${langLabel} only). Return JSON only.`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Sonnet HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const text = j.content?.[0]?.text || "";
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error(`Sonnet: no JSON in response: ${text.slice(0, 100)}`);
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(cleaned.slice(start, i + 1));
      }
    }
  }
  throw new Error("Sonnet: unbalanced JSON");
}

// ─── Append lesson to sm_lessons.md (rolling window, last 50) ───
async function appendLesson(titulo, lesson) {
  const date = isoNow().slice(0, 10);
  const entry = [
    "",
    `### ${date} — ${titulo.slice(0, 60)}`,
    `- **Rejected pattern**: ${lesson.rejected_pattern || "—"}`,
    `- **Oráculo critique**: ${lesson.oraculo_critique_summary || "—"}`,
    `- **Rewrite pattern**: ${lesson.rewrite_pattern || "—"}`,
    `- **Segment anchor**: ${lesson.segment_anchor || "—"}`,
    "",
  ].join("\n");

  // Append to file (creates if missing).
  try {
    await mkdir(ORACULO_DIR, { recursive: true });
    await appendFile(LESSONS_FILE, entry, "utf8");
  } catch (e) {
    console.error(`[reescritor] failed to append lesson: ${e.message}`);
  }

  // Roll the window: if file has > 100 lessons, keep only the last 50.
  try {
    const text = await readFile(LESSONS_FILE, "utf8");
    const blocks = text.split(/\n### /).filter(Boolean);
    // First block is the header (no ### prefix). Re-split keeping that.
    const headerEnd = text.indexOf("\n### ");
    const header = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
    const lessonBlocks = headerEnd >= 0 ? text.slice(headerEnd).split(/\n(?=### )/).filter(Boolean) : [];
    if (lessonBlocks.length > 100) {
      const kept = lessonBlocks.slice(-50);
      await writeFile(LESSONS_FILE, header + "\n" + kept.join("\n"), "utf8");
    }
  } catch {}
}

// ─── Process one rejected record ───
async function processOne(record, persona, tableId, format) {
  const f = record.fields || {};
  const titulo = f.Title || record.id;

  let rewrite;
  try {
    rewrite = await rewriteRecord(record, persona, format);
  } catch (e) {
    return { id: record.id, titulo, status: "rewrite_failed", error: String(e.message).slice(0, 150) };
  }

  // Build per-format update — only fields relevant to the format are written.
  // Status flips back to 'Idea' so Oráculo will re-review on next run.
  const updateFields = {
    Status: STATUS.IDEA,
    Error_Reason: "",
  };
  if (rewrite.title) updateFields.Title = rewrite.title;
  if (rewrite.theme_code) updateFields.Theme_Code = rewrite.theme_code;
  if (rewrite.lesson?.segment_anchor) updateFields.Segment_Anchor = rewrite.lesson.segment_anchor;

  if (format === "Reel") {
    if (rewrite.hook)            updateFields.Slide_1_Hook  = rewrite.hook;
    if (rewrite.slide_2_text)    updateFields.Slide_2_Text  = rewrite.slide_2_text;
    if (rewrite.slide_2_visual)  updateFields.Slide_2_Visual = rewrite.slide_2_visual;
    if (rewrite.slide_3_text)    updateFields.Slide_3_Text  = rewrite.slide_3_text;
    if (rewrite.slide_3_visual)  updateFields.Slide_3_Visual = rewrite.slide_3_visual;
    if (rewrite.slide_4_text)    updateFields.Slide_4_Text  = rewrite.slide_4_text;
    if (rewrite.slide_4_visual)  updateFields.Slide_4_Visual = rewrite.slide_4_visual;
    if (rewrite.slide_5_cta)     updateFields.Slide_5_CTA   = rewrite.slide_5_cta;
    if (rewrite.caption)         updateFields.Caption       = rewrite.caption;
    if (rewrite.template)        updateFields.Template      = rewrite.template;
  } else if (format === "Video") {
    if (rewrite.hook)           updateFields.Hook           = rewrite.hook;
    if (rewrite.main_message)   updateFields.Main_Message   = rewrite.main_message;
    if (rewrite.script_outline) updateFields.Script_Outline = rewrite.script_outline;
    if (rewrite.cta)            updateFields.CTA            = rewrite.cta;
    if (rewrite.caption)        updateFields.Caption        = rewrite.caption;
    if (rewrite.template)       updateFields.Template       = rewrite.template;
  } else { // Post
    if (rewrite.hook)           updateFields.Hook           = rewrite.hook;
    if (rewrite.caption)        updateFields.Caption        = rewrite.caption;
    if (rewrite.cta)            updateFields.CTA            = rewrite.cta;
    if (rewrite.visual_concept) updateFields.Visual_Concept = rewrite.visual_concept;
  }

  try {
    await smUpdate(tableId, record.id, updateFields);
  } catch (e) {
    return { id: record.id, titulo, status: "update_failed", error: String(e.message).slice(0, 150) };
  }

  if (rewrite.lesson) {
    await appendLesson(titulo, rewrite.lesson);
  }

  return {
    id: record.id, titulo, status: "rewritten",
    format,
    new_title: rewrite.title,
    segment_anchor: rewrite.lesson?.segment_anchor,
    rewrite_pattern: rewrite.lesson?.rewrite_pattern,
  };
}

// ─── Main ───
async function main() {
  const args = parseArgs(process.argv, VALID_MODES, { recordId: "" });
  const cfg = await loadTenant(args.tenant);
  const runId = genRunId();
  const startedAt = isoNow();

  console.error(`[reescritor] tenant=${cfg.tenant_id} mode=${args.mode} run_id=${runId}`);

  if (!ANTHROPIC_KEY) {
    console.error("[reescritor] ANTHROPIC_API_KEY missing — cannot rewrite without Sonnet");
    process.exit(2);
  }

  const persona = await loadPersona();

  // 3-table architecture: loop over Posts/Reels/Videos, find Status=Rechazada records.
  let pending = [];   // [{ tableId, format, record }, ...]
  if (args.mode === "one") {
    if (!args.recordId) { console.error("[reescritor] --record-id required"); process.exit(2); }
    for (const t of SM_TABLES) {
      try {
        const rec = await smGet(t.id, args.recordId);
        if (rec.id) { pending.push({ tableId: t.id, format: t.format, record: rec }); break; }
      } catch {}
    }
  } else {
    const filter = encodeURIComponent(`{Status}='${STATUS.RECHAZADA}'`);
    for (const t of SM_TABLES) {
      const r = await smFetch(t.id, `filterByFormula=${filter}&maxRecords=${BATCH_MAX_PER_RUN}`);
      for (const rec of (r.records || [])) {
        if (pending.length >= BATCH_MAX_PER_RUN) break;
        pending.push({ tableId: t.id, format: t.format, record: rec });
      }
      if (pending.length >= BATCH_MAX_PER_RUN) break;
    }
  }

  if (pending.length === 0) {
    console.error("[reescritor] no Oráculo-rejected records pending");
    await telegramSend(cfg, `✍️ *El Reescritor* — ${cfg.tenant_name}\nNo hay rejections pendientes de rewrite.`);
    return;
  }

  if (args.dryRun) {
    console.log(`=== DRY RUN [reescritor] ${pending.length} records ===`);
    for (const it of pending) console.log(`  [${it.format}] ${it.record.id} | ${it.record.fields?.Title}`);
    return;
  }

  const results = [];
  for (const item of pending) {
    const { tableId, format, record: rec } = item;
    let out;
    try { out = await processOne(rec, persona, tableId, format); }
    catch (e) {
      out = { id: rec.id, titulo: rec.fields?.Title || rec.id, status: "exception", error: String(e?.message || e).slice(0, 200), format };
    }
    out.format = out.format || format;
    results.push(out);
    console.error(`[reescritor] [${format}] ${out.titulo}: ${out.status}${out.segment_anchor ? ` → ${out.segment_anchor}` : ""}${out.error ? ` — ${out.error}` : ""}`);
  }

  const completedAt = isoNow();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);
  const rewritten = results.filter(r => r.status === "rewritten").length;
  const failed   = results.filter(r => /failed|exception/.test(r.status)).length;

  const lines = [
    `✍️ *El Reescritor* — ${cfg.tenant_name}`,
    `${duration}s · ✅ ${rewritten} rewritten${failed ? ` · ⚠️ ${failed} failed` : ""}`,
  ];
  for (const r of results.slice(0, 6)) {
    const icon = r.status === "rewritten" ? "✍️" : "⚠️";
    lines.push(`${icon} ${(r.titulo || "").slice(0, 50)}${r.segment_anchor ? ` → ${r.segment_anchor}` : ""}`);
    if (r.rewrite_pattern) lines.push(`   ${r.rewrite_pattern.slice(0, 110)}`);
  }
  await telegramSend(cfg, lines.join("\n").slice(0, 3800));

  console.error(`[reescritor] done — rewritten=${rewritten} failed=${failed}`);
}

main().catch((e) => { console.error("[reescritor] FATAL:", e); process.exit(1); });
