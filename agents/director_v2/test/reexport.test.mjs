import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, dimsForAspect, VALID_ASPECTS } from '../src/themes.mjs';
import { wrapSlideHtml } from '../src/wrapper.mjs';

test('themes re-export exposes THEMES T1-T5', () => {
  assert.equal(Object.keys(THEMES).sort().join(','), 'T1,T2,T3,T4,T5');
  assert.equal(THEMES.T1.bg, '#0D3B2E');
});

test('dimsForAspect 9:16 returns 1080x1920', () => {
  assert.deepEqual(dimsForAspect('9:16'), { width: 1080, height: 1920 });
});

test('VALID_ASPECTS includes 9:16', () => {
  assert.ok(VALID_ASPECTS.includes('9:16'));
});

test('wrapper.wrapSlideHtml returns HTML with inlined logo', () => {
  const REMOTE_LOGO_URL = 'https://pinnaclegroupwi.com/wp-content/uploads/2026/03/logo-pinnacle.png';
  const html = wrapSlideHtml(`<div><img src="${REMOTE_LOGO_URL}"/>test</div>`, 'T1', '9:16');
  assert.ok(html.includes('height:1920px'));
  assert.ok(html.includes('data:image/png;base64,'));
});
