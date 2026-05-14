import { sanitizeNanoBananaPrompt } from './util/sanitize.mjs';

let _fetch = globalThis.fetch;
export function __setFetch(fn) { _fetch = fn; }

export const COST_PER_CALL_CENTS = 1; // ~$0.003 ≈ 1 cent (rounded up for budget safety)

export class ReplicateFailedError extends Error {
  constructor(msg) { super(msg); this.name = 'ReplicateFailedError'; }
}

const API = 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions';

async function callOnce(prompt, apiKey) {
  // Step 1: create prediction (Replicate uses Prefer: wait for sync response on Flux Schnell)
  const res = await _fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: '9:16',
        output_format: 'png',
        output_quality: 90,
        num_outputs: 1,
      },
    }),
  });
  if (!res.ok) throw new Error(`Replicate HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.status === 'failed') throw new Error(`Replicate prediction failed: ${data.error}`);
  const outputUrl = Array.isArray(data.output) ? data.output[0] : data.output;
  if (!outputUrl) throw new Error('Replicate: no output URL in response');

  // Step 2: download the image binary
  const imgRes = await _fetch(outputUrl);
  if (!imgRes.ok) throw new Error(`Replicate image download failed: HTTP ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length < 8) throw new Error('Replicate: image too small');
  // Accept PNG (89 50 4E 47), JPEG (FF D8 FF), or WebP (RIFF...WEBP)
  const isPng  = buf[0] === 0x89 && buf[1] === 0x50;
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8;
  const isWebp = buf[0] === 0x52 && buf[8] === 0x57; // RIFF...WEBP
  if (!isPng && !isJpeg && !isWebp) throw new Error('Replicate: unrecognized image format');
  return buf;
}

export async function generateImage(rawPrompt, { apiKey, baseDelayMs = 2000 } = {}) {
  if (!apiKey) throw new Error('generateImage: apiKey required');
  const prompt = sanitizeNanoBananaPrompt(rawPrompt); // reuse same sanitizer

  try {
    const buf = await callOnce(prompt, apiKey);
    return { imageBuffer: buf, costCents: COST_PER_CALL_CENTS, attempts: 1 };
  } catch (err1) {
    await new Promise(r => setTimeout(r, baseDelayMs));
    const refined = `${prompt} (high quality, photorealistic, professional)`.slice(0, 500);
    try {
      const buf = await callOnce(refined, apiKey);
      return { imageBuffer: buf, costCents: COST_PER_CALL_CENTS, attempts: 2 };
    } catch (err2) {
      throw new ReplicateFailedError(`both attempts failed: ${err1.message} | ${err2.message}`);
    }
  }
}
