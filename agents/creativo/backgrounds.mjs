/**
 * backgrounds.mjs — fetch portrait photo URLs for Post/Story editorial slides.
 *
 * Strategy (cost-optimized per Jorge 2026-05-07 "reutilizar todo lo posible"):
 *   1. Pexels portrait search   — FREE, primary source.
 *   2. Curated evergreen library — fallback bank of 8 Wisconsin/home photos
 *      (rotated by content type) when Pexels fails or returns no results.
 *
 * Pexels images do not need re-uploading to Cloudinary: they already live on
 * Pexels CDN. The Creativo bake step composites them via <img src="..."> in
 * the Puppeteer render, so the Pexels URL is only fetched once per render
 * (when Chromium loads the page) and the final composite is what gets cached
 * in Cloudinary.
 *
 * NOT used: AI imagen models for Post backgrounds. Per CLAUDE.md regla 1d,
 * AI imagen is allowed ONLY when the model would not generate Spanish text
 * inside the image — for Posts, all text is overlaid via HTML/CSS, so
 * a future FLUX2 fallback is permitted but disabled by default to save cost.
 */

const PEXELS_API_KEY    = process.env.PEXELS_API_KEY    || "";
const REPLICATE_TOKEN   = process.env.REPLICATE_API_TOKEN || "";
const PEXELS_API        = "https://api.pexels.com/v1";
const REPLICATE_FLUX_API = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions";

// 8 evergreen Pinnacle backgrounds — used when Pexels fails. These are
// portrait-oriented, warm-tone real estate scenes that fit the editorial
// homeowner aesthetic (regla 1e: minimalist-ui + high-end-visual-design).
// All are public-domain or Pexels-licensed (no attribution needed for these).
const EVERGREEN_BACKGROUNDS = [
  // Wisconsin home exteriors (warm, golden hour)
  "https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&w=1080&h=1350&fit=crop",
  "https://images.pexels.com/photos/277667/pexels-photo-277667.jpeg?auto=compress&w=1080&h=1350&fit=crop",
  // Cozy interiors (kitchens, living rooms)
  "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&w=1080&h=1350&fit=crop",
  "https://images.pexels.com/photos/1571463/pexels-photo-1571463.jpeg?auto=compress&w=1080&h=1350&fit=crop",
  // Hands shaking / paperwork (selling-the-house imagery)
  "https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&w=1080&h=1350&fit=crop",
  "https://images.pexels.com/photos/4427611/pexels-photo-4427611.jpeg?auto=compress&w=1080&h=1350&fit=crop",
  // Suburban neighborhoods (Wisconsin-feel)
  "https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&w=1080&h=1350&fit=crop",
  "https://images.pexels.com/photos/2287310/pexels-photo-2287310.jpeg?auto=compress&w=1080&h=1350&fit=crop",
];

function sanitizeQuery(q) {
  return String(q ?? "")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// Pick a deterministic evergreen by hashing the record id / query — keeps same
// idea→same fallback image across reruns (idempotent).
function pickEvergreen(seed) {
  let h = 0;
  const s = String(seed || "default");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % EVERGREEN_BACKGROUNDS.length;
  return { bgUrl: EVERGREEN_BACKGROUNDS[idx], photographer: "Pexels", source: "evergreen" };
}

/**
 * Generate a conceptual/symbolic image via Replicate FLUX-schnell (~$0.003/img).
 * Used when Pexels stock cannot match the concept (e.g. surreal/symbolic ideas
 * like "couple arguing with lightning splitting the house"). Per CLAUDE.md
 * regla 1d, AI imagen is allowed for backgrounds WITHOUT text — text is
 * overlaid via HTML/CSS in slidePostEditorial.
 */
async function generateConceptualImage(prompt) {
  if (!REPLICATE_TOKEN || !prompt) return null;
  try {
    const r = await fetch(REPLICATE_FLUX_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt: String(prompt).slice(0, 500),
          aspect_ratio: "4:5",
          output_format: "png",
          output_quality: 90,
          num_outputs: 1,
        },
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) {
      console.error(`[backgrounds] Replicate HTTP ${r.status}`);
      return null;
    }
    const data = await r.json();
    if (data.status === "failed") {
      console.error(`[backgrounds] Replicate failed: ${data.error}`);
      return null;
    }
    const url = Array.isArray(data.output) ? data.output[0] : data.output;
    return url || null;
  } catch (e) {
    console.error(`[backgrounds] Replicate error: ${e.message}`);
    return null;
  }
}

/**
 * Search Pexels for a portrait photo matching the query — OR generate a
 * conceptual image via FLUX if the query is a flux directive (object form).
 *
 * Query forms:
 *   "wisconsin home golden hour"       → Pexels search
 *   { flux: "Conceptual: ..." }        → Replicate FLUX-schnell generation
 *
 * Returns { bgUrl, photographer, source } where source is one of
 * "pexels" | "flux" | "evergreen".
 */
export async function fetchPostBackground(rawQuery, { seed } = {}) {
  // Flux directive: conceptual / symbolic / surreal scenes Pexels cannot match.
  if (rawQuery && typeof rawQuery === "object" && rawQuery.flux) {
    const url = await generateConceptualImage(rawQuery.flux);
    if (url) return { bgUrl: url, photographer: "AI · FLUX-schnell", source: "flux" };
    // Fall through to evergreen if FLUX fails.
    return pickEvergreen(seed || rawQuery.flux);
  }

  const query = sanitizeQuery(rawQuery);

  if (!PEXELS_API_KEY || !query) {
    return pickEvergreen(seed || query);
  }

  try {
    const url = `${PEXELS_API}/search?orientation=portrait&size=large&per_page=5&query=${encodeURIComponent(query)}`;
    const r = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(`Pexels HTTP ${r.status}`);
    const data = await r.json();
    if (!data.photos || data.photos.length === 0) {
      console.error(`[backgrounds] Pexels no results for "${query}" — falling back to evergreen`);
      return pickEvergreen(seed || query);
    }
    // Pick a photo deterministically by seed so the same record gets the same
    // photo across reruns (avoids accidental re-renders changing the image).
    let h = 0;
    const s = String(seed || query);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    const photo = data.photos[Math.abs(h) % data.photos.length];

    return {
      bgUrl: photo.src.portrait || photo.src.large2x || photo.src.original,
      photographer: photo.photographer || "Pexels",
      source: "pexels",
    };
  } catch (e) {
    console.error(`[backgrounds] Pexels failed (${e.message}) — falling back to evergreen`);
    return pickEvergreen(seed || query);
  }
}

/**
 * Build a Pexels-friendly query from Visual_Prompt + Tipo + Caption.
 * Maps content type → photo theme (e.g., "homeowner kitchen", "wisconsin home").
 */
export function deriveBgQuery({ visualPrompt = "", tipo = "", titulo = "", captionEn = "" }) {
  const text = `${visualPrompt} ${tipo} ${titulo} ${captionEn}`.toLowerCase();

  // Topic detection — order matters (most specific first).
  // SPECIFIC topics (divorce, foreclosure, inherited) take priority over
  // generic testimonio/caso so a "Testimonio Pareja Divorcio" routes to
  // divorce-thematic imagery, not a generic "for sale" sign (Jorge 2026-05-07).
  // Divorce: conceptual visual via FLUX (Jorge 2026-05-07 — Pexels stock
  // cannot capture the symbolic "couple arguing + lightning splitting house"
  // concept Jorge requested. AI imagen permitted because no text is in the
  // image — text is overlaid via slidePostEditorial CSS).
  if (/divorce|divorc|separation|separac/.test(text))
    return { flux: "Editorial cinematic illustration, photo-realistic style: a heterosexual married couple in their 40s — ONE WOMAN with shoulder-length hair on the left, ONE MAN with short hair on the right — standing on the front lawn of a suburban Wisconsin two-story home, arguing with body language facing apart, while a dramatic vivid lightning bolt strikes vertically and cleanly splits the house in half straight down the center, exposing both halves of the interior. Warm golden-hour twilight sky, deep moody shadows, vertical 4:5 composition, no text, no captions, no logos, no watermarks, dramatic contrast. Subjects must be one man and one woman." };
  if (/foreclosure|embarg|deuda|debt|behind on|atrasado/.test(text))
    return "stressed homeowner kitchen window light";
  if (/inherited|hered|estate|funeral/.test(text))
    return "old wooden house exterior warm";
  if (/testimon|testimonial|caso de éxito|success story/.test(text))
    return "for sale sold sign yard home";
  if (/repair|reparac|fixer|fixer-upper|damaged|repairs/.test(text))
    return "old house exterior renovation";
  if (/landlord|tenant|inquilino|propietario/.test(text))
    return "apartment building exterior warm light";
  if (/relocat|mudanza|moving|out of state/.test(text))
    return "moving boxes packed home";
  if (/cash|efectivo|fast|rapido|quick/.test(text))
    return "handshake home keys close up";
  if (/family|familia|kids|niños/.test(text))
    return "happy family home suburban";
  if (/wisconsin|milwaukee|madison|kenosha/.test(text))
    return "wisconsin suburban home autumn";
  if (/process|proceso|how it works|paso a paso|step/.test(text))
    return "wooden steps stairs home interior";
  if (/agent|realtor|comision|commission/.test(text))
    return "for sale sign yard home";
  if (/equity|valor|investment|inversion/.test(text))
    return "modern suburban home golden hour";

  // Default: warm Wisconsin home.
  return "wisconsin home exterior golden hour";
}
