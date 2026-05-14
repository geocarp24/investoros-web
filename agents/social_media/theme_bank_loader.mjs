/**
 * theme_bank_loader.mjs — pure helpers for loading + sampling the Theme Bank.
 *
 * Used by SM Manager to generate ideas weighted by pillar configuration.
 * No external deps. All rng is injectable for testing.
 *
 * Sprint A6 — Jorge 2026-05-08.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, "theme_bank.json");

/**
 * Load + validate the Theme Bank JSON. Throws on invalid structure.
 *
 * @param {string} [path] - absolute path; defaults to ../theme_bank.json
 * @returns {object} parsed theme bank
 */
export function loadThemeBank(path = DEFAULT_PATH) {
  const raw = readFileSync(path, "utf8");
  const tb = JSON.parse(raw);

  if (!tb.pillars || !Array.isArray(tb.pillars)) {
    throw new Error("theme bank invalid: missing pillars[]");
  }
  if (tb.pillars.length === 0) {
    throw new Error("theme bank invalid: empty pillars");
  }
  let totalWeight = 0;
  let totalSubtopics = 0;
  for (const p of tb.pillars) {
    if (!p.id) throw new Error(`pillar missing id`);
    if (typeof p.weight_pct !== "number") throw new Error(`pillar ${p.id} missing weight_pct`);
    if (!Array.isArray(p.subtopics)) throw new Error(`pillar ${p.id} missing subtopics[]`);
    if (p.subtopics.length === 0) throw new Error(`pillar ${p.id} has no subtopics`);
    for (const s of p.subtopics) {
      if (!s.id) throw new Error(`subtopic in pillar ${p.id} missing id`);
      if (!s.title_en && !s.title_es) throw new Error(`subtopic ${s.id} missing title`);
    }
    totalWeight += p.weight_pct;
    totalSubtopics += p.subtopics.length;
  }
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`theme bank weights must sum to 100, got ${totalWeight}`);
  }
  return { ...tb, _totalSubtopics: totalSubtopics };
}

/**
 * Pick a single subtopic weighted by pillar weight_pct.
 * Within a pillar, subtopic is chosen uniformly at random.
 *
 * @param {object} themeBank
 * @param {object} [opts]
 * @param {string[]} [opts.excludeIds] - subtopic ids to skip (recently used)
 * @param {() => number} [opts.rng] - injectable rng for testing
 * @returns {{pillar: object, subtopic: object} | null}
 */
export function pickSubtopic(themeBank, { excludeIds = [], rng = Math.random } = {}) {
  const exclSet = new Set(excludeIds);
  const available = themeBank.pillars
    .map(p => ({ pillar: p, subs: p.subtopics.filter(s => !exclSet.has(s.id)) }))
    .filter(x => x.subs.length > 0);

  if (available.length === 0) return null;

  // Renormalize weights against still-available pillars only.
  const totalWeight = available.reduce((sum, x) => sum + x.pillar.weight_pct, 0);
  if (totalWeight === 0) return null;

  let r = rng() * totalWeight;
  for (const { pillar, subs } of available) {
    r -= pillar.weight_pct;
    if (r <= 0) {
      const idx = Math.floor(rng() * subs.length);
      return { pillar, subtopic: subs[idx] };
    }
  }
  // Numerical edge: pick last available
  const last = available[available.length - 1];
  return { pillar: last.pillar, subtopic: last.subs[last.subs.length - 1] };
}

/**
 * Pick N distinct subtopics, never repeating an id within the batch.
 * Useful for generating a weekly batch of records.
 *
 * @param {object} themeBank
 * @param {number} n - count to draw
 * @param {object} [opts]
 * @param {string[]} [opts.excludeIds] - global exclusions (e.g., recent history)
 * @param {() => number} [opts.rng]
 * @returns {Array<{pillar: object, subtopic: object}>}
 */
export function pickBatch(themeBank, n, { excludeIds = [], rng = Math.random } = {}) {
  const used = new Set(excludeIds);
  const out = [];
  for (let i = 0; i < n; i++) {
    const pick = pickSubtopic(themeBank, { excludeIds: [...used], rng });
    if (!pick) break;
    used.add(pick.subtopic.id);
    out.push(pick);
  }
  return out;
}

/**
 * Round-robin platform assigner — produces FB, IG, FB, IG, ...
 *
 * @param {number} [startIndex=0] - 0=FB-first, 1=IG-first
 * @returns {() => "FB" | "IG"}
 */
export function makePlatformAssigner(startIndex = 0) {
  let counter = startIndex;
  return function nextPlatform() {
    const p = counter % 2 === 0 ? "FB" : "IG";
    counter++;
    return p;
  };
}

/**
 * Decide format for a subtopic. If subtopic has format_hint, use it.
 * Otherwise fall back to pillar.preferred_formats[0] or "Post".
 */
export function decideFormat(pillar, subtopic) {
  if (subtopic.format_hint) return subtopic.format_hint;
  if (Array.isArray(pillar.preferred_formats) && pillar.preferred_formats.length > 0) {
    return pillar.preferred_formats[0];
  }
  return "Post";
}

/**
 * Sprint A12 (Jorge 2026-05-08): force a target distribution of formats across
 * a batch — overrides Theme Bank format_hint to match cadence slot inventory.
 *
 * Slot inventory per week (approved 2026-05-08):
 *   42 Posts   (3/day × FB + 3/day × IG × 7 days)
 *   28 Reels   (2/day × FB + 2/day × IG × 7 days)
 *    8 Videos  (1/day × FB + 1/day × IG × 4 video days [Mon/Wed/Fri/Sun])
 */
export const WEEKLY_FORMAT_MIX = Object.freeze({ Post: 42, Reel: 28, Video: 8 });

export function applyFormatDistribution(picks, { distribution = WEEKLY_FORMAT_MIX } = {}) {
  const total = (distribution.Post || 0) + (distribution.Reel || 0) + (distribution.Video || 0);
  if (total === 0) {
    return picks.map(p => ({ ...p, format: decideFormat(p.pillar, p.subtopic) }));
  }
  const ratio = picks.length / total;
  const quota = {
    Post:  Math.round((distribution.Post  || 0) * ratio),
    Reel:  Math.round((distribution.Reel  || 0) * ratio),
    Video: Math.round((distribution.Video || 0) * ratio),
  };
  let sum = quota.Post + quota.Reel + quota.Video;
  while (sum < picks.length) { quota.Post++;  sum++; }
  while (sum > picks.length) {
    if (quota.Video > 0) { quota.Video--; sum--; }
    else if (quota.Reel > 0) { quota.Reel--; sum--; }
    else { quota.Post--; sum--; }
  }
  const remaining = quota;
  const out = [];
  const used = new Set();
  for (let i = 0; i < picks.length; i++) {
    const hint = picks[i].subtopic.format_hint;
    if (hint && remaining[hint] > 0) {
      out.push({ ...picks[i], format: hint });
      remaining[hint]--;
      used.add(i);
    }
  }
  const fillOrder = ["Video", "Reel", "Post"];
  for (let i = 0; i < picks.length; i++) {
    if (used.has(i)) continue;
    for (const fmt of fillOrder) {
      if (remaining[fmt] > 0) {
        out.push({ ...picks[i], format: fmt });
        remaining[fmt]--;
        used.add(i);
        break;
      }
    }
  }
  return out.sort((a, b) => picks.indexOf(picks.find(p => p.subtopic.id === a.subtopic.id)) - picks.indexOf(picks.find(p => p.subtopic.id === b.subtopic.id)));
}
