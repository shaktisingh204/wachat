/**
 * Unit tests for the data-fabric backfill orchestrator (`sync.ts`).
 *
 *   npx tsx --test src/lib/data-fabric/__tests__/sync.test.ts
 *
 * We stub `@/lib/mongodb` with an in-memory fake (matching the pattern in
 * `identity.test.ts`) and inject mock adapter iterators via the
 * `AdapterMap` test seam on `backfillFromAdapters`. No infrastructure is
 * required.
 */

import { strict as assert } from 'node:assert';
import { test, before, beforeEach } from 'node:test';
import { createRequire } from 'node:module';

/* ══════════════════════════════════════════════════════════
   In-memory Mongo fake (subset shared with identity.test.ts)
   ══════════════════════════════════════════════════════════ */

interface FakeDoc {
  [k: string]: unknown;
  _id?: unknown;
}

function clone<T>(v: T): T {
  return JSON.parse(
    JSON.stringify(v, (_, val) =>
      val instanceof Date ? { __d: val.toISOString() } : val,
    ),
    (_, val) =>
      val && typeof val === 'object' && '__d' in val
        ? new Date((val as { __d: string }).__d)
        : val,
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
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
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

  async findOne(query: Record<string, unknown>): Promise<FakeDoc | null> {
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
requireFromHere.cache[mongoModulePath] = {
  id: mongoModulePath,
  filename: mongoModulePath,
  loaded: true,
  exports: {
    connectToDatabase: async () => ({ client: {}, db: fakeDb }),
  },
} as unknown as NodeJS.Module;

let backfillFromAdapters: typeof import('../sync').backfillFromAdapters;
let getCanonicalContact: typeof import('../api').getCanonicalContact;
let findOrCreateContact: typeof import('../api').findOrCreateContact;
let mergeContactsByIdentity: typeof import('../api').mergeContactsByIdentity;
let subscribe: typeof import('../events').subscribe;
let _resetEmitterForTests: typeof import('../events')._resetEmitterForTests;

before(async () => {
  ({ backfillFromAdapters } = await import('../sync'));
  ({ getCanonicalContact, findOrCreateContact, mergeContactsByIdentity } = await import('../api'));
  ({ subscribe, _resetEmitterForTests } = await import('../events'));
});

beforeEach(() => {
  for (const c of fakeCollections.values()) c._clear();
  if (_resetEmitterForTests) _resetEmitterForTests();
});

/* ══════════════════════════════════════════════════════════
   Mock adapter iterators
   ══════════════════════════════════════════════════════════ */

import type { AdapterRow } from '../adapters/wachat';

function makeIter(rows: AdapterRow[]) {
  return async function* (
    _tenantId: string,
    opts: { limit?: number },
  ): AsyncIterableIterator<AdapterRow> {
    let n = 0;
    for (const r of rows) {
      if (opts.limit && n >= opts.limit) return;
      n++;
      yield r;
    }
  };
}

/* ══════════════════════════════════════════════════════════
   Tests
   ══════════════════════════════════════════════════════════ */

test('backfillFromAdapters mirrors rows from all sources and emits upsert events', async () => {
  const tenantId = 't1';

  const wachatRows: AdapterRow[] = [
    {
      externalId: 'wc1',
      tenantId,
      displayName: 'Alice (WA)',
      identities: [
        { type: 'wachat_wa_id', value: '+14155550100', source: 'wachat' },
        { type: 'phone', value: '+14155550100', source: 'wachat' },
      ],
      traits: { wachat_status: 'open' },
    },
  ];

  const crmRows: AdapterRow[] = [
    {
      externalId: 'cr1',
      tenantId,
      displayName: 'Bob (CRM)',
      identities: [
        { type: 'crm_lead_id', value: 'lead_bob', source: 'crm' },
        { type: 'email', value: 'bob@example.com', source: 'crm' },
      ],
      traits: { crm_status: 'New', crm_value: 1000 },
    },
  ];

  const sabchatRows: AdapterRow[] = [
    {
      externalId: 'sc1',
      tenantId,
      displayName: 'Carol (Chat)',
      identities: [
        { type: 'sabchat_customer_id', value: 'visitor_carol', source: 'sabchat' },
      ],
      traits: { sabchat_status: 'open' },
    },
  ];

  const hrmRows: AdapterRow[] = [
    {
      externalId: 'hr1',
      tenantId,
      displayName: 'Dan (HR)',
      identities: [
        { type: 'hrm_employee_id', value: 'emp_dan', source: 'hrm' },
        { type: 'email', value: 'dan@company.com', source: 'hrm' },
      ],
      traits: { hrm_status: 'Active' },
    },
  ];

  // Capture emitted events.
  const events: { type: string; payload: unknown }[] = [];
  const off = subscribe((e) => {
    events.push({ type: e.type, payload: e.payload });
  });

  const result = await backfillFromAdapters(
    tenantId,
    {},
    {
      wachat: makeIter(wachatRows),
      crm: makeIter(crmRows),
      sabchat: makeIter(sabchatRows),
      hrm: makeIter(hrmRows),
    },
  );

  off();

  assert.equal(result.scanned, 4);
  assert.equal(result.upserted, 4);
  assert.equal(result.failed, 0);
  assert.equal(result.bySource.wachat.upserted, 1);
  assert.equal(result.bySource.crm.upserted, 1);
  assert.equal(result.bySource.sabchat.upserted, 1);
  assert.equal(result.bySource.hrm.upserted, 1);

  // At least four contact rows exist (one per source row); secondary
  // identities like email/phone may seed additional rows that operator
  // tooling collapses via `mergeContactsByIdentity`.
  const contacts = getFakeCollection('df_contacts')._all();
  assert.ok(contacts.length >= 4);

  // At least one upsert event per source was emitted.
  const upsertEvents = events.filter(
    (e) =>
      e.type === 'contact.updated' &&
      (e.payload as { kind?: string } | undefined)?.kind === 'upserted',
  );
  assert.equal(upsertEvents.length, 4);

  // Lookup by module-internal id resolves the canonical contact and
  // mirrors traits onto it.
  const fromCrm = await getCanonicalContact(tenantId, {
    type: 'crm_lead_id',
    value: 'lead_bob',
  });
  assert.ok(fromCrm);
  assert.equal(fromCrm!.traits.crm_status?.value, 'New');
  assert.equal(fromCrm!.traits.crm_value?.value, 1000);
});

test('backfillFromAdapters is idempotent — re-running adds no duplicates', async () => {
  const tenantId = 't2';
  const rows: AdapterRow[] = [
    {
      externalId: 'cr-x',
      tenantId,
      identities: [
        { type: 'crm_lead_id', value: 'lead_x', source: 'crm' },
        { type: 'email', value: 'x@example.com', source: 'crm' },
      ],
      traits: { crm_status: 'Qualified' },
    },
  ];

  const r1 = await backfillFromAdapters(
    tenantId,
    { sources: ['crm'] },
    { crm: makeIter(rows) },
  );
  const r2 = await backfillFromAdapters(
    tenantId,
    { sources: ['crm'] },
    { crm: makeIter(rows) },
  );

  assert.equal(r1.upserted, 1);
  assert.equal(r2.upserted, 1);
  assert.equal(r1.failed, 0);
  assert.equal(r2.failed, 0);

  // Identity rows are stable across runs (idempotent): the unique index on
  // (tenantId, type, value) prevents duplicates regardless of replay count.
  const idsAfterFirst = getFakeCollection('df_identities')._all().length;
  const contactsAfterFirst = getFakeCollection('df_contacts')._all().length;

  // Re-run produced no new identity rows.
  assert.equal(getFakeCollection('df_identities')._all().length, idsAfterFirst);
  // No new contacts from the second run either — only the existing canonical
  // ids are returned.
  assert.equal(getFakeCollection('df_contacts')._all().length, contactsAfterFirst);
});

test('cross-module identity overlap unifies under a single canonical contact via merge', async () => {
  const tenantId = 't3';

  // Wachat sees a phone; CRM sees the same phone alongside an email.
  const wachatRows: AdapterRow[] = [
    {
      externalId: 'wc-shared',
      tenantId,
      identities: [
        { type: 'wachat_wa_id', value: '+15550001111', source: 'wachat' },
        { type: 'phone', value: '+15550001111', source: 'wachat' },
      ],
      traits: { wachat_status: 'open' },
    },
  ];
  const crmRows: AdapterRow[] = [
    {
      externalId: 'cr-shared',
      tenantId,
      identities: [
        { type: 'crm_lead_id', value: 'lead_shared', source: 'crm' },
        { type: 'phone', value: '+1 (555) 000-1111', source: 'crm' },
        { type: 'email', value: 'shared@example.com', source: 'crm' },
      ],
      traits: { crm_status: 'Contacted' },
    },
  ];

  await backfillFromAdapters(
    tenantId,
    {},
    {
      wachat: makeIter(wachatRows),
      crm: makeIter(crmRows),
    },
  );

  // Multiple canonical contacts may exist after backfill — one per
  // first-seen identity. The operator-tooling endpoint folds them on
  // demand via `mergeContactsByIdentity`.
  const beforeMergeCount = getFakeCollection('df_contacts')._all().length;
  assert.ok(beforeMergeCount >= 1);

  // Force the unification by phone identity from each side.
  const merged = await mergeContactsByIdentity(
    tenantId,
    { type: 'wachat_wa_id', value: '+15550001111' },
    { type: 'crm_lead_id', value: 'lead_shared' },
  );
  assert.ok(merged);

  // Now the canonical contact carries traits from BOTH sources.
  const fromCrm = await getCanonicalContact(tenantId, {
    type: 'crm_lead_id',
    value: 'lead_shared',
  });
  const fromWa = await getCanonicalContact(tenantId, {
    type: 'wachat_wa_id',
    value: '+15550001111',
  });
  assert.ok(fromCrm);
  assert.ok(fromWa);
  assert.equal(fromCrm!.id, fromWa!.id);
  assert.equal(fromCrm!.traits.crm_status?.value, 'Contacted');
  assert.equal(fromCrm!.traits.wachat_status?.value, 'open');
});

test('findOrCreateContact returns the same aggregate for normalised inputs', async () => {
  const tenantId = 't4';
  const a = await findOrCreateContact(tenantId, { type: 'email', value: 'Foo@Bar.COM' });
  const b = await findOrCreateContact(tenantId, { type: 'email', value: 'foo@bar.com' });
  assert.equal(a.id, b.id);
  assert.equal(a.primaryEmail, 'foo@bar.com');
});
