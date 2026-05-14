import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchPortrait, PexelsNoResultsError, __setFetch } from '../src/pexels.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OK    = JSON.parse(readFileSync(join(HERE, 'fixtures/pexels_response_ok.json'), 'utf8'));
const EMPTY = JSON.parse(readFileSync(join(HERE, 'fixtures/pexels_response_empty.json'), 'utf8'));

test('searchPortrait sanitizes the query before calling API', async () => {
  let calledUrl;
  __setFetch(async (url, opts) => {
    calledUrl = url;
    assert.equal(opts.headers.Authorization, 'test_pexels_key');
    return { ok: true, json: async () => OK };
  });
  const result = await searchPortrait('home renovation; rm -rf /', { apiKey: 'test_pexels_key' });
  assert.ok(calledUrl.includes('query=home+renovation+rm+rf'), `query should be sanitized: ${calledUrl}`);
  assert.equal(result.id, 12345);
  assert.ok(result.downloadUrl.includes('portrait'));
});

test('searchPortrait throws PexelsNoResultsError on empty results', async () => {
  __setFetch(async () => ({ ok: true, json: async () => EMPTY }));
  await assert.rejects(
    searchPortrait('zzznonsense', { apiKey: 'k' }),
    (err) => err instanceof PexelsNoResultsError
  );
});

test('searchPortrait retries 3 times on 429 then throws', async () => {
  let calls = 0;
  __setFetch(async () => {
    calls++;
    return { ok: false, status: 429, text: async () => 'rate limit' };
  });
  await assert.rejects(
    searchPortrait('anything', { apiKey: 'k', baseDelayMs: 1 }),
    /429/
  );
  assert.equal(calls, 3);
});

test('searchPortrait prefers portrait URL over original', async () => {
  __setFetch(async () => ({ ok: true, json: async () => OK }));
  const result = await searchPortrait('anything', { apiKey: 'k' });
  assert.ok(result.downloadUrl.includes('portrait'));
  assert.ok(result.downloadUrl.includes('w=1080'));
});
