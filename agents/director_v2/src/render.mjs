import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

let _browser = null;
const _stats = { launchCount: 0 };

async function getBrowser() {
  if (_browser && _browser.connected) return _browser;
  _stats.launchCount++;
  _browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return _browser;
}

export function __getBrowserStats() { return { ..._stats }; }

export async function closeBrowser() {
  if (_browser) { try { await _browser.close(); } catch {} _browser = null; }
}

export async function renderScene(html, scene, outDir, { fps = 30 } = {}) {
  await mkdir(outDir, { recursive: true });
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  // networkidle0 with a hard timeout — slow Google Fonts must not block forever
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});

  const outputs = [];
  if (!scene.kinetic) {
    const path = join(outDir, `scene_${scene.index}.jpg`);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92, fullPage: false, omitBackground: false });
    await writeFile(path, buf);
    outputs.push(path);
  } else {
    const totalFrames = Math.max(1, Math.round(fps * scene.duration));
    for (let f = 0; f < totalFrames; f++) {
      const progress = f / Math.max(1, totalFrames - 1);
      await page.evaluate((p) => { window.__kineticProgress = p; }, progress);
      const path = join(outDir, `scene_${scene.index}_${String(f).padStart(3, '0')}.png`);
      const buf = await page.screenshot({ type: 'png', fullPage: false, omitBackground: false });
      await writeFile(path, buf);
      outputs.push(path);
    }
  }
  await page.close();
  return outputs;
}
