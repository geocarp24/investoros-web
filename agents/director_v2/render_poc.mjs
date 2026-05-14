#!/usr/bin/env node
// Director v2 — POC standalone runner
// Generates one example reel from a hardcoded spec, optionally uploads to Cloudinary.
// Usage:
//   doppler run -- node render_poc.mjs            # full pipeline (render + upload)
//   doppler run -- node render_poc.mjs --no-upload  # skip Cloudinary, keep local mp4
//   doppler run -- node render_poc.mjs --premium    # use nano_banana for hook + cta

import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandNarrative, validateSpec } from './src/narratives/index.mjs';
import { buildSceneHtml } from './src/scene_layout.mjs';
import { wrapSlideHtml } from './src/wrapper.mjs';
import { renderScene, closeBrowser } from './src/render.mjs';
import { searchPortrait, downloadToFile, PexelsNoResultsError } from './src/pexels.mjs';
import { generateImage as nanoBananaGenerate, NanoBananaFailedError } from './src/nano_banana.mjs';
import { pickMusic } from './src/audio.mjs';
import { buildVideoCommand, runFfmpeg } from './src/ffmpeg.mjs';
import { uploadVideo } from './src/cloudinary.mjs';

const HERE    = dirname(fileURLToPath(import.meta.url));
const TMP     = join(HERE, 'tmp', 'poc');
const SAMPLES = join(HERE, 'samples');

// Approved phrase pool — NO specific time commitments (Jorge rule 2026-04-25).
// POC picks 3 at random per run for variety.
const APPROVED_POINTS = [
  { headingEn: 'Cash Offer',         headingEs: 'Oferta En Efectivo'    },
  { headingEn: 'No Commissions',     headingEs: 'Sin Comisiones'        },
  { headingEn: 'No Repairs',         headingEs: 'Sin Reparaciones'      },
  { headingEn: 'No Showings',        headingEs: 'Sin Visitas'           },
  { headingEn: 'Faster Than Banks',  headingEs: 'Mas Rapido Que Bancos' },
  { headingEn: 'Weeks Not Months',   headingEs: 'Semanas No Meses'      },
  { headingEn: 'Any Condition',      headingEs: 'Cualquier Condicion'   },
  { headingEn: 'Sell As-Is',         headingEs: 'Vende Tal Como Esta'   },
];

function pickRandomPoints(n = 3) {
  const pool = [...APPROVED_POINTS];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

const POC_SPEC = {
  narrative: 'B',
  aspect: '9:16',
  theme: 'T1',
  duration: 11,
  mood: 'upbeat',
  hook:   { en: 'Sell Your House Fast in Wisconsin', es: 'Vende Tu Casa Rapido en Wisconsin' },
  points: pickRandomPoints(3),
  cta: { en: 'Call Pinnacle Today', es: 'Llama A Pinnacle Hoy' },
};

async function resolveHero(scene, { pexelsKey, geminiKey, replicateKey, tmpDir, stats }) {
  const heroPath = join(tmpDir, `hero_${scene.index}.bin`);
  let effective = scene.heroSource;

  if (effective === 'flux_schnell') {
    try {
      const mod = await import('./src/replicate_image.mjs');
      const { imageBuffer, costCents } = await mod.generateImage(scene.heroPrompt, { apiKey: replicateKey });
      stats.replicateCalls++; stats.replicateCents += costCents;
      await writeFile(heroPath, imageBuffer);
      console.log(`[scene ${scene.index}] flux_schnell ok (${costCents}c)`);
      return { path: heroPath, sourceActual: 'flux_schnell' };
    } catch (err) {
      const mod = await import('./src/replicate_image.mjs');
      if (!(err instanceof mod.ReplicateFailedError)) throw err;
      console.warn(`[scene ${scene.index}] flux_schnell failed → nano_banana: ${err.message}`);
      stats.fallback++;
      effective = 'nano_banana';
    }
  }

  if (effective === 'nano_banana') {
    try {
      const { imageBuffer, costCents } = await nanoBananaGenerate(scene.heroPrompt, { apiKey: geminiKey });
      stats.nanoBananaCalls++; stats.nanoBananaCents += costCents;
      await writeFile(heroPath, imageBuffer);
      console.log(`[scene ${scene.index}] nano_banana ok (${costCents}c)`);
      return { path: heroPath, sourceActual: 'nano_banana' };
    } catch (err) {
      if (!(err instanceof NanoBananaFailedError)) throw err;
      console.warn(`[scene ${scene.index}] nano_banana failed → pexels: ${err.message}`);
      stats.fallback++;
      effective = 'pexels';
      scene.heroQuery = scene.heroQuery || 'real estate wisconsin';
    }
  }

  if (effective === 'pexels') {
    try {
      const photo = await searchPortrait(scene.heroQuery, { apiKey: pexelsKey });
      stats.pexelsCalls++;
      await downloadToFile(photo.downloadUrl, heroPath);
      console.log(`[scene ${scene.index}] pexels ok ("${scene.heroQuery}")`);
      return { path: heroPath, sourceActual: 'pexels' };
    } catch (err) {
      if (!(err instanceof PexelsNoResultsError)) throw err;
      console.warn(`[scene ${scene.index}] pexels no results → theme_solid`);
      stats.fallback++;
    }
  }

  console.log(`[scene ${scene.index}] theme_solid`);
  return { path: null, sourceActual: 'theme_solid' };
}

async function main() {
  const args = process.argv.slice(2);
  const skipUpload = args.includes('--no-upload');
  const premium    = args.includes('--premium');
  if (premium) POC_SPEC.image_quality = 'premium';

  const env = {
    PEXELS_API_KEY:        process.env.PEXELS_API_KEY,
    GEMINI_API_KEY=[REDACTED],
    REPLICATE_API_TOKEN=[REDACTED],
    CLOUDINARY_NAME:       process.env.CLOUDINARY_NAME,
    CLOUDINARY_API_KEY:    process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  const required = skipUpload
    ? ['PEXELS_API_KEY', 'GEMINI_API_KEY', 'REPLICATE_API_TOKEN']
    : Object.keys(env);
  for (const k of required) {
    if (!env[k]) { console.error(`ERROR: env ${k} missing (run via doppler)`); process.exit(1); }
  }

  await rm(TMP, { recursive: true, force: true });
  await mkdir(TMP, { recursive: true });
  await mkdir(SAMPLES, { recursive: true });

  validateSpec(POC_SPEC);
  const scenes = expandNarrative(POC_SPEC);
  const stats  = { fallback: 0, nanoBananaCalls: 0, nanoBananaCents: 0, replicateCalls: 0, replicateCents: 0, pexelsCalls: 0 };
  const start  = Date.now();

  console.log(`Director v2 POC — narrative=${POC_SPEC.narrative} theme=${POC_SPEC.theme} tier=${premium ? 'premium' : 'standard'}`);
  console.log(`Random points selected: ${POC_SPEC.points.map(p => p.headingEn).join(' / ')}`);

  const frameOutputs = [];
  for (const scene of scenes) {
    const hero = await resolveHero(scene, {
      pexelsKey: env.PEXELS_API_KEY, geminiKey: env.GEMINI_API_KEY, replicateKey: env.REPLICATE_API_TOKEN,
      tmpDir: TMP, stats,
    });
    const body  = buildSceneHtml(scene, hero.path, POC_SPEC.theme, POC_SPEC.aspect);
    const html  = wrapSlideHtml(body, POC_SPEC.theme, POC_SPEC.aspect);
    const files = await renderScene(html, scene, TMP);
    frameOutputs.push({
      index: scene.index, duration: scene.duration, imagePaths: files,
      zoompan: scene.zoompan, transitionOut: scene.transitionOut, kinetic: scene.kinetic,
    });
  }

  const totalDur  = scenes.reduce((t, s) => t + s.duration, 0);
  const musicPath = pickMusic(POC_SPEC.mood, totalDur);
  const outputPath = join(SAMPLES, `poc_${Date.now()}.mp4`);

  console.log(`Composing video → ${outputPath}`);
  const cmd = buildVideoCommand({ scenes: frameOutputs, musicPath, outputPath });
  await runFfmpeg(cmd);
  await closeBrowser();

  const { size } = await stat(outputPath);
  const sizeMb   = (size / 1_048_576).toFixed(2);
  const elapsed  = ((Date.now() - start) / 1000).toFixed(1);

  let publicUrl = null;
  if (!skipUpload) {
    console.log('Uploading to Cloudinary...');
    const upload = await uploadVideo(outputPath, {
      publicId: `directorv2/poc_${Date.now()}`,
      folder: 'pinnacle-social-media/videos/poc',
      cloudName: env.CLOUDINARY_NAME, apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET,
    });
    publicUrl = upload.secure_url;
  }

  console.log(`
========================================
Director v2 POC — DONE
========================================
Local file:        ${outputPath}
Size:              ${sizeMb} MB
Duration:          ${totalDur.toFixed(1)}s
Elapsed:           ${elapsed}s
Replicate calls:   ${stats.replicateCalls} (${stats.replicateCents}c)
Nano Banana calls: ${stats.nanoBananaCalls} (${stats.nanoBananaCents}c)
Pexels calls:      ${stats.pexelsCalls}
Fallbacks:         ${stats.fallback}
${publicUrl ? `Cloudinary URL:    ${publicUrl}` : 'Upload skipped (--no-upload)'}
========================================`.trim());
}

main().catch(err => { console.error('POC FAIL:', err); process.exit(1); });
