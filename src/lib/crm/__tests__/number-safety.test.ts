import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coerceFiniteMoney,
  formatFiniteCurrency,
} from '../number-safety';

test('coerceFiniteMoney rejects NaN and infinite values', () => {
  assert.equal(coerceFiniteMoney(Number.NaN), 0);
  assert.equal(coerceFiniteMoney(Number.POSITIVE_INFINITY), 0);
  assert.equal(coerceFiniteMoney('not-a-number'), 0);
});

test('coerceFiniteMoney caps values that would break financial UI', () => {
  assert.equal(coerceFiniteMoney('2e+200'), 100_000_000_000);
  assert.equal(coerceFiniteMoney('-2e+200'), -100_000_000_000);
});

test('formatFiniteCurrency never renders NaN', () => {
  assert.equal(formatFiniteCurrency(Number.NaN, 'INR'), '₹0.00');
});
