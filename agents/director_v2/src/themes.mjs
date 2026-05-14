// Director v2 themes — re-exports the 5 themes from creativo_runner +
// adds dimsForAspect helper used by scene_layout.mjs.
//
// The original wrapper pointed at agents/creativo_v2/src/themes.mjs which
// never landed in master after the cherry-pick from greeting-setup-yOfqf.
// This shim restores the surface area used by Director v2 against the
// existing creativo_runner/themes.mjs.

export { THEMES, VALID_THEME_CODES, slideHook, slidePoint, slideCTA, buildCarousel } from '../../creativo_runner/themes.mjs';

// Map a Reel aspect string to canvas dimensions. 9:16 = vertical Reel/Story (default).
const ASPECTS = {
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
  '4:5':  { width: 1080, height: 1350 },
  '16:9': { width: 1920, height: 1080 },
};

export function dimsForAspect(aspect) {
  return ASPECTS[aspect] || ASPECTS['9:16'];
}
