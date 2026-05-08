import assert from 'node:assert/strict';
import test from 'node:test';

import { hasNegativeNumber, isDateBefore } from '../form-validation';

test('hasNegativeNumber returns the first negative numeric field', () => {
  assert.equal(
    hasNegativeNumber({ amount: '10', salary: '-1' }, ['amount', 'salary']),
    'salary',
  );
});

test('hasNegativeNumber ignores empty and positive values', () => {
  assert.equal(hasNegativeNumber({ amount: '', salary: '0' }, ['amount', 'salary']), null);
});

test('isDateBefore detects end dates before start dates', () => {
  assert.equal(
    isDateBefore({ startDate: '2026-05-08', endDate: '2026-05-07' }, 'startDate', 'endDate'),
    true,
  );
});
