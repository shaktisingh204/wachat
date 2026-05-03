/**
 * Pure unit tests for the idempotency cache.  Uses an in-memory fake of the
 * tiny ioredis subset we touch (`get`, `set` with `EX`/`NX`, `del`) so the
 * suite runs without a real Redis.
 *
 * Run with:
 *   npx tsx --test src/lib/api-platform/__tests__/idempotency.test.ts
 *
 * Implementation note: the SUT (`idempotency.ts`) imports `server-only`,
 * which is bundled inside Next.js but absent from `node_modules`.  We
 * register a CJS resolver shim that maps `server-only` → `node:util`
 * (empty side-effect module) before loading the SUT via `require`.
 */

import { strict as assert } from 'node:assert';
import { test, before, beforeEach } from 'node:test';
import { createRequire } from 'node:module';
import NodeModule from 'node:module';
import type Redis from 'ioredis';

/* ── server-only resolver shim ────────────────────────────────────────────── */

type ResolverFn = (request: string, ...rest: unknown[]) => string;
type CjsModule = typeof NodeModule & { _resolveFilename: ResolverFn };

const req = createRequire(import.meta.url);
const SHIM_PATH = req.resolve('./server-only-shim.cjs');
{
  const cjs = NodeModule as CjsModule;
  const original = cjs._resolveFilename;
  cjs._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SHIM_PATH;
    return original.call(this, request, ...rest);
  } as ResolverFn;
}

/* ── Lazy SUT bindings (loaded after the shim is in place) ────────────────── */

type IdempMod = typeof import('../idempotency');
type ErrorsMod = typeof import('../errors');

let idemp: IdempMod;
let errors: ErrorsMod;

before(async () => {
  idemp = (await import('../idempotency')) as IdempMod;
  errors = (await import('../errors')) as ErrorsMod;
});

/* ── In-memory ioredis stub ───────────────────────────────────────────────── */

type Entry = { value: string; expiresAt: number | null };

class FakeRedis {
  private store = new Map<string, Entry>();

  async get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }

  async set(
    key: string,
    value: string,
    ...args: Array<string | number>
  ): Promise<'OK' | null> {
    let nx = false;
    let ttl: number | null = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === 'NX') nx = true;
      if (a === 'EX' && typeof args[i + 1] === 'number') {
        ttl = args[i + 1] as number;
      }
    }
    if (nx && this.store.has(key)) {
      const existing = this.store.get(key)!;
      if (existing.expiresAt === null || existing.expiresAt > Date.now()) {
        return null;
      }
    }
    this.store.set(key, {
      value,
      expiresAt: ttl ? Date.now() + ttl * 1000 : null,
    });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  on(): this {
    return this;
  }

  async hmget(): Promise<string[]> {
    return [];
  }
}

beforeEach(() => {
  idemp.__setRedisForTest(new FakeRedis() as unknown as Redis);
});

/* ── Tests ────────────────────────────────────────────────────────────────── */

test('hashBody produces stable digest and ignores undefined', () => {
  assert.equal(idemp.hashBody(undefined), '');
  assert.equal(idemp.hashBody(null), '');
  const a = idemp.hashBody({ b: 2, a: 1 });
  const b = idemp.hashBody({ b: 2, a: 1 });
  assert.equal(a, b);
  assert.notEqual(a, idemp.hashBody({ a: 1, b: 3 }));
});

test('withIdempotency runs once and replays on second call', async () => {
  let calls = 0;
  const produce = async () => {
    calls += 1;
    return { status: 201, headers: { 'x-test': 'first' }, body: { ok: true, calls } };
  };

  const first = await idemp.withIdempotency('tenantA', 'key-1', { foo: 'bar' }, produce);
  assert.equal(first.replayed, false);
  assert.equal(first.status, 201);
  assert.equal(JSON.parse(first.body).calls, 1);

  const second = await idemp.withIdempotency('tenantA', 'key-1', { foo: 'bar' }, produce);
  assert.equal(second.replayed, true);
  assert.equal(second.status, 201);
  assert.equal(JSON.parse(second.body).calls, 1);
  assert.equal(calls, 1, 'producer invoked exactly once across the two calls');
  assert.equal(second.headers['idempotency-replayed'], 'true');
});

test('withIdempotency throws idempotency_conflict on body mismatch', async () => {
  const produce = async () => ({ status: 200, body: { ok: true } });
  await idemp.withIdempotency('tenantA', 'key-2', { v: 1 }, produce);

  let caught: unknown;
  try {
    await idemp.withIdempotency('tenantA', 'key-2', { v: 2 }, produce);
  } catch (err) {
    caught = err;
  }
  assert.ok(errors.isApiError(caught), 'expected an ApiError');
  assert.equal((caught as InstanceType<typeof errors.ApiError>).type, 'idempotency_conflict');
  assert.equal((caught as InstanceType<typeof errors.ApiError>).status, 409);
});

test('withIdempotency runs producer when no key supplied (opt-out)', async () => {
  let calls = 0;
  const produce = async () => {
    calls += 1;
    return { status: 200, body: { calls } };
  };
  const a = await idemp.withIdempotency('tenantA', null, { x: 1 }, produce);
  const b = await idemp.withIdempotency('tenantA', undefined, { x: 1 }, produce);
  assert.equal(a.replayed, false);
  assert.equal(b.replayed, false);
  assert.equal(calls, 2, 'no key means no replay protection');
});

test('different tenants are isolated under same key', async () => {
  const produceA = async () => ({ status: 200, body: { who: 'A' } });
  const produceB = async () => ({ status: 200, body: { who: 'B' } });

  const a = await idemp.withIdempotency('tenantA', 'shared', { same: true }, produceA);
  const b = await idemp.withIdempotency('tenantB', 'shared', { same: true }, produceB);
  assert.equal(JSON.parse(a.body).who, 'A');
  assert.equal(JSON.parse(b.body).who, 'B');
  assert.equal(a.replayed, false);
  assert.equal(b.replayed, false);
});
