import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickMusic, listTracksForMood, MOOD_DEFAULT } from '../src/audio.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MUSIC_DIR = join(HERE, '..', 'assets', 'music');

test('pickMusic("upbeat", 10) returns path to an existing mp3', () => {
  const path = pickMusic('upbeat', 10);
  assert.ok(existsSync(path), `track should exist at ${path}`);
  assert.ok(path.endsWith('.mp3'));
});

test('pickMusic with unknown mood falls back to default upbeat', () => {
  const path = pickMusic('nonexistent', 10);
  assert.ok(existsSync(path));
  assert.ok(path.toLowerCase().includes('upbeat'));
});

test('pickMusic rotates when called twice with same mood (different seeds)', () => {
  const a = pickMusic('upbeat', 10, { seed: 1 });
  const b = pickMusic('upbeat', 10, { seed: 2 });
  const tracksUpbeat = listTracksForMood('upbeat');
  if (tracksUpbeat.length >= 2) assert.notEqual(a, b);
  else assert.equal(a, b);
});

test('LICENSES.md exists and lists all tracks in assets/music/', () => {
  const licPath = join(MUSIC_DIR, 'LICENSES.md');
  assert.ok(existsSync(licPath));
  const text = readFileSync(licPath, 'utf8');
  const moods = ['upbeat', 'chill', 'cinematic', 'tension'];
  for (const m of moods) {
    const tracks = listTracksForMood(m);
    for (const t of tracks) {
      const basename = t.split('/').pop();
      assert.ok(text.includes(basename), `LICENSES.md must mention ${basename}`);
    }
  }
});

test('MOOD_DEFAULT is upbeat', () => {
  assert.equal(MOOD_DEFAULT, 'upbeat');
});
