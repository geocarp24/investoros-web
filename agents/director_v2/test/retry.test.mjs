import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../src/util/retry.mjs';

test('withRetry returns value when fn succeeds first try', async () => {
  let calls = 0;
  const result = await withRetry(async () => { calls++; return 42; }, { attempts: 3, baseDelayMs: 1 });
  assert.equal(result, 42);
  assert.equal(calls, 1);
});

test('withRetry retries on failure and succeeds on attempt 3', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls < 3) throw new Error(`fail ${calls}`);
    return 'ok';
  };
  const onRetryCalls = [];
  const result = await withRetry(fn, {
    attempts: 3,
    baseDelayMs: 1,
    onRetry: (err, n, delay) => onRetryCalls.push({ n, msg: err.message, delay })
  });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
  assert.equal(onRetryCalls.length, 2);
  assert.equal(onRetryCalls[0].n, 1);
  assert.equal(onRetryCalls[1].n, 2);
  assert.equal(onRetryCalls[0].delay, 1);
  assert.equal(onRetryCalls[1].delay, 2);
});

test('withRetry throws last error when all attempts fail', async () => {
  let calls = 0;
  const fn = async () => { calls++; throw new Error(`fail_${calls}`); };
  await assert.rejects(
    withRetry(fn, { attempts: 3, baseDelayMs: 1 }),
    /fail_3/
  );
  assert.equal(calls, 3);
});
