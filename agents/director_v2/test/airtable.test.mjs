import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPending, parseVisualPrompt, updateRecord, __setFetch } from '../src/airtable.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PENDING = JSON.parse(readFileSync(join(HERE, 'fixtures/airtable_records_pending.json'), 'utf8'));

const ENV = { token: 'tok', baseId: '[REDACTED_AIRTABLE_BASE_ID]', tableId: '[REDACTED_AIRTABLE_TABLE_ID]' };

test('listPending filters by Status=Oraculo OK and visual_url empty', async () => {
  // New schema 2026-05-07: Reels live in their own table (no Formato filter
  // needed) and gate is Status='Oraculo OK' (not '[ORACULO_OK]' prefix hack).
  let calledUrl;
  __setFetch(async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => PENDING };
  });
  const records = await listPending(ENV);
  assert.equal(records.length, 1);
  const decoded = decodeURIComponent(calledUrl);
  assert.ok(decoded.includes("{Status}='Oraculo OK'"), `expected Status='Oraculo OK' in ${decoded}`);
  assert.ok(decoded.includes('visual_url'));
});

test('parseVisualPrompt parses plain JSON', () => {
  const spec = parseVisualPrompt('{"narrative":"B","theme":"T1","hook":{"en":"h","es":"h"},"aspect":"9:16","duration":10,"points":[],"cta":{"en":"c","es":"c"}}');
  assert.equal(spec.narrative, 'B');
});

test('parseVisualPrompt tolerates markdown code-fence wrapping', () => {
  const text = '```json\n{"narrative":"B","theme":"T1","aspect":"9:16","duration":10,"hook":{"en":"h","es":"h"},"points":[],"cta":{"en":"c","es":"c"}}\n```';
  const spec = parseVisualPrompt(text);
  assert.equal(spec.narrative, 'B');
});

test('parseVisualPrompt throws clear error for malformed input', () => {
  assert.throws(() => parseVisualPrompt('not json at all'), /parse/i);
});

test('updateRecord PATCHes with provided fields only', async () => {
  let capturedBody, capturedUrl, capturedMethod;
  __setFetch(async (url, opts) => {
    capturedUrl = url;
    capturedMethod = opts.method;
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ id: 'recABC123' }) };
  });
  await updateRecord('recABC123', {
    visual_url: 'https://x/y.mp4', Status: 'Lista', video_duration: 10.1, video_cost_cents: 8,
  }, ENV);
  assert.equal(capturedMethod, 'PATCH');
  assert.ok(capturedUrl.endsWith('recABC123'));
  assert.equal(capturedBody.fields.visual_url, 'https://x/y.mp4');
  assert.equal(capturedBody.fields.Status, 'Lista');
  assert.equal(capturedBody.fields.video_duration, 10.1);
  assert.equal(capturedBody.fields.video_cost_cents, 8);
});

test('updateRecord retries on 429', async () => {
  let calls = 0;
  __setFetch(async () => {
    calls++;
    if (calls < 2) return { ok: false, status: 429, text: async () => 'rate limit' };
    return { ok: true, json: async () => ({ id: 'x' }) };
  });
  await updateRecord('recX', { Status: 'Lista' }, { ...ENV, baseDelayMs: 1 });
  assert.equal(calls, 2);
});
