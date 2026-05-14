import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { sanitizePublicId } from './util/sanitize.mjs';

let _fetch = globalThis.fetch;
export function __setFetch(fn) { _fetch = fn; }

// Predictable URL for a Cloudinary-hosted video asset (no signing needed for delivery).
export function buildVideoUrl({ cloudName, folder, publicId, ext = 'mp4' }) {
  const safe = sanitizePublicId(publicId);
  const path = folder ? `${folder}/${safe}` : safe;
  return `https://res.cloudinary.com/${cloudName}/video/upload/${path}.${ext}`;
}

// Try to fetch a previously-uploaded video from Cloudinary. Returns { hit: true, sizeBytes } if 200, { hit: false } otherwise.
// Used as a HeyGen-bypass cache so we don't re-spend $ on identical avatar regenerations.
export async function tryDownloadCachedVideo(url, destPath) {
  let res;
  try {
    res = await _fetch(url, { method: 'GET' });
  } catch {
    return { hit: false };
  }
  if (!res.ok) return { hit: false };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) return { hit: false };       // sanity: real MP4s are >>1KB
  await writeFile(destPath, buf);
  return { hit: true, sizeBytes: buf.length };
}

export function buildSignature(params, apiSecret) {
  const keys = Object.keys(params).sort();
  const toSign = keys.map(k => `${k}=${params[k]}`).join('&') + apiSecret;
  return createHash('sha1').update(toSign).digest('hex');
}

export async function uploadVideo(localPath, {
  publicId, folder, cloudName, apiKey, apiSecret,
  overwrite = true,
  timestampProvider = () => Math.floor(Date.now() / 1000),
  fileReader = readFile,
} = {}) {
  const safePublicId = sanitizePublicId(publicId);
  const timestamp = timestampProvider();
  const signedParams = {
    folder, public_id: safePublicId,
    timestamp, overwrite: overwrite ? 'true' : 'false',
  };
  const signature = buildSignature(signedParams, apiSecret);

  const form = new FormData();
  form.append('file', new Blob([await fileReader(localPath)]));
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);
  form.append('public_id', safePublicId);
  form.append('resource_type', 'video');
  form.append('overwrite', overwrite ? 'true' : 'false');

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
  const res = await _fetch(url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Cloudinary video upload failed: HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}
