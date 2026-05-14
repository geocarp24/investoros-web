import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneHtml } from '../src/scene_layout.mjs';
import { THEMES } from '../src/themes.mjs';

function mkScene(over = {}) {
  return {
    index: 2, duration: 2.0, layoutType: 'layout_d',
    captionEn: 'FASTER THAN BANKS', captionEs: 'Más rápido que los bancos',
    heroSource: 'pexels', heroQuery: 'clock time money', heroPrompt: null,
    kinetic: false, zoompan: { from: 1.0, to: 1.03 }, transitionOut: 'wipeleft',
    mood: 'upbeat',
    ...over,
  };
}

test('layout_d includes hero img, gradient overlay, both captions, logo', () => {
  const html = buildSceneHtml(mkScene(), '/tmp/hero.jpg', 'T1', '9:16');
  assert.ok(html.includes('<img'), 'must include hero img tag');
  assert.ok(html.includes('/tmp/hero.jpg') || html.includes('file:///tmp/hero.jpg'), 'must reference hero path');
  assert.ok(html.includes('FASTER THAN BANKS'), 'must include EN caption');
  assert.ok(html.includes('Más rápido que los bancos'), 'must include ES caption');
  assert.ok(html.includes('linear-gradient'), 'must include gradient overlay');
  assert.ok(html.includes('top:48px') && html.includes('right:48px'), 'logo top-right');
});

test('heroSource theme_solid omits img and uses background', () => {
  const html = buildSceneHtml(mkScene({ heroSource: 'theme_solid' }), null, 'T1', '9:16');
  assert.ok(!html.includes('<img src="file://'), 'must NOT include hero img tag with file:// src');
  assert.ok(html.includes('radial-gradient') || html.includes(THEMES.T1.bg), 'must use theme colors as bg');
});

test('HTML escape applied to captions', () => {
  const html = buildSceneHtml(
    mkScene({ captionEn: '<script>alert(1)</script>', captionEs: 'a & b' }),
    '/tmp/h.jpg', 'T1', '9:16'
  );
  assert.ok(!html.includes('<script>alert(1)</script>'), 'must escape script tag');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('a &amp; b'));
});

test('9:16 aspect yields height:1920px wrapper', () => {
  const html = buildSceneHtml(mkScene(), '/tmp/h.jpg', 'T1', '9:16');
  assert.ok(html.includes('1920'), 'must include 1920 height for 9:16');
});

test('theme T3 overlay uses T3 bg color', () => {
  const html = buildSceneHtml(mkScene(), '/tmp/h.jpg', 'T3', '9:16');
  assert.ok(html.includes(THEMES.T3.bg), 'must include theme T3 bg color in overlay');
});

test('layoutType hook uses large centered caption (hero slide treatment)', () => {
  const html = buildSceneHtml(mkScene({ layoutType: 'hook', captionEn: 'HEY' }), '/tmp/h.jpg', 'T1', '9:16');
  assert.ok(html.includes('HEY'));
  assert.ok(html.match(/font-size:\s*1[0-9][0-9]px/), 'hook caption should be ≥100px font-size');
});

test('layoutType point uses centered caption with accent color', () => {
  const html = buildSceneHtml(mkScene({ layoutType: 'point', captionEn: 'CASH OFFER', captionEs: 'Oferta En Efectivo' }), '/tmp/h.jpg', 'T1', '9:16');
  assert.ok(html.includes('CASH OFFER'), 'must include EN caption');
  assert.ok(html.includes('Oferta En Efectivo'), 'must include ES caption');
  assert.ok(html.includes('justify-content:center') && html.includes('align-items:center'), 'point caption must be centered');
  assert.ok(html.includes(THEMES.T1.accent), 'point EN caption must use theme accent color');
  assert.ok(!html.includes('backdrop-filter'), 'point layout must NOT use bottom-third backdrop-blur band');
});

test('layoutType cta includes Pinnacle phone and URL', () => {
  const html = buildSceneHtml(mkScene({ layoutType: 'cta', captionEn: 'Call now' }), '/tmp/h.jpg', 'T1', '9:16');
  assert.ok(html.includes('(920) 777-9886') || html.includes('920.777.9886') || html.includes('9207779886'));
  assert.ok(html.includes('pinnaclegroupwi.com'));
});

test('kinetic=true adds data-kinetic attribute on root wrapper', () => {
  const html = buildSceneHtml(mkScene({ kinetic: true }), '/tmp/h.jpg', 'T1', '9:16');
  assert.ok(html.includes('data-kinetic="true"'));
});
