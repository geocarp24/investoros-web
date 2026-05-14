import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVideoCommand } from '../src/ffmpeg.mjs';

function sampleScenes() {
  return [
    { index: 1, duration: 2.5, imagePaths: ['/tmp/s1.jpg'], zoompan: { from: 1.0, to: 1.05 }, transitionOut: 'crossfade', kinetic: false },
    { index: 2, duration: 2.0, imagePaths: ['/tmp/s2.jpg'], zoompan: { from: 1.0, to: 1.03 }, transitionOut: 'wipeleft',  kinetic: false },
    { index: 3, duration: 2.0, imagePaths: ['/tmp/s3.jpg'], zoompan: { from: 1.0, to: 1.03 }, transitionOut: 'crossfade', kinetic: false },
    { index: 4, duration: 2.0, imagePaths: ['/tmp/s4.jpg'], zoompan: { from: 1.0, to: 1.03 }, transitionOut: 'slideup',   kinetic: false },
    { index: 5, duration: 2.5, imagePaths: ['/tmp/s5.jpg'], zoompan: { from: 1.0, to: 1.05 }, transitionOut: 'none',      kinetic: false },
  ];
}

test('buildVideoCommand returns argv ARRAY (not string) — zero shell injection', () => {
  const cmd = buildVideoCommand({ scenes: sampleScenes(), musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  assert.ok(Array.isArray(cmd.args), 'args must be an array');
  assert.equal(cmd.bin, 'ffmpeg');
  for (const a of cmd.args) assert.equal(typeof a, 'string', `every arg must be string, got ${typeof a}`);
});

test('buildVideoCommand output args include H.264 + faststart + 1080x1920', () => {
  const cmd = buildVideoCommand({ scenes: sampleScenes(), musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const s = cmd.args.join(' ');
  assert.ok(s.includes('libx264'));
  assert.ok(s.includes('yuv420p'));
  assert.ok(s.includes('+faststart'));
  assert.ok(s.includes('1080') && s.includes('1920'));
});

test('buildVideoCommand includes AAC audio codec and loops music', () => {
  const cmd = buildVideoCommand({ scenes: sampleScenes(), musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const s = cmd.args.join(' ');
  assert.ok(s.includes('aac'));
  assert.ok(s.includes('aloop'));
});

test('buildVideoCommand uses xfade with correct transitions from scene.transitionOut', () => {
  const cmd = buildVideoCommand({ scenes: sampleScenes(), musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const filter = cmd.args[cmd.args.indexOf('-filter_complex') + 1];
  assert.ok(filter.includes('xfade=transition=fade'));
  assert.ok(filter.includes('xfade=transition=wipeleft'));
  assert.ok(filter.includes('xfade=transition=slideup'));
});

test('buildVideoCommand uses zoompan filter per scene', () => {
  const cmd = buildVideoCommand({ scenes: sampleScenes(), musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const filter = cmd.args[cmd.args.indexOf('-filter_complex') + 1];
  const zoompanCount = (filter.match(/zoompan/g) || []).length;
  assert.ok(zoompanCount >= 5, `expected at least 5 zoompan filters, got ${zoompanCount}`);
});

test('buildVideoCommand duration roughly matches sum of scenes minus xfade overlap', () => {
  const cmd = buildVideoCommand({ scenes: sampleScenes(), musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const tIdx = cmd.args.indexOf('-t');
  const durArg = parseFloat(cmd.args[tIdx + 1]);
  // sum(2.5+2.0+2.0+2.0+2.5)=11, minus 4×0.6 overlap = 8.6. Allow ±0.5
  assert.ok(durArg > 8.0 && durArg < 9.5, `expected ~8.6, got ${durArg}`);
});

test('buildVideoCommand mixes HeyGen voice audio with music — Jorge must be heard (regression: 2026-05-06)', () => {
  // Hybrid Personal Reel: scene 1 hook (HeyGen), scenes 2-4 points (FLUX2 images), scene 5 cta (HeyGen).
  const hybridScenes = [
    { index: 1, duration: 2.5, videoPath: '/tmp/heygen_hook.mp4', transitionOut: 'crossfade' },
    { index: 2, duration: 2.0, imagePaths: ['/tmp/s2.jpg'], zoompan: { from: 1.0, to: 1.03 }, transitionOut: 'wipeleft',  kinetic: false },
    { index: 3, duration: 2.0, imagePaths: ['/tmp/s3.jpg'], zoompan: { from: 1.0, to: 1.03 }, transitionOut: 'crossfade', kinetic: false },
    { index: 4, duration: 2.0, imagePaths: ['/tmp/s4.jpg'], zoompan: { from: 1.0, to: 1.03 }, transitionOut: 'slideup',   kinetic: false },
    { index: 5, duration: 2.5, videoPath: '/tmp/heygen_cta.mp4', transitionOut: 'none' },
  ];
  const cmd = buildVideoCommand({ scenes: hybridScenes, musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const filter = cmd.args[cmd.args.indexOf('-filter_complex') + 1];
  // Voice tracks must be extracted from each HeyGen scene's audio stream.
  assert.ok(filter.includes('[0:a]'), 'must consume audio of scene 0 (HeyGen hook)');
  assert.ok(filter.includes('[4:a]'), 'must consume audio of scene 4 (HeyGen cta)');
  assert.ok(filter.includes('[va0]') && filter.includes('[va4]'), 'must label per-scene voice tracks');
  // Voice tracks must be delayed to their timeline positions (scene 4 lands well after t=0).
  assert.ok(/adelay=\d+\|\d+/.test(filter), 'must delay voice tracks via adelay');
  // Music must be dynamically ducked under voice via sidechain compression (broadcast-grade).
  assert.ok(filter.includes('sidechaincompress'), 'must use sidechaincompress for dynamic music ducking under voice');
  assert.ok(filter.includes('asplit=2'), 'voice must be split for sidechain trigger');
  assert.ok(filter.includes('volume=0.35'), 'music keeps full volume — sidechain compressor handles ducking');
});

test('buildVideoCommand keeps music-only path when no HeyGen scenes present', () => {
  const cmd = buildVideoCommand({ scenes: sampleScenes(), musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const filter = cmd.args[cmd.args.indexOf('-filter_complex') + 1];
  assert.ok(filter.includes('volume=0.35'), 'music keeps full volume when no voice');
  assert.ok(!filter.includes('sidechaincompress'), 'no sidechain ducking needed when only music');
});

test('buildVideoCommand uses high-quality output codecs (CRF 20, AAC 192k @ 48kHz)', () => {
  const cmd = buildVideoCommand({ scenes: sampleScenes(), musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const s = cmd.args.join(' ');
  assert.ok(s.includes('-crf 20'), 'visual quality CRF 20');
  assert.ok(s.includes('-preset medium'), 'medium preset for quality/speed balance');
  assert.ok(s.includes('-b:a 192k'), 'audio bitrate 192k');
  assert.ok(s.includes('-ar 48000'), 'audio sample rate 48kHz');
});

test('buildVideoCommand burns in karaoke ASS captions per scene via subtitles filter', () => {
  const captionScenes = [
    { index: 1, duration: 2.5, videoPath: '/tmp/heygen.mp4', transitionOut: 'crossfade', captionFile: '/tmp/cap_1.ass' },
    { index: 2, duration: 2.0, imagePaths: ['/tmp/s.jpg'], zoompan: { from: 1.0, to: 1.03 }, transitionOut: 'crossfade', kinetic: false, captionFile: '/tmp/cap_2.ass' },
  ];
  const cmd = buildVideoCommand({ scenes: captionScenes, musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const filter = cmd.args[cmd.args.indexOf('-filter_complex') + 1];
  assert.ok(filter.includes('subtitles='), 'must apply libass subtitles filter when captionFile present');
  assert.ok(filter.includes("'/tmp/cap_1.ass'") || filter.includes('/tmp/cap_1.ass'), 'must reference scene 1 ASS file');
  assert.ok(filter.includes("'/tmp/cap_2.ass'") || filter.includes('/tmp/cap_2.ass'), 'must reference scene 2 ASS file');
});

test('buildVideoCommand omits subtitles filter when captionFile is null', () => {
  const cmd = buildVideoCommand({ scenes: sampleScenes(), musicPath: '/tmp/m.mp3', outputPath: '/tmp/out.mp4' });
  const filter = cmd.args[cmd.args.indexOf('-filter_complex') + 1];
  assert.ok(!filter.includes('subtitles='), 'no subtitles filter when scenes lack captionFile');
});

test('buildVideoCommand Template #3 Voiceover (audioOnly): no circle overlay, avatar audio still used', () => {
  const cmd = buildVideoCommand({
    scenes: sampleScenes(),
    musicPath: '/tmp/m.mp3',
    outputPath: '/tmp/out.mp4',
    globalAvatar: { videoPath: '/tmp/global_avatar.mp4', durationSec: 10, audioOnly: true },
  });
  const filter = cmd.args[cmd.args.indexOf('-filter_complex') + 1];
  // Avatar input still added (audio needed) but no circular overlay applied.
  assert.ok(cmd.args.includes('/tmp/global_avatar.mp4'), 'avatar path still added as input');
  assert.ok(!filter.includes('[avatar_circ]'), 'audioOnly must NOT add circular overlay filter');
  assert.ok(!filter.includes('[vfinal]'), 'audioOnly must NOT redirect video to [vfinal]');
  assert.ok(filter.includes('[vavatar]'), 'audioOnly still uses avatar audio for voice');
  assert.ok(filter.includes('sidechaincompress'), 'voiceover music ducked under voice');
  // Output map should be [vout] (xfade chain end), not [vfinal].
  const mapIdx = cmd.args.findIndex((a, i) => a === '-map' && cmd.args[i+1] === '[vout]');
  assert.ok(mapIdx > -1, 'voiceover output map = [vout]');
});

test('buildVideoCommand Template #5 Editorial split: avatar bottom half + FLUX2 top half', () => {
  const cmd = buildVideoCommand({
    scenes: sampleScenes(),
    musicPath: '/tmp/m.mp3',
    outputPath: '/tmp/out.mp4',
    globalAvatar: { videoPath: '/tmp/global_avatar.mp4', durationSec: 10, shape: 'split' },
  });
  const filter = cmd.args[cmd.args.indexOf('-filter_complex') + 1];
  assert.ok(filter.includes('scale=1080:576'), 'avatar scaled to 1080x576 (30% bottom strip of 9:16)');
  assert.ok(filter.includes('crop=1080:576'), 'crop to bottom-30% dims');
  assert.ok(filter.includes('[avatar_split]'), 'split-shape avatar label');
  assert.ok(filter.includes('overlay=x=0:y=1344'), 'avatar positioned at y=1344 (top of bottom 30%)');
  assert.ok(!filter.includes('[avatar_circ]'), 'split shape does NOT use circular mask');
  assert.ok(filter.includes('[vavatar]'), 'editorial uses avatar audio for voice');
});

test('buildVideoCommand Template #2 PiP: circular avatar overlay + global avatar audio', () => {
  const cmd = buildVideoCommand({
    scenes: sampleScenes(),
    musicPath: '/tmp/m.mp3',
    outputPath: '/tmp/out.mp4',
    globalAvatar: { videoPath: '/tmp/global_avatar.mp4', durationSec: 12 },
  });
  // Avatar input is the LAST input (after scenes + music).
  const inputCount = cmd.args.filter(a => a === '-i').length;
  assert.equal(inputCount, sampleScenes().length + 2, 'must add global avatar as last input');
  assert.ok(cmd.args.includes('/tmp/global_avatar.mp4'), 'avatar path in args');

  const filter = cmd.args[cmd.args.indexOf('-filter_complex') + 1];
  assert.ok(filter.includes('format=rgba'), 'avatar must be converted to RGBA for alpha mask');
  assert.ok(filter.includes('geq=r='), 'circular alpha mask via geq');
  assert.ok(filter.includes('hypot('), 'distance-from-center math');
  assert.ok(filter.includes('[avatar_circ]'), 'circular avatar label');
  assert.ok(filter.includes('overlay=x=60:y=140'), 'top-left overlay (60px from left, 140px from top — clears IG/TikTok top chrome)');
  assert.ok(filter.includes('[vfinal]'), 'final video label after overlay');
  assert.ok(filter.includes('[vavatar]'), 'avatar audio label for sidechain voice path');
  assert.ok(filter.includes('sidechaincompress'), 'music still ducked under avatar voice');

  // Map should select [vfinal] not [vout].
  const mapIdx = cmd.args.findIndex((a, i) => a === '-map' && cmd.args[i+1] === '[vfinal]');
  assert.ok(mapIdx > -1, 'output map must be [vfinal]');
});
