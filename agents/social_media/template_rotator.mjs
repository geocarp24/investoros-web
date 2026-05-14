/**
 * template_rotator.mjs — round-robin Director v2 template assigner.
 *
 * Director v2 supports 5 approved templates (Jorge 2026-05-07):
 *   1. hybrid     — Hybrid Cinematic (default): HeyGen hook + CTA + FLUX2 points
 *   2. pip        — Picture-in-picture: avatar circle 360px + FLUX2 fullscreen
 *   3. voiceover  — Voice only + FLUX2 fullscreen (no avatar)
 *   4. talkinghead — Avatar fullscreen (no FLUX2)
 *   5. editorial  — Split-screen 70/30 FLUX2 top + avatar bottom
 *
 * SM Manager assigns templates in rotation to give visual variety across the
 * weekly batch — prevents the "every Reel looks the same" trap.
 *
 * Sprint A7 — Jorge 2026-05-08.
 */

export const TEMPLATES = Object.freeze([
  "hybrid",
  "pip",
  "voiceover",
  "talkinghead",
  "editorial",
]);

/**
 * Round-robin template assigner.
 *
 * @param {number} [startIndex=0] - 0..4 to start at any template
 * @returns {() => string} function returning next template name
 */
export function makeTemplateRotator(startIndex = 0) {
  let counter = startIndex % TEMPLATES.length;
  return function nextTemplate() {
    const t = TEMPLATES[counter % TEMPLATES.length];
    counter++;
    return t;
  };
}

/**
 * Validate that a template name is one of the 5 approved.
 */
export function isValidTemplate(name) {
  return TEMPLATES.includes(name);
}

/**
 * Pick a default template from a pillar's tone hint, if present.
 * Used as a fallback when rotator is not running batch-wide.
 *
 *   tone "personal/jorge habla"      → talkinghead or pip
 *   tone "educational"               → hybrid or voiceover
 *   tone "urgent/emotional"          → editorial
 *   default                          → hybrid
 */
export function defaultTemplateForTone(tone = "") {
  const t = String(tone).toLowerCase();
  if (t.includes("personal") || t.includes("jorge")) return "pip";
  if (t.includes("urgent") || t.includes("foreclosure") || t.includes("emotional")) return "editorial";
  if (t.includes("educational") || t.includes("calm")) return "voiceover";
  return "hybrid";
}
