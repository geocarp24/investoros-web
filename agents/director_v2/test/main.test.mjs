import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortMessage, summarize } from '../main.mjs';

test('shortMessage trims and truncates error to <200 chars', () => {
  const long = new Error('x'.repeat(500));
  const msg = shortMessage(long);
  assert.ok(msg.length <= 200);
});

test('shortMessage keeps name and message for typed errors', () => {
  class MyErr extends Error { constructor(m) { super(m); this.name = 'MyErr'; } }
  const e = new MyErr('boom');
  assert.ok(shortMessage(e).includes('MyErr'));
  assert.ok(shortMessage(e).includes('boom'));
});

test('summarize builds line-count summary of batch results', () => {
  const stats = { ok: 2, error: 1, fallback: 1, nanoBananaCalls: 3, nanoBananaCents: 12, pexelsCalls: 4, uploadMb: 10.5, durationMs: 90000 };
  const s = summarize(stats);
  assert.ok(s.includes('Lista:           2'));
  assert.ok(s.includes('Error:            1'));
  assert.ok(s.includes('Nano Banana calls:  3 ($0.12)'));
});

test('summarize formats zero-counts cleanly', () => {
  const stats = { ok: 0, error: 0, fallback: 0, nanoBananaCalls: 0, nanoBananaCents: 0, pexelsCalls: 0, uploadMb: 0, durationMs: 0 };
  const s = summarize(stats);
  assert.ok(s.includes('0'));
});
