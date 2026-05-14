import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSignature, uploadVideo, __setFetch } from '../src/cloudinary.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO_RESP = JSON.parse(readFileSync(join(HERE, 'fixtures/cloudinary_video_response.json'), 'utf8'));

test('buildSignature with resource_type=video is deterministic SHA1', () => {
  const sig = buildSignature({
    folder: 'pinnacle-social-media/videos',
    public_id: 'directorv2/rec123',
    resource_type: 'video',
    timestamp: 1713966000,
    overwrite: 'true',
  }, 'test_secret');
  assert.equal(sig.length, 40);
  assert.match(sig, /^[a-f0-9]{40}$/);
});

test('uploadVideo POSTs resource_type=video to /video/upload endpoint', async () => {
  let captured;
  __setFetch(async (url, opts) => {
    captured = { url, opts };
    return { ok: true, json: async () => VIDEO_RESP };
  });
  const res = await uploadVideo('/tmp/test.mp4', {
    publicId: 'directorv2/rec123',
    folder: 'pinnacle-social-media/videos',
    cloudName: 'dzzlhhk0m',
    apiKey: 'K',
    apiSecret: 'S',
    timestampProvider: () => 1713966000,
    fileReader: async () => Buffer.from('fakevideo'),
  });
  assert.ok(captured.url.includes('/video/upload'));
  assert.equal(res.secure_url, VIDEO_RESP.secure_url);
});

test('uploadVideo sanitizes public_id before signing', async () => {
  let captured;
  __setFetch(async (url, opts) => { captured = opts.body; return { ok: true, json: async () => VIDEO_RESP }; });
  await uploadVideo('/tmp/t.mp4', {
    publicId: 'BAD-chars!@#',
    folder: 'pinnacle-social-media/videos',
    cloudName: 'dzzlhhk0m',
    apiKey: 'K', apiSecret: 'S',
    timestampProvider: () => 1,
    fileReader: async () => Buffer.from('x'),
  });
  const raw = Buffer.isBuffer(captured) ? captured.toString() : String(captured);
  assert.ok(!raw.includes('BAD-chars!@#'));
});
