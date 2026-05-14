import { sanitizeNanoBananaPrompt } from './util/sanitize.mjs';

let _fetch = globalThis.fetch;
export function __setFetch(fn) { _fetch = fn; }

export const COST_PER_CALL_CENTS = 4;

export class NanoBananaFailedError extends Error {
  constructor(msg, costIncurredCents = 0) {
    super(msg);
    this.name = 'NanoBananaFailedError';
    this.costIncurredCents = costIncurredCents;
  }
}

const API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

async function callOnce(prompt, apiKey) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['Image'] },
  };
  const res = await _fetch(`${API}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Nano Banana HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const inlineData = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
  if (!inlineData?.data) throw new Error('Nano Banana: no inline image in response');
  const buf = Buffer.from(inlineData.data, 'base64');
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) {
    throw new Error('Nano Banana: not a valid PNG (bad magic bytes)');
  }
  return buf;
}

export async function generateImage(rawPrompt, { apiKey, baseDelayMs = 3000 } = {}) {
  if (!apiKey) throw new Error('generateImage: apiKey required');
  const prompt = sanitizeNanoBananaPrompt(rawPrompt);

  try {
    const buf = await callOnce(prompt, apiKey);
    return { imageBuffer: buf, costCents: COST_PER_CALL_CENTS, attempts: 1 };
  } catch (err1) {
    await new Promise(r => setTimeout(r, baseDelayMs));
    const refined = `${prompt} (high quality, clean composition, photorealistic)`.slice(0, 500);
    try {
      const buf = await callOnce(refined, apiKey);
      return { imageBuffer: buf, costCents: COST_PER_CALL_CENTS, attempts: 2 };
    } catch (err2) {
      throw new NanoBananaFailedError(`both attempts failed: ${err1.message} | ${err2.message}`, 0);
    }
  }
}
