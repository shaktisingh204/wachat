/**
 * Unit tests for the global value-sets PURE model (`../value-sets`).
 *   npx tsx --test src/lib/sabcrm/__tests__/value-sets.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  activeValues,
  validateValue,
  valueSetToOptions,
  normalizeValue,
  dedupeValues,
  type GlobalValueSet,
} from '../value-sets';

const SET: GlobalValueSet = {
  id: 'vs1',
  name: 'Lead sources',
  values: [
    { value: 'web', label: 'Website', color: 'blue', active: true },
    { value: 'ref', label: 'Referral', active: true },
    { value: 'fax', label: 'Fax (legacy)', active: false },
    { value: '', label: 'Blank', active: true },
  ],
};

describe('activeValues', () => {
  it('drops deprecated + empty-value entries, keeps order', () => {
    const got = activeValues(SET);
    assert.deepEqual(
      got.map((v) => v.value),
      ['web', 'ref'],
    );
  });
  it('is null/undefined safe', () => {
    assert.deepEqual(activeValues({ values: undefined as never }), []);
    assert.deepEqual(activeValues({ values: [] }), []);
  });
  it('treats a missing active flag as active (legacy docs)', () => {
    const got = activeValues({
      values: [{ value: 'a', label: 'A' } as never],
    });
    assert.equal(got.length, 1);
  });
});

describe('validateValue', () => {
  it('accepts an active value', () => {
    assert.equal(validateValue(SET, 'web'), true);
  });
  it('rejects a deprecated value by default', () => {
    assert.equal(validateValue(SET, 'fax'), false);
  });
  it('accepts a deprecated value when allowDeprecated', () => {
    assert.equal(validateValue(SET, 'fax', { allowDeprecated: true }), true);
  });
  it('rejects unknown / empty / nullish', () => {
    assert.equal(validateValue(SET, 'nope'), false);
    assert.equal(validateValue(SET, ''), false);
    assert.equal(validateValue(SET, null), false);
    assert.equal(validateValue(SET, undefined), false);
  });
  it('coerces non-string values for comparison', () => {
    const numSet: GlobalValueSet = {
      id: 'n',
      name: 'Tiers',
      values: [{ value: '1', label: 'One', active: true }],
    };
    assert.equal(validateValue(numSet, 1), true);
  });
});

describe('valueSetToOptions', () => {
  it('projects active values into FieldOptions with color preserved', () => {
    assert.deepEqual(valueSetToOptions(SET), [
      { value: 'web', label: 'Website', color: 'blue' },
      { value: 'ref', label: 'Referral' },
    ]);
  });
  it('falls back the label to the value when blank', () => {
    const got = valueSetToOptions({
      values: [{ value: 'x', label: '', active: true }],
    });
    assert.deepEqual(got, [{ value: 'x', label: 'x' }]);
  });
});

describe('normalizeValue', () => {
  it('trims, defaults active=true, defaults label to value', () => {
    assert.deepEqual(normalizeValue({ value: '  web  ' }), {
      value: 'web',
      label: 'web',
      color: undefined,
      active: true,
    });
  });
  it('honours an explicit active=false', () => {
    assert.deepEqual(normalizeValue({ value: 'a', label: 'A', active: false }), {
      value: 'a',
      label: 'A',
      color: undefined,
      active: false,
    });
  });
  it('returns null for an empty / non-string value', () => {
    assert.equal(normalizeValue({ value: '   ' }), null);
    assert.equal(normalizeValue({ value: 5 as never }), null);
    assert.equal(normalizeValue({}), null);
  });
});

describe('dedupeValues', () => {
  it('keeps first occurrence per value and normalises', () => {
    const got = dedupeValues([
      { value: 'web', label: 'Website' },
      { value: 'web', label: 'Dup' },
      { value: 'ref', label: 'Referral', active: false },
      { value: '' },
    ]);
    assert.deepEqual(got, [
      { value: 'web', label: 'Website', color: undefined, active: true },
      { value: 'ref', label: 'Referral', color: undefined, active: false },
    ]);
  });
  it('is null-safe', () => {
    assert.deepEqual(dedupeValues(undefined as never), []);
  });
});
