import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderScene, closeBrowser, __getBrowserStats } from '../src/render.mjs';
import { buildSceneHtml } from '../src/scene_layout.mjs';
import { wrapSlideHtml } from '../src/wrapper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP  = join(HERE, '..', 'tmp', 'render_test');

function setupTmp() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
}

test('renderScene kinetic=false writes exactly 1 JPG', async (t) => {
  t.after(() => closeBrowser());
  setupTmp();
  const scene = { index: 1, duration: 2.0, layoutType: 'layout_d', captionEn: 'TEST', captionEs: 'PRUEBA',
                  heroSource: 'theme_solid', kinetic: false, zoompan: null, transitionOut: 'cut', mood: 'upbeat' };
  const body = buildSceneHtml(scene, null, 'T1', '9:16');
  const html = wrapSlideHtml(body, 'T1', '9:16');
  const out = await renderScene(html, scene, TMP);
  assert.equal(out.length, 1);
  assert.ok(out[0].endsWith('.jpg'));
  assert.ok(existsSync(out[0]));
});

test('renderScene kinetic=true writes N PNG frames = fps × duration', async (t) => {
  t.after(() => closeBrowser());
  setupTmp();
  const scene = { index: 1, duration: 1.0, layoutType: 'hook', captionEn: 'K', captionEs: 'k',
                  heroSource: 'theme_solid', kinetic: true, zoompan: null, transitionOut: 'cut', mood: 'upbeat' };
  const body = buildSceneHtml(scene, null, 'T1', '9:16');
  const html = wrapSlideHtml(body, 'T1', '9:16');
  const out = await renderScene(html, scene, TMP, { fps: 10 });
  assert.equal(out.length, 10, 'should produce 10 frames for 1s @ 10fps');
  for (const p of out) assert.ok(p.endsWith('.png'));
  assert.ok(existsSync(out[0]));
});

test('renderScene reuses the browser singleton across calls', async (t) => {
  t.after(() => closeBrowser());
  setupTmp();
  const scene = { index: 1, duration: 1.0, layoutType: 'layout_d', captionEn: 'A', captionEs: 'a',
                  heroSource: 'theme_solid', kinetic: false, zoompan: null, transitionOut: 'cut', mood: 'upbeat' };
  const body = buildSceneHtml(scene, null, 'T1', '9:16');
  const html = wrapSlideHtml(body, 'T1', '9:16');
  // launchCount is module-level and accumulates across tests in the same process.
  // Capture the baseline so we measure THIS test's contribution: must be exactly +1.
  const before = __getBrowserStats().launchCount;
  await renderScene(html, scene, TMP);
  await renderScene(html, { ...scene, index: 2 }, TMP);
  const after = __getBrowserStats().launchCount;
  assert.equal(after - before, 1, 'browser should launch exactly once for 2 scenes within a single test');
});
