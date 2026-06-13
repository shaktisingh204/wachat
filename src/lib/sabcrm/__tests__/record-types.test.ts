/**
 * Unit tests for the PURE record-types model (`../record-types`).
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/record-types.test.ts`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pickAllowedValues,
  isPicklistRestricted,
  isValueAllowed,
  applyDefaults,
  RECORD_TYPE_FIELD_KEY,
  type RecordType,
} from '../record-types';

const ALL_STAGES = ['new', 'qualified', 'proposal', 'won', 'lost'];

const enterprise: RecordType = {
  id: 'a',
  object: 'opportunities',
  name: 'Enterprise',
  active: true,
  layoutId: 'layout-1',
  restrictedPicklists: { stage: ['qualified', 'proposal', 'won', 'lost'] },
  defaultValues: { stage: 'qualified', amount: 50000 },
};

test('RECORD_TYPE_FIELD_KEY is the stable scalar key', () => {
  assert.equal(RECORD_TYPE_FIELD_KEY, 'recordTypeId');
});

/* -------------------------------------------------------------------------- */
/* pickAllowedValues                                                           */
/* -------------------------------------------------------------------------- */

test('pickAllowedValues: restricted field is intersected with full options', () => {
  assert.deepEqual(pickAllowedValues(enterprise, 'stage', ALL_STAGES), [
    'qualified',
    'proposal',
    'won',
    'lost',
  ]);
});

test('pickAllowedValues: preserves canonical option order, drops "new"', () => {
  // restriction listed in a different order — output follows allValues order.
  const rt: RecordType = {
    ...enterprise,
    restrictedPicklists: { stage: ['won', 'new'] },
  };
  assert.deepEqual(pickAllowedValues(rt, 'stage', ALL_STAGES), ['new', 'won']);
});

test('pickAllowedValues: a stale restriction can never widen the field', () => {
  const rt: RecordType = {
    ...enterprise,
    restrictedPicklists: { stage: ['won', 'archived-removed'] },
  };
  // "archived-removed" is no longer an option → excluded.
  assert.deepEqual(pickAllowedValues(rt, 'stage', ALL_STAGES), ['won']);
});

test('pickAllowedValues: unrestricted field returns all values (a copy)', () => {
  const out = pickAllowedValues(enterprise, 'priority', ALL_STAGES);
  assert.deepEqual(out, ALL_STAGES);
  assert.notEqual(out, ALL_STAGES); // fresh array, not the same reference
});

test('pickAllowedValues: null record type → all values', () => {
  assert.deepEqual(pickAllowedValues(null, 'stage', ALL_STAGES), ALL_STAGES);
  assert.deepEqual(pickAllowedValues(undefined, 'stage', ALL_STAGES), ALL_STAGES);
});

test('pickAllowedValues: empty restriction array hides every value', () => {
  const rt: RecordType = { ...enterprise, restrictedPicklists: { stage: [] } };
  assert.deepEqual(pickAllowedValues(rt, 'stage', ALL_STAGES), []);
});

test('pickAllowedValues: non-array allValues is tolerated', () => {
  assert.deepEqual(
    pickAllowedValues(enterprise, 'stage', undefined as unknown as string[]),
    [],
  );
});

/* -------------------------------------------------------------------------- */
/* isPicklistRestricted / isValueAllowed                                       */
/* -------------------------------------------------------------------------- */

test('isPicklistRestricted reflects presence of a restriction', () => {
  assert.equal(isPicklistRestricted(enterprise, 'stage'), true);
  assert.equal(isPicklistRestricted(enterprise, 'priority'), false);
  assert.equal(isPicklistRestricted(null, 'stage'), false);
});

test('isValueAllowed: restricted field gates by membership', () => {
  assert.equal(isValueAllowed(enterprise, 'stage', 'won'), true);
  assert.equal(isValueAllowed(enterprise, 'stage', 'new'), false);
});

test('isValueAllowed: unconstrained field accepts anything', () => {
  assert.equal(isValueAllowed(enterprise, 'priority', 'anything'), true);
  assert.equal(isValueAllowed(null, 'stage', 'whatever'), true);
});

/* -------------------------------------------------------------------------- */
/* applyDefaults                                                               */
/* -------------------------------------------------------------------------- */

test('applyDefaults: seeds only absent keys, never mutates input', () => {
  const data = { name: 'Acme' };
  const out = applyDefaults(enterprise, data);
  assert.deepEqual(out, { name: 'Acme', stage: 'qualified', amount: 50000 });
  assert.deepEqual(data, { name: 'Acme' }); // input untouched
  assert.notEqual(out, data);
});

test('applyDefaults: explicit caller values always win (incl. falsy)', () => {
  const rt: RecordType = {
    ...enterprise,
    defaultValues: { stage: 'qualified', amount: 50000, active: true },
  };
  const out = applyDefaults(rt, { stage: '', amount: 0, active: false });
  assert.deepEqual(out, { stage: '', amount: 0, active: false });
});

test('applyDefaults: undefined explicit value IS treated as absent', () => {
  const out = applyDefaults(enterprise, { stage: undefined });
  assert.equal(out.stage, 'qualified');
  assert.equal(out.amount, 50000);
});

test('applyDefaults: no defaults → shallow copy of data', () => {
  const data = { name: 'Acme' };
  const out = applyDefaults({ defaultValues: undefined }, data);
  assert.deepEqual(out, data);
  assert.notEqual(out, data);
});

test('applyDefaults: null record type → shallow copy', () => {
  const data = { name: 'Acme' };
  const out = applyDefaults(null, data);
  assert.deepEqual(out, data);
  assert.notEqual(out, data);
});

test('applyDefaults: null/undefined data is tolerated', () => {
  assert.deepEqual(
    applyDefaults(enterprise, undefined as unknown as Record<string, unknown>),
    { stage: 'qualified', amount: 50000 },
  );
});
