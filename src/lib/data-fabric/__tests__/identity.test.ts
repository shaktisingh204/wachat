/**
 * Unit tests for the data-fabric identity layer.
 *
 *   npx tsx --test src/lib/data-fabric/__tests__/identity.test.ts
 *
 * These tests stub the Mongo connection with a tiny in-memory fake so they
 * run without any infrastructure. We swap the `connectToDatabase` export of
 * `@/lib/mongodb` via Node's `require.cache` before the data-fabric modules
 * are first loaded, which means every collection accessor sees the fake.
 */

import { strict as assert } from 'node:assert';
import { test, before, beforeEach } from 'node:test';
import { createRequire } from 'node:module';

/* ══════════════════════════════════════════════════════════
   In-memory Mongo fake
   ══════════════════════════════════════════════════════════ */

interface FakeDoc {
  [k: string]: unknown;
  _id?: unknown;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_, val) => (val instanceof Date ? { __d: val.toISOString() } : val)),
    (_, val) => (val && typeof val === 'object' && '__d' in val ? new Date((val as { __d: string }).__d) : val),
  );
}

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

function matches(doc: FakeDoc, query: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(query)) {
    if (k === '$or' && Array.isArray(v)) {
      if (!v.some((sub) => matches(doc, sub as Record<string, unknown>))) return false;
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const op = v as Record<string, unknown>;
      if ('$exists' in op) {
        const exists = getPath(doc, k) !== undefined;
        if (op.$exists !== exists) return false;
        continue;
      }
      if ('$lt' in op) {
        const cur = getPath(doc, k);
        if (!(cur instanceof Date) || !(op.$lt instanceof Date)) return false;
        if (!(cur < op.$lt)) return false;
        continue;
      }
      if ('$in' in op) {
        const cur = getPath(doc, k);
        if (!(op.$in as unknown[]).includes(cur)) return false;
        continue;
      }
    }
    const cur = getPath(doc, k);
    if (cur !== v) return false;
  }
  return true;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

class FakeCollection {
  private docs: FakeDoc[] = [];
  private uniqueKeys: string[][] = [];

  async createIndex(spec: Record<string, number>, opts?: { unique?: boolean }): Promise<void> {
    if (opts?.unique) this.uniqueKeys.push(Object.keys(spec));
  }

  async findOne(query: Record<string, unknown>, _opts?: unknown): Promise<FakeDoc | null> {
    return this.docs.find((d) => matches(d, query)) ?? null;
  }

  find(query: Record<string, unknown> = {}) {
    const results = this.docs.filter((d) => matches(d, query));
    return {
      toArray: async () => results.map((d) => clone(d)),
      sort: () => ({ toArray: async () => results.map((d) => clone(d)) }),
    };
  }

  async insertOne(doc: FakeDoc): Promise<{ insertedId: unknown }> {
    for (const keys of this.uniqueKeys) {
      const exists = this.docs.find((d) => keys.every((k) => getPath(d, k) === getPath(doc, k)));
      if (exists) {
        const err = new Error('E11000 duplicate key') as Error & { code?: number };
        err.code = 11000;
        throw err;
      }
    }
    this.docs.push(clone(doc));
    return { insertedId: doc._id };
  }

  async updateOne(
    query: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const target = this.docs.find((d) => matches(d, query));
    if (!target) return { matchedCount: 0, modifiedCount: 0 };
    const set = update.$set as Record<string, unknown> | undefined;
    if (set) for (const [k, v] of Object.entries(set)) setPath(target as Record<string, unknown>, k, v);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(query: Record<string, unknown>): Promise<{ deletedCount: number }> {
    const idx = this.docs.findIndex((d) => matches(d, query));
    if (idx < 0) return { deletedCount: 0 };
    this.docs.splice(idx, 1);
    return { deletedCount: 1 };
  }

  // Helpers for tests
  _all(): FakeDoc[] {
    return this.docs;
  }
  _clear(): void {
    this.docs = [];
  }
}

const fakeCollections = new Map<string, FakeCollection>();
function getFakeCollection(name: string): FakeCollection {
  let col = fakeCollections.get(name);
  if (!col) {
    col = new FakeCollection();
    fakeCollections.set(name, col);
  }
  return col;
}

const fakeDb = {
  collection: <T>(name: string) => getFakeCollection(name) as unknown as T,
};

/* ══════════════════════════════════════════════════════════
   Stub @/lib/mongodb before importing data-fabric
   ══════════════════════════════════════════════════════════ */

const requireFromHere = createRequire(import.meta.url);
const mongoModulePath = requireFromHere.resolve('../../mongodb');
// Install a stub into Node's module cache.
requireFromHere.cache[mongoModulePath] = {
  id: mongoModulePath,
  filename: mongoModulePath,
  loaded: true,
  exports: {
    connectToDatabase: async () => ({ client: {}, db: fakeDb }),
  },
} as unknown as NodeJS.Module;

// Now import the modules under test. Dynamic to ensure the stub is in place.
let resolveContact: typeof import('../identity').resolveContact;
let mergeContacts: typeof import('../identity').mergeContacts;
let getContact: typeof import('../identity').getContact;
let normalizeIdentity: typeof import('../identity').normalizeIdentity;
let setTrait: typeof import('../cdp-traits').setTrait;
let getTrait: typeof import('../cdp-traits').getTrait;
let _resetEmitterForTests: typeof import('../events')._resetEmitterForTests;

before(async () => {
  const identityMod = await import('../identity');
  const traitsMod = await import('../cdp-traits');
  const eventsMod = await import('../events');
  resolveContact = identityMod.resolveContact;
  mergeContacts = identityMod.mergeContacts;
  getContact = identityMod.getContact;
  normalizeIdentity = identityMod.normalizeIdentity;
  setTrait = traitsMod.setTrait;
  getTrait = traitsMod.getTrait;
  _resetEmitterForTests = eventsMod._resetEmitterForTests;
});

beforeEach(() => {
  // Reset the in-memory store between tests for full isolation.
  for (const c of fakeCollections.values()) c._clear();
  if (_resetEmitterForTests) _resetEmitterForTests();
});

/* ══════════════════════════════════════════════════════════
   Tests
   ══════════════════════════════════════════════════════════ */

test('normalizeIdentity lowercases emails and strips phone formatting', () => {
  assert.equal(normalizeIdentity('email', '  Foo@Bar.COM '), 'foo@bar.com');
  assert.equal(normalizeIdentity('phone', '+1 (415) 555-0100'), '+14155550100');
  assert.equal(normalizeIdentity('phone', '4155550100'), '4155550100');
  assert.equal(normalizeIdentity('wachat_wa_id', '+91 98 7654 3210'), '+919876543210');
  assert.equal(normalizeIdentity('crm_lead_id', 'lead_abc'), 'lead_abc');
  assert.throws(() => normalizeIdentity('email', '   '));
});

test('resolveContact creates a canonical contact + identity row idempotently', async () => {
  const tenantId = 't1';
  const id1 = await resolveContact(tenantId, { type: 'email', value: 'Alice@Example.com' });
  const id2 = await resolveContact(tenantId, { type: 'email', value: 'alice@example.com' });
  const id3 = await resolveContact(tenantId, { type: 'email', value: 'ALICE@EXAMPLE.COM' });

  assert.equal(id1, id2);
  assert.equal(id2, id3);

  // Only one identity row should exist.
  const idCol = getFakeCollection('df_identities');
  assert.equal(idCol._all().length, 1);
  // And exactly one contact.
  const cCol = getFakeCollection('df_contacts');
  assert.equal(cCol._all().length, 1);

  const contact = await getContact(tenantId, id1);
  assert.ok(contact);
  assert.equal(contact!.primaryEmail, 'alice@example.com');
});

test('resolveContact is tenant-scoped — same identifier in two tenants → two contacts', async () => {
  const a = await resolveContact('tA', { type: 'phone', value: '+14155550100' });
  const b = await resolveContact('tB', { type: 'phone', value: '+14155550100' });
  assert.notEqual(a, b);
  assert.equal(getFakeCollection('df_contacts')._all().length, 2);
});

test('mergeContacts re-points identities, unions traits, and is idempotent', async () => {
  const tenantId = 't1';

  const winner = await resolveContact(tenantId, { type: 'email', value: 'shared@x.com' });
  const loser = await resolveContact(tenantId, { type: 'phone', value: '+15550001111' });

  await setTrait(tenantId, winner, 'plan', 'pro', { updatedAt: new Date('2025-01-01') });
  await setTrait(tenantId, loser, 'city', 'SF', { updatedAt: new Date('2025-01-02') });
  // Conflict: both set 'tier'; loser is older, winner should win.
  await setTrait(tenantId, loser, 'tier', 'silver', { updatedAt: new Date('2025-01-01') });
  await setTrait(tenantId, winner, 'tier', 'gold', { updatedAt: new Date('2025-01-03') });

  const canonical = await mergeContacts(tenantId, winner, loser);
  assert.equal(canonical, winner);

  // Both identities now point at the winner.
  const idCol = getFakeCollection('df_identities');
  const remaining = idCol._all();
  assert.equal(remaining.length, 2);
  for (const row of remaining) assert.equal(row.contactId, winner);

  // Traits unioned, conflict resolved via newer updatedAt.
  assert.equal(await getTrait(tenantId, winner, 'plan'), 'pro');
  assert.equal(await getTrait(tenantId, winner, 'city'), 'SF');
  assert.equal(await getTrait(tenantId, winner, 'tier'), 'gold');

  // Loser is tombstoned with mergedInto = winner.
  const loserDoc = getFakeCollection('df_contacts')
    ._all()
    .find((d) => d._id === loser);
  assert.ok(loserDoc);
  assert.equal(loserDoc!.mergedInto, winner);

  // Idempotence — re-running merge is a no-op.
  const again = await mergeContacts(tenantId, winner, loser);
  assert.equal(again, winner);

  // And resolving a stale id follows the chain.
  const live = await resolveContact(tenantId, { type: 'phone', value: '+15550001111' });
  assert.equal(live, winner);
});

test('setTrait honours last-write-wins per (tenantId, contactId, key)', async () => {
  const tenantId = 't1';
  const id = await resolveContact(tenantId, { type: 'email', value: 'lww@x.com' });

  const r1 = await setTrait(tenantId, id, 'score', 10, { updatedAt: new Date('2025-02-01') });
  const r2 = await setTrait(tenantId, id, 'score', 20, { updatedAt: new Date('2025-02-02') });
  const r3 = await setTrait(tenantId, id, 'score', 5, { updatedAt: new Date('2025-01-01') });

  assert.equal(r1, 'written');
  assert.equal(r2, 'written');
  assert.equal(r3, 'stale');
  assert.equal(await getTrait(tenantId, id, 'score'), 20);

  const missing = await setTrait(tenantId, 'does-not-exist', 'k', 'v');
  assert.equal(missing, 'missing');
});
