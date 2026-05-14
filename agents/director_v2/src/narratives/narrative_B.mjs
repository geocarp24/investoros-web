// IMPORTANT: All keys are "empty" phrases — NO specific time commitments.
// Rule (Jorge 2026-04-25): PROHIBIDO usar promesas con plazos numéricos
// (ej. "Close in 7 Days") — riesgo legal/compliance si no se cumple.
// USAR comparativos vagos: "Faster Than Banks", "Weeks Not Months", etc.
const HERO_QUERY_TABLE = {
  'faster than banks':   'clock time money',
  'weeks not months':    'calendar keys house',
  'no commissions':      'real estate contract',
  'no showings':         'house closed sign',
  'no repairs':          'home renovation',
  'cash offer':          'cash money deal',
  'any condition':       'vintage house exterior',
  'sell as-is':          'house vintage interior',
};
const FALLBACK_QUERY = 'real estate wisconsin';

export function deriveHeroQuery(heading) {
  const key = String(heading || '').trim().toLowerCase();
  return HERO_QUERY_TABLE[key] || FALLBACK_QUERY;
}

export function expand(spec) {
  const mood = spec.mood || 'upbeat';
  const tier = spec.image_quality === 'premium' ? 'nano_banana' : 'flux_schnell';
  // Allow per-record prompt overrides via spec.prompts.{hook,cta} (premium custom prompts).
  const hookPrompt = spec.prompts?.hook
    || `Modern real estate scene matching: "${spec.hook.en}", Pinnacle Holdings brand, cinematic, golden hour, 9:16 vertical`;
  const ctaPrompt  = spec.prompts?.cta
    || 'Pinnacle Holdings Group branded CTA scene, modern craftsman home exterior at twilight, cinematic, 9:16 vertical';

  // Variable scenes: 1 hook + N points + 1 cta (N = spec.points.length, min 3 max 7).
  // Reels: 3 points → 5 scenes total → ~15s output (Reels rule).
  // Videos: 5-7 points → 7-9 scenes total → ~30-50s output (long-form).
  // BASE per scene = 3s (Jorge 2026-05-07: 3s per slide for readability).
  const numPoints = Math.max(3, Math.min(7, (spec.points || []).length));
  const totalScenes = numPoints + 2;  // hook + N points + cta
  const BASE = new Array(totalScenes).fill(3.0);
  const target = Number(spec.duration) || (BASE.length * 3.0 + 2.0);   // small buffer for xfade
  const factor = target / BASE.reduce((a, b) => a + b, 0);
  const D = BASE.map(d => +(d * factor).toFixed(2));

  const scenes = [];
  // Hook scene.
  scenes.push({
    index: 1, duration: D[0], layoutType: 'hook',
    captionEn: spec.hook.en, captionEs: spec.hook.es,
    heroSource: tier, heroPrompt: hookPrompt, heroQuery: null,
    kinetic: true, zoompan: { from: 1.0, to: 1.05 },
    transitionOut: 'crossfade', mood,
  });
  // Point scenes.
  for (let i = 0; i < numPoints; i++) {
    const p = spec.points[i] || {};
    scenes.push({
      index: i + 2, duration: D[i + 1], layoutType: 'point',
      captionEn: p.headingEn || p.captionEn || '',
      captionEs: p.headingEs || p.captionEs || '',
      heroSource: 'pexels',
      heroPrompt: p.heroPrompt || null,
      heroQuery: deriveHeroQuery(p.headingEn || p.captionEn || ''),
      kinetic: false, zoompan: { from: 1.0, to: 1.03 },
      transitionOut: 'crossfade', mood,
    });
  }
  // CTA scene.
  scenes.push({
    index: totalScenes, duration: D[totalScenes - 1], layoutType: 'cta',
    captionEn: spec.cta.en, captionEs: spec.cta.es,
    heroSource: tier, heroPrompt: ctaPrompt, heroQuery: null,
    kinetic: true, zoompan: { from: 1.0, to: 1.05 },
    transitionOut: 'none', mood,
  });
  return scenes;
}
