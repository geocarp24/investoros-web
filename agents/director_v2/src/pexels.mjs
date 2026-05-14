import { writeFile } from 'node:fs/promises';
import { sanitizePexelsQuery } from './util/sanitize.mjs';
import { withRetry } from './util/retry.mjs';

let _fetch = globalThis.fetch;
export function __setFetch(fn) { _fetch = fn; }

export class PexelsNoResultsError extends Error {
  constructor(query) { super(`Pexels: no results for "${query}"`); this.name = 'PexelsNoResultsError'; this.query = query; }
}

const API = 'https://api.pexels.com/v1';

export async function searchPortrait(rawQuery, { apiKey, baseDelayMs = 2000 } = {}) {
  const query = sanitizePexelsQuery(rawQuery);
  if (!query) throw new Error('searchPortrait: empty query after sanitize');
  if (!apiKey) throw new Error('searchPortrait: apiKey required');

  const url = `${API}/search?orientation=portrait&size=large&per_page=1&query=${encodeURIComponent(query).replace(/%20/g, '+')}`;

  const data = await withRetry(
    async () => {
      const res = await _fetch(url, { headers: { Authorization: apiKey } });
      if (res.status === 429) throw new Error(`Pexels 429 rate limit`);
      if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
      return res.json();
    },
    { attempts: 3, baseDelayMs }
  );

  if (!data.photos || data.photos.length === 0) {
    throw new PexelsNoResultsError(query);
  }
  const photo = data.photos[0];
  const downloadUrl = photo.src.portrait || photo.src.large2x || photo.src.original;
  return {
    id: photo.id,
    photographer: photo.photographer,
    downloadUrl,
    query,
  };
}

export async function downloadToFile(url, destPath) {
  const res = await _fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return destPath;
}
