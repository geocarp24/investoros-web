#!/usr/bin/env node
/**
 * Social Media — full pipeline orchestrator (Pinnacle Holdings).
 *
 * Modes:
 *   generate_ideas    — Sonnet 4.6 generates N new ideas, stores in Airtable.
 *   process_posts     — for ideas with visual_url + Status=Visual Listo and no
 *                       Published_Post_IDs, schedule on FB + IG via Meta Graph API.
 *   full_pipeline     — generate_ideas → process_posts.
 *
 * Visual generation (was process_visuals via Blotato) is now handled by:
 *   • El Creativo runner (Puppeteer carousels)
 *   • El Director v2 runner (Reels via HeyGen + FLUX2)
 * Both have their own crons and read Airtable directly.
 *
 * Cron: every 3 days from agents-cron.yml. Each run aims to publish 1-3 posts.
 *
 * 2026-05-07: Blotato deprecated by Jorge — all publishing migrated to direct
 *             Meta Graph API. See `graph_api.mjs` for the publisher functions.
 */
import { parseArgs, loadTenant, telegramSend, genRunId, isoNow } from "../_shared/runner.mjs";
import {
  SM_BASE_ID as SM_BASE, SM_POSTS_TABLE_ID, SM_REELS_TABLE_ID, SM_VIDEOS_TABLE_ID,
  SM_TABLES, SM_TOKEN as SHARED_SM_TOKEN, STATUS,
} from "../_shared/sm_tables.mjs";
import {
  publishFacebookPhotoPost, publishFacebookReel,
  publishInstagramReel, publishInstagramCarousel, publishInstagramImage,
  getInstagramUserId, getPageAccessToken,
} from "./graph_api.mjs";
// Sprint A1.1+ (2026-05-08): fixed-slot scheduling + helpers for slot-driven publish.
import { getNextFixedSlot } from "./scheduling.mjs";
import {
  buildPublisherFilter,
  selectFieldPublishedId,
  selectPublisherFn,
  isVideoUrl,
  validatePublisherArgs,
} from "./publisher_helpers.mjs";
// Sprint A6 (2026-05-08): Theme Bank guided idea generation.
// Sprint A12 (2026-05-08): force format mix to match cadence slot inventory.
import {
  loadThemeBank,
  pickBatch,
  makePlatformAssigner,
  decideFormat,
  applyFormatDistribution,
  WEEKLY_FORMAT_MIX,
} from "./theme_bank_loader.mjs";
// Sprint A7 (2026-05-08): Director v2 template rotation for visual variety.
import { makeTemplateRotator } from "./template_rotator.mjs";

const VALID_MODES = ["generate_ideas", "process_posts", "full_pipeline", "batch_weekly"];

// SM_TOKEN — fall back to the legacy hardcoded value if neither env nor shared module has it.
const SM_TOKEN = SHARED_SM_TOKEN
  || process.env.SM_AIRTABLE_TOKEN
  || "[REDACTED_AIRTABLE_PAT]";

// ── Meta Graph API config ──
// META_USER_TOKEN: long-lived User Access Token from "Pinnacle Social Publisher" app.
// META_PAGE_ACCESS_TOKEN (optional): pre-resolved Page token. If absent, derived from User token via /me/accounts.
const META_USER_TOKEN = process.env.META_USER_TOKEN || "";
const META_PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || "";
const FB_PAGE_ID      = "965320503341457";  // Pinnacle Holdings Group

// ── Airtable field names (source of truth, kept in one place for easy rename) ──
// NOTE 2026-05-07: legacy field names "Blotato_*" still hold the data — Jorge will rename in Airtable UI.
//   Blotato_Visual_ID  → carousel slide URLs (pipe-separated, prefix `puppeteer:N_slides|`)
//   Blotato_Post_IDs   → published media IDs after FB/IG publish (`fb:<id>,ig:<id>`)
const FIELD_CAROUSEL_URLS      = "Blotato_Visual_ID";
const FIELD_PUBLISHED_POST_IDS = "Blotato_Post_IDs";

// ── Caps ──
const IDEAS_PER_RUN   = 3;
// Sprint A6 (Jorge 2026-05-08): batch_weekly generates a full week of records
// in one Anthropic call. 78 = 12 slots × 6.5 days average (FB+IG combined).
const IDEAS_PER_BATCH = Number(process.env.IDEAS_PER_BATCH || 78);
// Override via POSTS_PER_RUN env (used for limited test runs).
const POSTS_PER_RUN   = Number(process.env.POSTS_PER_RUN || 5);
const POLL_MAX_SEC   = 300;
const POLL_INTERVAL  = 15;

// Backlog gate (Jorge 2026-05-08): if too many records already rendered and
// waiting for Publisher, skip generation. Prevents the queue from ballooning
// past what the Publisher (3 slots/week in WARMUP) can clear.
const BACKLOG_GATE_MAX = Number(process.env.BACKLOG_GATE_MAX || 30);

async function countVisualListoBacklog() {
  const filter = encodeURIComponent(`{Status}='Visual Listo'`);
  let total = 0;
  for (const t of SM_TABLES) {
    let offset = "";
    do {
      const url = `https://api.airtable.com/v0/${SM_BASE}/${t.id}?filterByFormula=${filter}&pageSize=100${offset ? `&offset=${offset}` : ""}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${SM_TOKEN}` } });
      if (!r.ok) break;
      const data = await r.json();
      total += (data.records || []).length;
      offset = data.offset || "";
    } while (offset);
  }
  return total;
}

// ──────────────────────────────────────────────────────────────
// Airtable helpers — 3-table aware (Posts/Reels/Videos)
// ──────────────────────────────────────────────────────────────
async function smCreateIn(tableId, fields) {
  const r = await fetch(`https://api.airtable.com/v0/${SM_BASE}/${tableId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SM_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return r.json();
}
async function smFetchIn(tableId, params = "") {
  const r = await fetch(`https://api.airtable.com/v0/${SM_BASE}/${tableId}?${params}`, {
    headers: { Authorization: `Bearer ${SM_TOKEN}` },
  });
  return r.json();
}
async function smUpdateIn(tableId, recordId, fields) {
  const r = await fetch(`https://api.airtable.com/v0/${SM_BASE}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SM_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return r.json();
}

// ──────────────────────────────────────────────────────────────
// Anthropic API (re-implement here so this runner is self-contained)
// ──────────────────────────────────────────────────────────────
async function callAnthropic(systemPrompt, userPrompt, maxTokens = 1500) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY missing", text: null };
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return { error: `HTTP ${r.status}: ${errText.slice(0, 200)}`, text: null };
    }
    const j = await r.json();
    return { text: j.content?.[0]?.text || "", error: null };
  } catch (e) {
    return { error: e.message, text: null };
  }
}

function parseFirstJSON(text) {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function parseAllJSON(text) {
  // Extract array of JSON objects from a wrapper like {"ideas": [...]}.
  const obj = parseFirstJSON(text);
  if (obj?.ideas && Array.isArray(obj.ideas)) return obj.ideas;
  if (Array.isArray(obj)) return obj;
  return obj ? [obj] : [];
}

// ──────────────────────────────────────────────────────────────
// Lessons learned from Oráculo (curated by Reescritor) — read at every run
// so SM Manager improves over time and Oráculo rejects less.
// Jorge 2026-05-07: "el oráculo va trabajando cada vez menos".
// ──────────────────────────────────────────────────────────────
// Append a STRUCTURAL lesson immediately when SM Manager rejects a malformed
// idea pre-create. This makes next generation cycle learn from the same-run
// failure (no need to wait for Oráculo + Reescritor to teach the same thing).
async function appendStructuralLesson(rule) {
  try {
    const { appendFile, mkdir } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const path = join(__dirname, "..", "oraculo_inputs", "sm_lessons.md");
    const date = new Date().toISOString().slice(0, 10);
    const entry = `\n### ${date} — Structural reject (SM Manager self-validation)\n- **Rejected pattern**: ${rule}\n- **Source**: SM Manager pre-create validation (saves Oráculo + Reescritor cycles)\n- **Rule for next generation**: read this lesson at startup, NEVER produce an idea matching this pattern\n`;
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, entry, "utf8");
  } catch (e) { console.error(`[sm] failed to append structural lesson: ${e.message}`); }
}

async function loadLessons() {
  try {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const path = join(__dirname, "..", "oraculo_inputs", "sm_lessons.md");
    const text = await readFile(path, "utf8");
    // Truncate to last 4000 chars (most recent lessons matter most).
    return text.length > 4000 ? "..." + text.slice(-4000) : text;
  } catch { return ""; }
}

// ──────────────────────────────────────────────────────────────
// Mode 1 — Generate ideas (Anthropic)
// Sprint A6 (Jorge 2026-05-08): accepts optional count override for batch_weekly mode.
// ──────────────────────────────────────────────────────────────
async function generateIdeas(cfg, runId, { count = IDEAS_PER_RUN } = {}) {
  // Backlog gate — abort if too many Visual Listo records already waiting.
  const backlog = await countVisualListoBacklog();
  if (backlog > BACKLOG_GATE_MAX) {
    const msg = `[generate_ideas] BACKLOG GATE blocked: ${backlog} Visual Listo records exceed cap of ${BACKLOG_GATE_MAX}. Skipping generation. Clear the queue (publish or delete) before generating new ideas.`;
    console.log(msg);
    await telegramSend(msg);
    return { skipped: true, backlog, gate: BACKLOG_GATE_MAX };
  }
  console.log(`[generate_ideas] backlog=${backlog} (gate=${BACKLOG_GATE_MAX}) — proceeding`);

  const lessons = await loadLessons();
  const lessonsBlock = lessons
    ? `\n\n[LESSONS LEARNED FROM ORACULO — apply these on every idea you generate]\n${lessons}\n[END LESSONS]\n\nFollow the rewrite_pattern from each lesson above. Do NOT repeat any rejected_pattern.`
    : "";

  const systemPrompt = `You are the Social Media Agent for Pinnacle Holdings Group LLC, a real estate cash home buyer in Wisconsin. Owner: Jorge Cruz. Phone: (920) 777-9886. Web: pinnaclegroupwi.com.

You generate post ideas optimized for Instagram + Facebook. Audience: distressed homeowners (foreclosure, inherited property, divorce, back taxes, relocation). 70% educational, 20% promotional, 10% personal.

VIDEO LENGTH RULE (Jorge 2026-05-07 — non-negotiable): Reels MUST be 7-15 seconds — NEVER more. If a concept genuinely needs more time, split it into a SERIES across multiple Reel records: title "Topic — Parte 1", "Topic — Parte 2", etc. Each part max 15s. Set "tipo": "Educativo" with title prefix "Parte N — " when it's part of a series.${lessonsBlock}

Output ONLY a JSON object: { "ideas": [ {idea1}, {idea2}, ... ] }. No prose outside JSON.

Each idea schema:
{
  "title_es": "string — short title in Spanish",
  "title_en": "string — short title in English",
  "tipo": "Educativo" | "Promocional" | "Testimonio" | "Mito" | "Pregunta",
  "formato": "Post" | "Carrusel",
  "hook_es": "1 line, opens curiosity",
  "caption_es": "200-400 chars, with emojis, ends with CTA + phone (920) 777-9886",
  "caption_en": "200-400 chars, English equivalent",
  "hashtags": "5 hashtags max, no #",
  "cta": "1 short imperative line",
  "visual_prompt": "TITLE: [es title]\\nTEMA: T1 Dark Premium\\n\\n[6-8 lines describing slides for AI Slide Generator: Slide 1 hook + slide 2-5 content + final CTA slide]",
  "tema_color": "T1" | "T2" | "T3" | "T4" | "T5"
}

Themes: T1 Dark Premium (default educational), T2 White Clean (data/FAQ), T3 Gold Black (urgency/foreclosure), T4 Soft Cream (testimonios/herencia), T5 Vibrant Blue (high engagement young).`;

  // Updated system prompt for 3-table schema with bilingual split.
  // Each idea generates 2 records: 1 ES + 1 EN linked by Source_Idea_ID.
  const newSystemPrompt = `You are the Social Media Agent for Pinnacle Holdings Group LLC, a real estate cash home buyer in Wisconsin. Owner: Jorge Cruz. Phone: (920) 777-9886. Web: pinnaclegroupwi.com.

You generate post ideas optimized for Instagram + Facebook. Audience: distressed homeowners (foreclosure, inherited property, divorce, back taxes, relocation). 70% educational, 20% promotional, 10% personal.

VIDEO LENGTH RULE (Jorge 2026-05-07 — non-negotiable): Reels MUST be 8-10 seconds = exactly 5 slides × 2s. NEVER more. If a concept needs more time, split into series "Topic — Parte 1", "Topic — Parte 2", etc. Each part = 1 separate idea.${lessonsBlock}

Output ONLY a JSON object: { "ideas": [...] }. No prose outside JSON.

Each idea schema (BILINGUAL — generate BOTH es and en for every field):
{
  "format": "Post" | "Reel" | "Video",
  "tipo": "Educativo" | "Promocional" | "Testimonio" | "Mito" | "Pregunta" | "Personal",
  "segment_anchor": "Pre-Foreclosure" | "Inherited" | "Divorce" | "Back-Taxes" | "Tired-Landlord" | "Relocation",
  "title_es": "string", "title_en": "string",
  "hook_es": "string", "hook_en": "string",
  "caption_es": "200-400 chars ES, perfect ortografía", "caption_en": "200-400 chars EN",
  "cta_es": "single line", "cta_en": "single line",
  "hashtags_es": "5 hashtags", "hashtags_en": "5 hashtags",
  "theme_code": "T1"|"T2"|"T3"|"T4"|"T5",
  "visual_concept": "Pexels query OR FLUX prompt — for Posts only",
  "reel": {
    "template": "hybrid|pip|voiceover|editorial",
    "music": "chill|cinematic|tension|upbeat-1",
    "slides_es": [
      {"hook": "5-7 PALABRAS español"},
      {"text": "8-14 palabras español, sustantivo", "visual": "pexels query | flux: prompt"},
      {"text": "8-14 palabras español", "visual": "..."},
      {"text": "8-14 palabras español", "visual": "..."},
      {"cta": "5-7 palabras español con (920) 777-9886"}
    ],
    "slides_en": [
      {"hook": "5-7 WORDS English"},
      {"text": "8-14 words English, substantive", "visual": "pexels query | flux: prompt"},
      {"text": "8-14 words English", "visual": "..."},
      {"text": "8-14 words English", "visual": "..."},
      {"cta": "5-7 words English with (920) 777-9886"}
    ]
  }
}

HARD RULES (Reel idea is REJECTED if any violated):
- For Reels you MUST include reel.slides_es AND reel.slides_en — ALWAYS BOTH, ALWAYS 5 elements each.
- Slides 2/3/4 MUST have non-empty "text" field (8-14 words) — NEVER leave blank or use placeholder.
- Each slide_2/3/4 visual MUST have format "<pexels query> | flux: <flux prompt>".
- Slide 1 MUST have "hook" field. Slide 5 MUST have "cta" field including phone (920) 777-9886.
- For Posts: include hook + caption + cta + visual_concept (no "reel" key).
- For Videos: include hook + caption + main_message + script_outline + cta (no "reel" key).
- ALL bilingual fields require BOTH _es and _en versions populated. Never leave EN blank if it's a bilingual field.`;

  // Sprint A6 (Jorge 2026-05-08): replace free-form topic list with Theme Bank
  // weighted picks. SM Manager now generates ideas from a curated catalog of
  // 170 subtopics across 8 pillars, balanced by pillar weight_pct.
  let themeBank;
  try { themeBank = loadThemeBank(); }
  catch (e) { return { created: 0, error: `theme bank load failed: ${e.message}` }; }
  const recentTitles = await getRecentTitles();
  const picks = pickBatch(themeBank, count);
  if (picks.length === 0) return { created: 0, error: "theme bank pickBatch returned 0 picks" };

  const topicsBlock = picks.map((p, i) => `
${i + 1}. PILLAR: ${p.pillar.name_en} (id=${p.pillar.id})
   SUBTOPIC_ID: ${p.subtopic.id}
   TITLE_EN: ${p.subtopic.title_en}
   TITLE_ES: ${p.subtopic.title_es}
   HOOK_IDEA: ${p.subtopic.hook}
   FORMAT_HINT: ${decideFormat(p.pillar, p.subtopic)}
   FUNNEL_STAGE: ${p.subtopic.funnel}
   COLOR_THEME: ${p.pillar.color_theme_default || "T1"}
   TONE: ${p.pillar.tone || "neutral"}`).join("\n");

  const userPrompt = `Generate exactly ${picks.length} ideas — ONE for EACH topic listed below from the curated Theme Bank. The titles were chosen strategically — refine wording if needed but keep the spirit. The format hint, funnel stage, and tone guide your output.

${topicsBlock}

Avoid duplicating these recent titles (last 14 days):
${recentTitles.join(" / ") || "(none)"}

Return JSON only — for EACH topic above, generate one idea with both ES and EN versions in EVERY bilingual field. Use the SUBTOPIC_ID as a reference but DO NOT include it in the output JSON.`;

  // Larger batch needs higher max_tokens. ~600 tokens per bilingual idea worst-case.
  const maxTokens = Math.min(64000, Math.max(4000, count * 700));
  const { text, error } = await callAnthropic(newSystemPrompt, userPrompt, maxTokens);
  if (error) return { created: 0, error };
  const ideas = parseAllJSON(text);
  if (ideas.length === 0) return { created: 0, error: "no ideas parsed", raw: text.slice(0, 200) };

  // Sprint A6 (2026-05-08): assign Target_Platform alternating per idea so each
  // batch produces a balanced FB/IG mix. Source_Idea_ID groups ES + EN variants.
  const platformNext = makePlatformAssigner(0);
  // Sprint A7 (2026-05-08): rotate Reel templates across the batch so we don't
  // publish 28 identical-looking voiceovers in a row.
  const templateNext = makeTemplateRotator(0);

  const created = [];
  for (const idea of ideas.slice(0, count)) {
    const format = String(idea.format || "Post");
    const sourceId = String(Date.now()) + Math.floor(Math.random()*1000).toString().padStart(3,"0");
    const targetPlatform = platformNext();  // FB or IG, alternating
    const tableId  = format === "Reel"  ? SM_REELS_TABLE_ID
                   : format === "Video" ? SM_VIDEOS_TABLE_ID
                   : SM_POSTS_TABLE_ID;

    // Build base fields shared by ES + EN records.
    const baseFields = (lang) => ({
      Title: lang === "ES" ? (idea.title_es || idea.title_en) : (idea.title_en || idea.title_es),
      Language: lang,
      Source_Idea_ID: sourceId,
      Concept_ID: sourceId,                // shared across ES + EN variants of same concept
      Target_Platform: targetPlatform,     // Sprint A6: slot-driven publishing target
      Tipo: idea.tipo || "Educativo",
      Segment_Anchor: idea.segment_anchor || "General",
      Plataforma: "AMBAS",
      Theme_Code: idea.theme_code || "T1",
      Status: STATUS.IDEA,
      Hashtags: lang === "ES" ? (idea.hashtags_es || idea.hashtags_en || "") : (idea.hashtags_en || idea.hashtags_es || ""),
    });

    let esFields, enFields;
    // Pre-assign a rotated template for Reels (used in reelExtraLang below).
    const assignedTemplate = format === "Reel" ? templateNext() : null;
    if (format === "Reel") {
      // Per-language slides (Jorge 2026-05-08): Sonnet must return slides_es +
      // slides_en separately. PRE-CREATE VALIDATION: if Sonnet returned an
      // incomplete reel structure, REJECT the idea (don't create record) so we
      // don't waste Oráculo + Reescritor cycles fixing it. Log the rejection
      // and append a structural lesson so SM Manager learns immediately.
      const reel = idea.reel || {};
      const slidesEs = Array.isArray(reel.slides_es) ? reel.slides_es : [];
      const slidesEn = Array.isArray(reel.slides_en) ? reel.slides_en : [];
      const validateSlides = (slides, lang) => {
        if (slides.length < 5) return `${lang}: ${slides.length}/5 slides`;
        const empty = [];
        if (!String(slides[0]?.hook || "").trim()) empty.push(`slide_1.hook`);
        for (let i = 1; i <= 3; i++) if (!String(slides[i]?.text || "").trim()) empty.push(`slide_${i+1}.text`);
        if (!String(slides[4]?.cta || "").trim()) empty.push(`slide_5.cta`);
        return empty.length ? `${lang}: empty ${empty.join(",")}` : null;
      };
      const errEs = validateSlides(slidesEs, "ES");
      const errEn = validateSlides(slidesEn, "EN");
      if (errEs || errEn) {
        console.error(`[sm] REJECT Reel idea (incomplete slides): ${errEs || ""} ${errEn || ""} | title=${(idea.title_es || "").slice(0,40)}`);
        // Append structural lesson immediately so the next generation loop fixes itself.
        await appendStructuralLesson(`Reel idea generated with empty slide fields: ${errEs || ""} ${errEn || ""}. RULE: every Reel idea MUST include reel.slides_es AND reel.slides_en, each with 5 elements, and slides 2/3/4 MUST have non-empty 'text' and slides 1 MUST have 'hook' and slide 5 MUST have 'cta'.`).catch(() => null);
        continue;  // skip — don't create incomplete records
      }
      const reelExtraLang = (lang) => {
        const slides = lang === "ES" ? slidesEs : slidesEn;
        const cap    = lang === "ES" ? idea.caption_es : idea.caption_en;
        return {
          Slide_1_Hook:  slides[0].hook,
          Slide_2_Text:  slides[1].text,
          Slide_2_Visual: slides[1].visual || "wisconsin home golden hour | flux: cinematic warm wisconsin home, no text",
          Slide_3_Text:  slides[2].text,
          Slide_3_Visual: slides[2].visual || "wisconsin home golden hour | flux: cinematic warm wisconsin home, no text",
          Slide_4_Text:  slides[3].text,
          Slide_4_Visual: slides[3].visual || "wisconsin home golden hour | flux: cinematic warm wisconsin home, no text",
          Slide_5_CTA:   slides[4].cta,
          Caption:       cap || "",
          // Sprint A7: SM Manager rotates templates, overriding LLM choice for variety.
          Template:      assignedTemplate,
          Music_Track:   reel.music || "cinematic",
          Avatar_Mode:   String(idea.tipo || "").toLowerCase() === "personal" ? "Jorge_hook+CTA" : "NO_avatar",
        };
      };
      esFields = { ...baseFields("ES"), ...reelExtraLang("ES") };
      enFields = { ...baseFields("EN"), ...reelExtraLang("EN") };
    } else if (format === "Video") {
      const videoExtra = (lang) => ({
        Hook:           lang === "ES" ? (idea.hook_es || "") : (idea.hook_en || ""),
        Main_Message:   lang === "ES" ? (idea.caption_es || "") : (idea.caption_en || ""),
        Script_Outline: lang === "ES" ? (idea.script_outline_es || "") : (idea.script_outline_en || ""),
        CTA:            lang === "ES" ? (idea.cta_es || "") : (idea.cta_en || ""),
        Caption:        lang === "ES" ? (idea.caption_es || "") : (idea.caption_en || ""),
        Template:       "voiceover",
        Music_Track:    "cinematic",
        Avatar_Mode:    "NO_avatar",
        Duration_Sec:   30,
      });
      esFields = { ...baseFields("ES"), ...videoExtra("ES") };
      enFields = { ...baseFields("EN"), ...videoExtra("EN") };
    } else {
      const postExtra = (lang) => ({
        Hook:           lang === "ES" ? (idea.hook_es || "") : (idea.hook_en || ""),
        Caption:        lang === "ES" ? (idea.caption_es || "") : (idea.caption_en || ""),
        CTA:            lang === "ES" ? (idea.cta_es || "") : (idea.cta_en || ""),
        Visual_Concept: idea.visual_concept || "",
        Background_Source: "Pexels",
      });
      esFields = { ...baseFields("ES"), ...postExtra("ES") };
      enFields = { ...baseFields("EN"), ...postExtra("EN") };
    }

    try {
      const esRes = await smCreateIn(tableId, esFields);
      if (esRes.id) created.push({ id: esRes.id, lang: "ES", format });
    } catch (e) { console.error(`[sm] ES create failed: ${e.message}`); }

    try {
      const enRes = await smCreateIn(tableId, enFields);
      if (enRes.id) created.push({ id: enRes.id, lang: "EN", format });
    } catch (e) { console.error(`[sm] EN create failed: ${e.message}`); }
  }
  return { created: created.length, records: created };
}

async function getRecentTitles() {
  // Past 14 days of titles across all 3 new tables to avoid duplicates.
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const filter = encodeURIComponent(`IS_AFTER(CREATED_TIME(), '${since}')`);
  const titles = [];
  for (const t of SM_TABLES) {
    try {
      const r = await smFetchIn(t.id, `filterByFormula=${filter}&maxRecords=20&fields%5B%5D=Title`);
      for (const rec of (r.records || [])) {
        const tt = rec.fields?.Title;
        if (tt) titles.push(tt);
      }
    } catch {}
  }
  return [...new Set(titles)];
}

// ──────────────────────────────────────────────────────────────
// Mode 2 — Process posts (Meta Graph API publish to FB + IG)
// ──────────────────────────────────────────────────────────────
// Pick the Nth distinct future Tue/Thu/Sat 16:00 UTC slot.
// slotIndex 0 = next allowed slot strictly in the future; 1 = the one after; etc.
// Each call MUST return a different (later) slot to spread posts across days
// per cadence policy, and to avoid Meta API errors on past timestamps.
// Bug fix 2026-05-07: previous version could return slots in the past.
function nextSlotISO(slotIndex = 0) {
  const now = Date.now();
  const allowedDays = [2, 4, 6];   // Tue, Thu, Sat (UTC)
  let cursor = new Date(now + 60 * 60 * 1000);   // start search 1h from now
  let found = -1;
  for (let i = 0; i < 30; i++) {
    if (allowedDays.includes(cursor.getUTCDay())) {
      const candidate = new Date(cursor);
      candidate.setUTCHours(16, 0, 0, 0);
      if (candidate.getTime() > now + 30 * 60 * 1000) {
        found++;
        if (found === slotIndex) return candidate.toISOString();
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  // Fallback: 7 days from now at 16:00 UTC
  const fallback = new Date(now + 7 * 24 * 3_600_000);
  fallback.setUTCHours(16, 0, 0, 0);
  return fallback.toISOString();
}

// Parse `Blotato_Visual_ID` legacy field for carousel slide URLs.
// Two historical shapes:
//   modern Cloudinary:  "puppeteer:6_slides|<url1>|<url2>|..."
//   legacy Blotato:     "<id>|||<url1>|<url2>|..."
// Returns array of media URLs, or empty array if no slides parseable.
function parseCarouselSlides(raw) {
  if (!raw || typeof raw !== "string") return [];
  let body = raw;
  if (body.includes("|||")) body = body.split("|||")[1] || "";       // legacy Blotato format
  else if (body.startsWith("puppeteer:")) body = body.split("|").slice(1).join("|");
  const urls = body.split("|").map(s => s.trim()).filter(u => u.startsWith("http"));
  return urls;
}

function isVideo(url) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url || "");
}

async function processPosts(cfg, runId, args = {}) {
  if (!META_USER_TOKEN && !META_PAGE_TOKEN) {
    return { posted: 0, reason: "META_USER_TOKEN / META_PAGE_ACCESS_TOKEN not configured — set in Doppler/secrets" };
  }

  // Sprint A1.2+A1.3 (Jorge 2026-05-08): publisher is now slot-driven. Each cron
  // entry provides --target-platform and --target-format; the run pulls only
  // matching records and publishes to that one platform at the fixed slot time.
  const { ok: argsOk, errors: argsErrors } = validatePublisherArgs({
    targetPlatform: args.targetPlatform,
    targetFormat: args.targetFormat,
  });
  if (!argsOk) {
    return { posted: 0, reason: `invalid args: ${argsErrors.join("; ")} — pass --target-platform=FB|IG --target-format=Post|Reel|Video` };
  }
  const targetPlatform = args.targetPlatform;
  const targetFormat = args.targetFormat;

  // Safety layer (Jorge 2026-05-07 "si nos banean estamos acabados").
  // Lazy import to avoid breaking generate_ideas mode if safety.mjs is missing.
  const { safetyCheckBeforePublish, classifyError, alertTelegram, CURRENT_PHASE } = await import("./safety.mjs");
  console.error(`[social_media] safety phase=${CURRENT_PHASE} target=${targetPlatform}/${targetFormat}`);

  // Resolve Page Access Token (cached for the run).
  let pageToken = META_PAGE_TOKEN;
  if (!pageToken) {
    pageToken = await getPageAccessToken({ userAccessToken: META_USER_TOKEN, pageId: FB_PAGE_ID });
    if (!pageToken) return { posted: 0, reason: `Page ${FB_PAGE_ID} not found in /me/accounts — token may lack pages_show_list scope` };
  }

  // Resolve IG Business Account only if the slot targets IG (cached).
  let igUserId = null;
  if (targetPlatform === "IG") {
    igUserId = await getInstagramUserId({ pageId: FB_PAGE_ID, pageAccessToken: pageToken }).catch(() => null);
    if (!igUserId) {
      return { posted: 0, reason: "IG Business Account not linked to FB Page — cannot publish IG slot" };
    }
  }

  // Fetch only records matching the slot (single-table since format determines table).
  const tableId = targetFormat === "Reel" ? SM_REELS_TABLE_ID
                : targetFormat === "Video" ? SM_VIDEOS_TABLE_ID
                : SM_POSTS_TABLE_ID;
  // Note: do NOT pass targetFormat to buildPublisherFilter — the format is
  // already implicit in the table choice (Posts/Reels/Videos table per format).
  // Adding {Format}='...' would 422 since that field doesn't exist on these tables.
  const filter = encodeURIComponent(buildPublisherFilter({
    targetPlatform,
    status: STATUS.VISUAL_LISTO,
  }));
  const ideas = []; // { tableId, format, record }
  try {
    const resp = await smFetchIn(tableId, `filterByFormula=${filter}&maxRecords=${POSTS_PER_RUN}`);
    for (const rec of (resp.records || [])) {
      if (ideas.length >= POSTS_PER_RUN) break;
      ideas.push({ tableId, format: targetFormat, record: rec });
    }
  } catch (e) {
    console.error(`[sm] fetch ${targetFormat} failed: ${e.message}`);
  }
  if (ideas.length === 0) {
    return { posted: 0, reason: `no ${targetPlatform} ${targetFormat} records with Status=Visual Listo` };
  }

  const results = [];
  let halted = false;
  const safetyPlatform = targetPlatform === "FB" ? "fb" : "ig";
  const fieldPublishedIds = selectFieldPublishedId(targetPlatform);
  for (const item of ideas) {
    if (halted) {
      results.push({ id: item.record.id, format: item.format, status: "halted_by_safety" });
      continue;
    }
    const { tableId, format, record: idea } = item;
    const f = idea.fields || {};
    const visualUrl = f.visual_url || "";
    const lang      = String(f.Language || "ES").toUpperCase();
    // Single-language Caption (no more Caption ES + Caption EN). Each record
    // is one language. Caption + Hashtags compose the final published text.
    const captionBody = f.Caption || "";
    const hashtags    = f.Hashtags || "";
    const caption     = `${captionBody}\n\n${hashtags}`.trim();
    // Sprint A1 (2026-05-08): slot-driven scheduling — each cron run hits one
    // fixed slot for one platform/format combo. getNextFixedSlot returns the
    // next future slot in America/Chicago (auto-DST), as a UTC unix timestamp.
    const scheduledTime = getNextFixedSlot(targetPlatform, format, new Date());

    // ── SAFETY GATE ──
    const safety = await safetyCheckBeforePublish({
      caption, visualUrl, formato: format,
      durationSec: f.Duration_Sec || 0,
      platform: safetyPlatform,
      smFetch: (params) => smFetchIn(tableId, params),
      fieldPublishedIds,
    });
    if (!safety.ok) {
      const reason = `safety blocked (${safety.blockReason}): ${(safety.details || []).join("; ")}`.slice(0, 500);
      console.error(`[social_media] [${format}] ${idea.id} ${reason}`);
      await smUpdateIn(tableId, idea.id, { Error_Reason: reason, Status: STATUS.ERROR }).catch(() => null);
      results.push({ id: idea.id, format, lang, status: "safety_blocked", reason: safety.blockReason });
      continue;
    }

    let fbResult = null, igResult = null, fbErr = null, igErr = null;
    const useVideo = format === "Reel" || isVideoUrl(visualUrl);

    if (targetPlatform === "FB") {
      try {
        if (useVideo) {
          fbResult = await publishFacebookReel({ pageId: FB_PAGE_ID, pageAccessToken: pageToken, videoUrl: visualUrl, caption, scheduledPublishTime: scheduledTime });
        } else {
          fbResult = await publishFacebookPhotoPost({ pageId: FB_PAGE_ID, pageAccessToken: pageToken, imageUrls: [visualUrl], caption, scheduledPublishTime: scheduledTime });
        }
      } catch (e) {
        fbErr = e.message;
        const cls = classifyError(e);
        if (cls.alert) await alertTelegram(`FB publish error on ${idea.id}: ${e.message}`, 'WARN').catch(() => null);
        if (cls.action === 'halt') { halted = true; await alertTelegram(`HALT triggered: ${cls.reason}`, 'CRITICAL').catch(() => null); }
      }
    } else {
      // targetPlatform === "IG"
      try {
        if (useVideo) {
          igResult = await publishInstagramReel({ igUserId, pageAccessToken: pageToken, videoUrl: visualUrl, caption });
        } else {
          igResult = await publishInstagramImage({ igUserId, pageAccessToken: pageToken, imageUrl: visualUrl, caption });
        }
      } catch (e) {
        igErr = e.message;
        const cls = classifyError(e);
        if (cls.alert) await alertTelegram(`IG publish error on ${idea.id}: ${e.message}`, 'WARN').catch(() => null);
        if (cls.action === 'halt') { halted = true; await alertTelegram(`HALT triggered: ${cls.reason}`, 'CRITICAL').catch(() => null); }
      }
    }

    const fbId = fbResult?.id || fbResult?.video_id || null;
    const igId = igResult?.media_id || igResult?.id || null;

    await smUpdateIn(tableId, idea.id, {
      Published_FB_ID: fbId || "",
      Published_IG_ID: igId || "",
      Status:          (fbId || igId) ? STATUS.PROGRAMADO : STATUS.ERROR,
      Scheduled_Time:  new Date(scheduledTime * 1000).toISOString(),
      ...(fbErr || igErr ? { Error_Reason: [fbErr && `FB: ${fbErr}`, igErr && `IG: ${igErr}`].filter(Boolean).join(" | ").slice(0, 500) } : {}),
    }).catch(() => null);

    results.push({ id: idea.id, format, lang, status: (fbId || igId) ? "scheduled" : "failed", fb: fbId, ig: igId, fbErr, igErr, when: scheduledTime });
  }
  return { posted: results.filter((r) => r.status === "scheduled").length, total: results.length, results };
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv, VALID_MODES, { targetPlatform: null, targetFormat: null });
  const cfg = await loadTenant(args.tenant);
  const runId = genRunId();
  const startedAt = isoNow();

  console.error(`[social_media] tenant=${cfg.tenant_id} mode=${args.mode} run_id=${runId} dry_run=${args.dryRun}`);

  if (args.dryRun) {
    console.log(`=== DRY RUN [social_media ${args.mode}] ===`);
    console.log(`Would call Anthropic + Meta Graph API + Airtable SM (${SM_BASE}: Posts/Reels/Videos).`);
    console.log(`Caps: ideas=${IDEAS_PER_RUN}, posts=${POSTS_PER_RUN}.`);
    return;
  }

  if (!META_USER_TOKEN && !META_PAGE_TOKEN && args.mode !== "generate_ideas") {
    console.error("[social_media] META_USER_TOKEN / META_PAGE_ACCESS_TOKEN missing — posts will skip");
  }

  const summary = {};
  if (args.mode === "generate_ideas" || args.mode === "full_pipeline") {
    summary.ideas = await generateIdeas(cfg, runId).catch((e) => ({ error: e.message }));
  }
  if (args.mode === "batch_weekly") {
    // Sprint A6 (2026-05-08): generate a full week of records in one shot.
    // Skip backlog gate inside generateIdeas by overriding cap to >current backlog.
    summary.ideas = await generateIdeas(cfg, runId, { count: IDEAS_PER_BATCH }).catch((e) => ({ error: e.message }));
  }
  if (args.mode === "process_posts" || args.mode === "full_pipeline") {
    summary.posts = await processPosts(cfg, runId, args).catch((e) => ({ error: e.message }));
  }

  const completedAt = isoNow();
  const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);

  // Telegram summary.
  const lines = [`📱 *Social Media* — ${cfg.tenant_name}`, `mode: \`${args.mode}\` · ${duration}s`];
  if (summary.ideas)   lines.push(`💡 ideas creadas: ${summary.ideas.created ?? 0}${summary.ideas.error ? ` (err: ${summary.ideas.error})` : ""}`);
  if (summary.visuals) lines.push(`🎨 visuales done: ${summary.visuals.processed ?? 0}/${summary.visuals.total ?? 0}${summary.visuals.error ? ` (err: ${summary.visuals.error})` : ""}`);
  if (summary.posts)   lines.push(`📅 posts programados: ${summary.posts.posted ?? 0}/${summary.posts.total ?? 0}${summary.posts.error ? ` (err: ${summary.posts.error})` : ""}`);
  await telegramSend(cfg, lines.join("\n"));

  console.error(`[social_media] done summary=${JSON.stringify(summary).slice(0, 300)}`);
}

main().catch((e) => { console.error("[social_media] FATAL:", e); process.exit(1); });
