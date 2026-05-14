import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_NANO_BANANA_PER_VIDEO = 3;
export const MONTHLY_CAP_CENTS = 1000;
export const COST_PER_CALL_CENTS = 4;

const HERE = dirname(fileURLToPath(import.meta.url));
let _statePath = join(HERE, '..', 'state', 'nano_banana_usage.json');

export function __setStatePath(p) { _statePath = p; }

export class BudgetExceededError extends Error {
  constructor(msg) { super(msg); this.name = 'BudgetExceededError'; }
}

export function enforcePerVideoBudget(scenes) {
  const n = scenes.filter(s => s.heroSource === 'nano_banana').length;
  if (n > MAX_NANO_BANANA_PER_VIDEO) {
    throw new BudgetExceededError(`per-video Nano Banana cap exceeded: ${n} > ${MAX_NANO_BANANA_PER_VIDEO}`);
  }
}

async function loadUsage() {
  if (!existsSync(_statePath)) return {};
  try { return JSON.parse(await readFile(_statePath, 'utf8')); }
  catch { return {}; }
}

async function writeUsageAtomic(data) {
  await mkdir(dirname(_statePath), { recursive: true });
  const tmp = `${_statePath}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, _statePath);
}

function currentMonth() { return new Date().toISOString().slice(0, 7); }

export async function shouldForcePexelsFallback(scenes) {
  const usage = await loadUsage();
  const month = currentMonth();
  const current = usage[month]?.cents || 0;
  const thisVideoCents = scenes.filter(s => s.heroSource === 'nano_banana').length * COST_PER_CALL_CENTS;
  return (current + thisVideoCents) > MONTHLY_CAP_CENTS;
}

export async function registerNanoBananaCall(costCents) {
  const usage = await loadUsage();
  const month = currentMonth();
  const bucket = usage[month] || { calls: 0, cents: 0, videos: 0 };
  bucket.calls += 1;
  bucket.cents += costCents;
  usage[month] = bucket;
  await writeUsageAtomic(usage);
}
