import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  enforcePerVideoBudget, BudgetExceededError,
  __setStatePath, registerNanoBananaCall, shouldForcePexelsFallback,
  MAX_NANO_BANANA_PER_VIDEO, MONTHLY_CAP_CENTS, COST_PER_CALL_CENTS,
} from '../src/cost_control.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, '..', 'tmp', 'test_usage.json');

function resetState() {
  mkdirSync(dirname(STATE), { recursive: true });
  if (existsSync(STATE)) rmSync(STATE);
  __setStatePath(STATE);
}

test('enforcePerVideoBudget throws when >MAX Nano Banana scenes', () => {
  resetState();
  const scenes = Array(MAX_NANO_BANANA_PER_VIDEO + 1).fill({ heroSource: 'nano_banana' });
  assert.throws(() => enforcePerVideoBudget(scenes), (e) => e instanceof BudgetExceededError);
});

test('enforcePerVideoBudget passes when at or under MAX', () => {
  resetState();
  const scenes = Array(MAX_NANO_BANANA_PER_VIDEO).fill({ heroSource: 'nano_banana' });
  assert.doesNotThrow(() => enforcePerVideoBudget(scenes));
});

test('shouldForcePexelsFallback returns true when this video would overflow monthly cap', async () => {
  resetState();
  const month = new Date().toISOString().slice(0, 7);
  writeFileSync(STATE, JSON.stringify({ [month]: { calls: 0, cents: MONTHLY_CAP_CENTS - 2, videos: 10 } }));
  const scenes = [{ heroSource: 'nano_banana' }, { heroSource: 'nano_banana' }];
  const force = await shouldForcePexelsFallback(scenes);
  assert.equal(force, true);
});

test('registerNanoBananaCall creates atomic write and increments counter', async () => {
  resetState();
  await registerNanoBananaCall(4);
  await registerNanoBananaCall(4);
  const raw = JSON.parse(readFileSync(STATE, 'utf8'));
  const month = new Date().toISOString().slice(0, 7);
  assert.equal(raw[month].cents, 8);
  assert.equal(raw[month].calls, 2);
});

test('corrupt state file is re-initialized without crash', async () => {
  resetState();
  writeFileSync(STATE, 'not-json-at-all');
  await registerNanoBananaCall(COST_PER_CALL_CENTS);
  const raw = JSON.parse(readFileSync(STATE, 'utf8'));
  const month = new Date().toISOString().slice(0, 7);
  assert.equal(raw[month].cents, COST_PER_CALL_CENTS);
});
