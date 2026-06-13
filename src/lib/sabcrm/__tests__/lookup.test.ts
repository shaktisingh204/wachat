/**
 * Unit tests for the PURE lookup-field resolver (`../lookup`).
 *
 * I/O-free — exercises value mirroring, parent-id normalisation, and the
 * config-resolvability guard. Run: `npx tsx --test src/lib/sabcrm/__tests__/lookup.test.ts`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveLookup,
  lookupParentId,
  isResolvableLookup,
  type LookupFieldConfig,
} from '../lookup';

/* -------------------------------------------------------------------------- */
/* resolveLookup                                                               */
/* -------------------------------------------------------------------------- */

test('resolveLookup mirrors a scalar verbatim (no coercion)', () => {
  const r = resolveLookup({ industry: 'SaaS' }, 'industry');
  assert.equal(r.ok, true);
  assert.equal(r.value, 'SaaS');
});

test('resolveLookup mirrors numbers / booleans / objects verbatim', () => {
  assert.deepEqual(resolveLookup({ employees: 42 }, 'employees').value, 42);
  assert.deepEqual(resolveLookup({ vip: true }, 'vip').value, true);
  const composite = { amount: 1000, currencyCode: 'USD' };
  assert.deepEqual(resolveLookup({ revenue: composite }, 'revenue').value, composite);
});

test('resolveLookup returns null (not undefined) for a missing source key', () => {
  const r = resolveLookup({ name: 'Acme' }, 'industry');
  assert.equal(r.ok, true);
  assert.equal(r.value, null);
});

test('resolveLookup tolerates null/undefined parent data', () => {
  assert.deepEqual(resolveLookup(null, 'industry'), { ok: true, value: null });
  assert.deepEqual(resolveLookup(undefined, 'industry'), { ok: true, value: null });
});

test('resolveLookup fails on an empty source key', () => {
  const r = resolveLookup({ industry: 'SaaS' }, '');
  assert.equal(r.ok, false);
  assert.ok(r.error);
});

test('resolveLookup preserves a falsy-but-present value (0 / empty string / false)', () => {
  assert.equal(resolveLookup({ count: 0 }, 'count').value, 0);
  assert.equal(resolveLookup({ note: '' }, 'note').value, '');
  assert.equal(resolveLookup({ flag: false }, 'flag').value, false);
});

/* -------------------------------------------------------------------------- */
/* lookupParentId                                                              */
/* -------------------------------------------------------------------------- */

test('lookupParentId reads a bare id string', () => {
  assert.equal(lookupParentId({ company: 'abc123' }, 'company'), 'abc123');
});

test('lookupParentId trims and rejects empty / whitespace ids', () => {
  assert.equal(lookupParentId({ company: '  abc123  ' }, 'company'), 'abc123');
  assert.equal(lookupParentId({ company: '   ' }, 'company'), null);
  assert.equal(lookupParentId({ company: '' }, 'company'), null);
});

test('lookupParentId unwraps an enriched { id } hint', () => {
  assert.equal(
    lookupParentId({ company: { id: 'xyz789', label: 'Acme' } }, 'company'),
    'xyz789',
  );
});

test('lookupParentId unwraps a single-element relation array', () => {
  assert.equal(lookupParentId({ company: ['arr111'] }, 'company'), 'arr111');
  assert.equal(lookupParentId({ company: [{ id: 'arr222' }] }, 'company'), 'arr222');
});

test('lookupParentId returns null for absent / null relation', () => {
  assert.equal(lookupParentId({}, 'company'), null);
  assert.equal(lookupParentId({ company: null }, 'company'), null);
  assert.equal(lookupParentId(null, 'company'), null);
  assert.equal(lookupParentId(undefined, 'company'), null);
});

/* -------------------------------------------------------------------------- */
/* isResolvableLookup                                                          */
/* -------------------------------------------------------------------------- */

test('isResolvableLookup accepts a fully-specified config', () => {
  const cfg: LookupFieldConfig = {
    key: 'companyIndustry',
    relationField: 'company',
    parentObject: 'companies',
    sourceKey: 'industry',
    targetKey: 'companyIndustry',
  };
  assert.equal(isResolvableLookup(cfg), true);
});

test('isResolvableLookup rejects configs missing any required field', () => {
  assert.equal(isResolvableLookup(null), false);
  assert.equal(isResolvableLookup(undefined), false);
  assert.equal(
    isResolvableLookup({ relationField: 'company', parentObject: 'companies', sourceKey: 'industry' }),
    false,
  );
  assert.equal(
    isResolvableLookup({ relationField: '', parentObject: 'companies', sourceKey: 'industry', targetKey: 't' }),
    false,
  );
});
