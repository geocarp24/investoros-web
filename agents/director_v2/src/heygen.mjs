// HeyGen Avatar Video API client — supports both V1 (Avatar III, ~$1/min)
// and V3 (Avatar IV/V, ~$4/min, premium quality with motion_prompt + expressiveness).
// Validated end-to-end on 2026-05-06 with Jorge's digital_twin avatar.
//
// Engine selection:
//   - V3 (default) — best for Personal Reels where Jorge appears talking
//   - V1 (legacy)  — 4x cheaper, good for high-volume content where quality is secondary
//
// Required env (passed via env arg, set by GHA secrets):
//   HEYGEN_API_KEY
//   HEYGEN_AVATAR_ID_JORGE
//   HEYGEN_VOICE_ID_JORGE_EN | HEYGEN_VOICE_ID_JORGE_ES

import { writeFile } from 'node:fs/promises';
import { withRetry } from './util/retry.mjs';

const BASE = 'https://api.heygen.com';

export class HeyGenFailedError extends Error {
  constructor(msg) { super(msg); this.name = 'HeyGenFailedError'; }
}

let _fetch = globalThis.fetch;
export function __setFetch(fn) { _fetch = fn; }

async function postJson(path, body, apiKey) {
  const res = await _fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new HeyGenFailedError(`HeyGen ${path} HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getJson(path, apiKey) {
  const res = await _fetch(`${BASE}${path}`, { headers: { 'X-API-Key': apiKey } });
  if (!res.ok) throw new HeyGenFailedError(`HeyGen ${path} HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// V3 payload (Avatar IV/V engine — premium)
function buildV3Payload({ avatarId, script, voiceId, aspectRatio, resolution, expressiveness, motionPrompt, background, speed }) {
  const p = {
    type: 'avatar',
    avatar_id: avatarId,
    script,
    voice_id: voiceId,
    aspect_ratio: aspectRatio,
    resolution,
    background,
  };
  if (expressiveness) p.expressiveness = expressiveness;
  if (motionPrompt)   p.motion_prompt  = motionPrompt;
  if (typeof speed === 'number') p.speed = speed;     // 1.0 default; >1 faster, <1 slower
  return p;
}

// V1 payload (Avatar III engine — legacy / cheaper)
// Aspect ratio in V1 is { dimension: { width, height } } and avatar lives inside clips[].
function buildV1Payload({ avatarId, script, voiceId, aspectRatio, background }) {
  const dim = aspectRatio === '9:16'
    ? { width: 720,  height: 1280 }
    : aspectRatio === '1:1'
      ? { width: 720, height: 720 }
      : { width: 1280, height: 720 };
  return {
    background: background?.type === 'image'
      ? { type: 'image', url: background.url }
      : { type: 'color', value: background?.value || '#0d1117' },
    dimension: dim,
    test: false,
    clips: [{
      avatar_id: avatarId,
      avatar_style: 'normal',
      input_text: script,
      voice_id: voiceId,
    }],
  };
}

export async function generateAvatarVideo({
  script,
  avatarId,
  voiceId,
  apiKey,
  engine        = 'v3',                       // 'v3' (premium ~$4/min) or 'v1' (legacy ~$1/min)
  aspectRatio   = '9:16',
  resolution    = '1080p',                    // V3 only
  expressiveness,                             // V3 photo_avatar ONLY — leave undefined for digital_twin (HeyGen rejects)
  motionPrompt,                               // V3 photo_avatar ONLY — leave undefined for digital_twin (HeyGen rejects)
  speed,                                      // V3 only; numeric; pass undefined to use HeyGen default (1.0)
  background    = { type: 'color', value: '#0d1117' },
  pollIntervalMs = 5000,
  pollTimeoutMs  = 600000,
}) {
  if (!script)   throw new HeyGenFailedError('script required');
  if (!avatarId) throw new HeyGenFailedError('avatarId required');
  if (!voiceId)  throw new HeyGenFailedError('voiceId required');
  if (!apiKey)   throw new HeyGenFailedError('apiKey required');
  if (!['v1', 'v3'].includes(engine)) throw new HeyGenFailedError(`engine must be v1|v3, got: ${engine}`);

  const path    = engine === 'v3' ? '/v3/videos' : '/v1/video.generate';
  const payload = engine === 'v3'
    ? buildV3Payload({ avatarId, script, voiceId, aspectRatio, resolution, expressiveness, motionPrompt, background, speed })
    : buildV1Payload({ avatarId, script, voiceId, aspectRatio, background });

  const create  = await withRetry(() => postJson(path, payload, apiKey), { attempts: 3, baseDelayMs: 2000 });
  // V3 returns { data: { video_id } }, V1 returns { data: { video_id } } too — shape converged.
  const videoId = create?.data?.video_id;
  if (!videoId) throw new HeyGenFailedError(`no video_id in response: ${JSON.stringify(create)}`);

  const deadline = Date.now() + pollTimeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    const status = await getJson(`/v1/video_status.get?video_id=${videoId}`, apiKey);
    const s = status?.data?.status;
    if (s === 'completed') {
      return {
        videoUrl:     status.data.video_url,
        thumbnailUrl: status.data.thumbnail_url,
        durationSec:  status.data.duration,
        videoId,
        engine,
      };
    }
    if (s === 'failed') throw new HeyGenFailedError(`HeyGen rendering failed: ${JSON.stringify(status.data.error || {})}`);
  }
  throw new HeyGenFailedError(`HeyGen polling timed out after ${pollTimeoutMs}ms (video_id=${videoId})`);
}

export async function downloadVideo(url, destPath) {
  const res = await _fetch(url);
  if (!res.ok) throw new HeyGenFailedError(`download HTTP ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return { path: destPath, sizeBytes: buf.length };
}

// Pick voice_id by language. Spec.locale === 'es' → ES voice, else EN.
export function pickVoiceId(locale, env) {
  return locale === 'es' ? env.HEYGEN_VOICE_ID_JORGE_ES=[REDACTED];
}
