import { readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MUSIC_DIR = join(HERE, '..', 'assets', 'music');

export const MOOD_DEFAULT = 'upbeat';
const VALID_MOODS = ['upbeat', 'chill', 'cinematic', 'tension'];

export function listTracksForMood(mood) {
  if (!existsSync(MUSIC_DIR)) return [];
  const files = readdirSync(MUSIC_DIR).filter(f => f.endsWith('.mp3'));
  const prefix = `${mood}_`;
  return files.filter(f => f.startsWith(prefix)).map(f => join(MUSIC_DIR, f)).sort();
}

export function pickMusic(mood, durationSeconds, { seed = Date.now() } = {}) {
  let targetMood = VALID_MOODS.includes(mood) ? mood : MOOD_DEFAULT;
  let tracks = listTracksForMood(targetMood);

  if (tracks.length === 0) {
    targetMood = MOOD_DEFAULT;
    tracks = listTracksForMood(MOOD_DEFAULT);
  }
  if (tracks.length === 0) {
    throw new Error(`No music tracks found in ${MUSIC_DIR} for any mood`);
  }

  const idx = Math.abs(Number(seed) | 0) % tracks.length;
  return tracks[idx];
}
