/**
 * V2.13 — Idempotency-Key replay behaviour of the public send route's
 * underlying helper (the REUSED platform `withIdempotency`, driven by a
 * fake Redis).
 *
 *   NODE_PATH=src/workers/_stubs npx tsx --test \
 *     src/lib/sabsms/__tests__/idempotency-replay.test.ts
 *
 * (`server-only` is stubbed via NODE_PATH, same as the agent/worker
 * test suites.)
 */

import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import type Redis from 'ioredis';

import {
  __setRedisForTest,
  hashBody,
  withIdempotency,
} from '../../api-platform/idempotency';
import { isApiError } from '../../api-platform/errors';

/** Minimal in-memory Redis double covering get/set(NX,EX)/del. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, ...args: unknown[]) {
      const nx = args.includes('NX');
      if (nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async del(key: string) {
      const had = store.delete(key);
      return had ? 1 : 0;
    },
  };
}

describe('withIdempotency (reused platform helper)', () => {
  let redis: ReturnType<typeof fakeRedis>;

  beforeEach(() => {
    redis = fakeRedis();
    __setRedisForTest(redis as unknown as Redis);
  });

  it('first call runs produce; replay returns the cached response without re-running', async () => {
    let runs = 0;
    const produce = async () => {
      runs += 1;
      return { status: 201, body: { id: 'msg_1', status: 'queued' } };
    };
    const body = { to: '+14155550100', body: 'hi' };

    const first = await withIdempotency('ws1', 'idem-key-1', body, produce);
    assert.equal(first.status, 201);
    assert.equal(first.replayed, false);
    assert.equal(runs, 1);

    const second = await withIdempotency('ws1', 'idem-key-1', body, produce);
    assert.equal(second.status, 201);
    assert.equal(second.replayed, true);
    assert.equal(second.body, first.body);
    assert.equal(runs, 1, 'produce must not run again on replay');
  });

  it('same key + different body → 409 idempotency conflict', async () => {
    const produce = async () => ({ status: 201, body: { id: 'msg_1' } });
    await withIdempotency('ws1', 'idem-key-2', { to: 'A' }, produce);

    await assert.rejects(
      () => withIdempotency('ws1', 'idem-key-2', { to: 'B' }, produce),
      (err: unknown) => isApiError(err) && err.type === 'idempotency_conflict',
    );
  });

  it('keys are tenant-scoped — another workspace re-runs produce', async () => {
    let runs = 0;
    const produce = async () => {
      runs += 1;
      return { status: 201, body: { id: `msg_${runs}` } };
    };
    await withIdempotency('ws1', 'shared-key', { a: 1 }, produce);
    await withIdempotency('ws2', 'shared-key', { a: 1 }, produce);
    assert.equal(runs, 2);
  });

  it('no key = no caching', async () => {
    let runs = 0;
    const produce = async () => {
      runs += 1;
      return { status: 201, body: { n: runs } };
    };
    await withIdempotency('ws1', null, { a: 1 }, produce);
    await withIdempotency('ws1', undefined, { a: 1 }, produce);
    assert.equal(runs, 2);
  });

  it('hashBody is stable for identical JSON and empty for null/undefined', () => {
    assert.equal(hashBody({ a: 1 }), hashBody({ a: 1 }));
    assert.notEqual(hashBody({ a: 1 }), hashBody({ a: 2 }));
    assert.equal(hashBody(null), '');
    assert.equal(hashBody(undefined), '');
  });
});
