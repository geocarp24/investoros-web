import { expand as expandB } from './narrative_B.mjs';

const REGISTRY = { B: expandB };

export function expandNarrative(spec) {
  const fn = REGISTRY[spec.narrative];
  if (!fn) throw new Error(`Unknown narrative: ${spec.narrative}`);
  return fn(spec);
}

export function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('spec must be object');
  if (!['A', 'B', 'C'].includes(spec.narrative)) throw new Error(`narrative must be A|B|C, got: ${spec.narrative}`);
  if (spec.aspect !== '9:16') throw new Error(`aspect must be 9:16 for Director, got: ${spec.aspect}`);
  if (!['T1', 'T2', 'T3', 'T4', 'T5'].includes(spec.theme)) throw new Error(`theme must be T1-T5, got: ${spec.theme}`);
  // Duration is the SCENE BUDGET (sum of scene durations before xfade overlap).
  // Reels (5 scenes × 3s = 15s budget → ~12.6s output) → cap 7-18.
  // Videos (7-9 scenes × 3-5s = 27-45s budget → ~24-40s output) → cap 18-50.
  // Single check accommodates both: 7-50s budget, narrative B picks variable scenes.
  const d = Number(spec.duration);
  if (!Number.isFinite(d) || d < 7 || d > 50) throw new Error(`duration must be 7-50, got: ${spec.duration}`);

  if (spec.narrative === 'B') {
    if (!spec.hook?.en || !spec.hook?.es) throw new Error('narrative B requires hook.en and hook.es');
    if (!Array.isArray(spec.points) || spec.points.length < 3) throw new Error('narrative B requires points[3+]');
    if (!spec.cta?.en || !spec.cta?.es) throw new Error('narrative B requires cta.en and cta.es');
  }

  // image_quality is optional, defaults to "standard"
  if (spec.image_quality !== undefined && !['standard', 'premium'].includes(spec.image_quality)) {
    throw new Error(`image_quality must be standard|premium|undefined, got: ${spec.image_quality}`);
  }
  return true;
}
