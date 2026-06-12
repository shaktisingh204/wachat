/**
 * Unit tests for the SabSMS credit rate card (`../credits/rates.ts`).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/rates.test.ts
 *
 * Pure logic — the ledger itself is DB-backed (no Mongo-mock pattern in
 * this repo's tsx --test suites), so only the rate math is unit-tested;
 * the ledger is exercised end-to-end by scripts/sabsms-e2e.mjs.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { creditCostFor, SABSMS_RATE_TABLE } from '../credits/rates';

test('IN domestic SMS: 1 credit per segment', () => {
  assert.equal(creditCostFor({ segments: 1, destinationCountry: 'IN', channel: 'sms' }), 1);
  assert.equal(creditCostFor({ segments: 3, destinationCountry: 'IN', channel: 'sms' }), 3);
});

test('US and CA SMS: 1 credit per segment', () => {
  assert.equal(creditCostFor({ segments: 2, destinationCountry: 'US', channel: 'sms' }), 2);
  assert.equal(creditCostFor({ segments: 2, destinationCountry: 'CA', channel: 'sms' }), 2);
});

test('rest of world SMS: 2 credits per segment (default)', () => {
  assert.equal(creditCostFor({ segments: 1, destinationCountry: 'GB', channel: 'sms' }), 2);
  assert.equal(creditCostFor({ segments: 4, destinationCountry: 'AU', channel: 'sms' }), 8);
  assert.equal(creditCostFor({ segments: 1, destinationCountry: '', channel: 'sms' }), 2);
});

test('country lookup is case-insensitive and trimmed', () => {
  assert.equal(creditCostFor({ segments: 1, destinationCountry: 'in', channel: 'sms' }), 1);
  assert.equal(creditCostFor({ segments: 1, destinationCountry: ' us ', channel: 'sms' }), 1);
});

test('MMS: 3x the SMS cost', () => {
  assert.equal(creditCostFor({ segments: 1, destinationCountry: 'IN', channel: 'mms' }), 3);
  assert.equal(creditCostFor({ segments: 2, destinationCountry: 'GB', channel: 'mms' }), 12);
});

test('RCS: flat 1 credit per message, segments ignored', () => {
  assert.equal(creditCostFor({ segments: 5, destinationCountry: 'IN', channel: 'rcs' }), 1);
  assert.equal(creditCostFor({ segments: 1, destinationCountry: 'GB', channel: 'rcs' }), 1);
});

test('segments are clamped to a minimum of 1 and floored to integers', () => {
  assert.equal(creditCostFor({ segments: 0, destinationCountry: 'IN', channel: 'sms' }), 1);
  assert.equal(creditCostFor({ segments: -3, destinationCountry: 'IN', channel: 'sms' }), 1);
  assert.equal(creditCostFor({ segments: 2.9, destinationCountry: 'IN', channel: 'sms' }), 2);
  assert.equal(
    creditCostFor({ segments: Number.NaN, destinationCountry: 'IN', channel: 'sms' }),
    1,
  );
});

test('always returns a positive integer', () => {
  for (const channel of ['sms', 'mms', 'rcs'] as const) {
    for (const country of ['IN', 'US', 'GB', 'XX', '']) {
      for (const segments of [0, 1, 2, 7]) {
        const cost = creditCostFor({ segments, destinationCountry: country, channel });
        assert.ok(Number.isInteger(cost) && cost >= 1, `${channel}/${country}/${segments} → ${cost}`);
      }
    }
  }
});

test('rate table is exported as swappable data', () => {
  assert.equal(SABSMS_RATE_TABLE.perSegmentByCountry.IN, 1);
  assert.equal(SABSMS_RATE_TABLE.defaultPerSegment, 2);
  // a custom table overrides the default card
  const cost = creditCostFor({
    segments: 1,
    destinationCountry: 'IN',
    channel: 'sms',
    table: { perSegmentByCountry: { IN: 5 }, defaultPerSegment: 9, mmsMultiplier: 2, rcsFlatPerMessage: 1 },
  });
  assert.equal(cost, 5);
});
