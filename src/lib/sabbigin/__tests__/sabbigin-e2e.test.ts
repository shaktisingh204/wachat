/**
 * SabBigin core-logic e2e — exercises the real shipped decision logic used by
 * the deal board, stage governance, connected pipelines, and booking pages.
 *
 *   npx tsx --test src/lib/sabbigin/__tests__/sabbigin-e2e.test.ts
 *
 * Pure logic only (no DB/session), so it runs anywhere and is deterministic.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateBookingDays,
  missingRequiredFields,
  matchingConnections,
  eventForStage,
  isWonStageName,
  isLostStageName,
  type BookingPageLite,
} from '../booking-logic';
import {
  formatCurrency,
  isWonStage,
  isLostStage,
  stageTone,
} from '../../../components/sabbigin/lib/format';

/* ── Booking slot generation ─────────────────────────────────────── */

const WEEKDAY_PAGE: BookingPageLite = {
  durationMin: 30,
  bufferMin: 0,
  dateRangeDays: 14,
  weeklyAvailability: [1, 2, 3, 4, 5].map((dow) => ({
    dow,
    start: '09:00',
    end: '17:00',
  })),
};

test('booking: generates slots only on configured weekdays', () => {
  // A Monday 00:00 UTC reference so "now" doesn't eat the early slots.
  const now = new Date('2026-06-15T00:00:00.000Z'); // Monday
  const days = generateBookingDays(WEEKDAY_PAGE, now, new Set());
  assert.ok(days.length > 0, 'should produce at least one bookable day');
  // No weekend days (Sat=6, Sun=0) should appear.
  for (const d of days) {
    const dow = new Date(d.dateISO).getDay();
    assert.ok(dow >= 1 && dow <= 5, `day ${d.label} should be a weekday`);
  }
});

test('booking: a 9-5 day with 30-min slots yields 16 slots', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');
  const days = generateBookingDays(WEEKDAY_PAGE, now, new Set());
  // The first generated day after `now` that is fully in the future.
  const firstFull = days.find((d) => d.slots.length === 16);
  assert.ok(firstFull, '9:00-17:00 at 30min should give 16 slots on a clear day');
});

test('booking: already-taken instants are excluded (no double-booking)', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');
  const all = generateBookingDays(WEEKDAY_PAGE, now, new Set());
  const target = all.find((d) => d.slots.length > 0)!;
  const takenISO = target.slots[0].startISO;
  const after = generateBookingDays(WEEKDAY_PAGE, now, new Set([takenISO]));
  const sameDay = after.find((d) => d.dateISO === target.dateISO)!;
  assert.ok(
    !sameDay.slots.some((s) => s.startISO === takenISO),
    'the taken slot must not be offered again',
  );
});

test('booking: buffer reduces slot count', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');
  const buffered: BookingPageLite = { ...WEEKDAY_PAGE, bufferMin: 30 };
  const plain = generateBookingDays(WEEKDAY_PAGE, now, new Set());
  const withBuf = generateBookingDays(buffered, now, new Set());
  const plainMax = Math.max(...plain.map((d) => d.slots.length));
  const bufMax = Math.max(...withBuf.map((d) => d.slots.length));
  assert.ok(bufMax < plainMax, 'a buffer should reduce slots per day');
});

/* ── Stage-gate (required fields) ────────────────────────────────── */

test('stage gate: flags all blank required fields', () => {
  const deal = { value: 0, closeDate: null, name: 'Acme' };
  const missing = missingRequiredFields(deal, ['value', 'closeDate']);
  assert.deepEqual(missing.sort(), ['closeDate', 'value']);
});

test('stage gate: a supplied patch satisfies a required field', () => {
  const deal = { value: 0, closeDate: null };
  const missing = missingRequiredFields(deal, ['value', 'closeDate'], {
    value: 50000,
  });
  assert.deepEqual(missing, ['closeDate']);
});

test('stage gate: nothing missing when all present', () => {
  const deal = { value: 1000, closeDate: '2026-07-01' };
  assert.deepEqual(missingRequiredFields(deal, ['value', 'closeDate']), []);
});

test('stage gate: no required fields → never blocks', () => {
  assert.deepEqual(missingRequiredFields({}, undefined), []);
  assert.deepEqual(missingRequiredFields({}, []), []);
});

/* ── Connected pipelines (event routing) ─────────────────────────── */

test('connections: a won-connection fires only on a won stage', () => {
  const conns = [
    { fromStage: '', event: 'won' as const, targetPipelineId: 'p2' },
    { fromStage: '', event: 'lost' as const, targetPipelineId: 'p3' },
  ];
  const won = matchingConnections(conns, 'Closed Won');
  assert.equal(won.length, 1);
  assert.equal(won[0].targetPipelineId, 'p2');

  const lost = matchingConnections(conns, 'Closed Lost');
  assert.equal(lost.length, 1);
  assert.equal(lost[0].targetPipelineId, 'p3');

  const mid = matchingConnections(conns, 'Negotiation');
  assert.equal(mid.length, 0);
});

test('connections: an enter-connection respects its fromStage filter', () => {
  const conns = [
    { fromStage: 'Qualified', event: 'enter' as const, targetPipelineId: 'p9' },
  ];
  assert.equal(matchingConnections(conns, 'Qualified').length, 1);
  assert.equal(matchingConnections(conns, 'New').length, 0);
});

test('connections: inactive connections never fire', () => {
  const conns = [
    { fromStage: '', event: 'won' as const, active: false, targetPipelineId: 'x' },
  ];
  assert.equal(matchingConnections(conns, 'Closed Won').length, 0);
});

/* ── Stage classification + formatting ───────────────────────────── */

test('stage classification agrees across modules', () => {
  assert.equal(eventForStage('Closed Won'), 'won');
  assert.equal(eventForStage('Closed Lost'), 'lost');
  assert.equal(eventForStage('Proposal'), 'enter');
  // booking-logic and the client format lib must agree
  assert.equal(isWonStageName('Deal Done'), isWonStage('Deal Done'));
  assert.equal(isLostStageName('Cancelled'), isLostStage('Cancelled'));
  assert.equal(stageTone('Closed Won'), 'success');
  assert.equal(stageTone('Closed Lost'), 'danger');
});

test('currency formatting is INR-aware and finite-safe', () => {
  assert.equal(formatCurrency(Number.NaN), '—');
  assert.match(formatCurrency(50000, 'INR'), /₹|INR/);
});
