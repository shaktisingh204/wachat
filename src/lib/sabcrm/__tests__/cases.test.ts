/**
 * Unit tests for the PURE service-case SLA + CSAT math (`../cases.ts`).
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/cases.test.ts`
 *
 * No I/O, no Mongo — every helper is deterministic given a passed-in `now`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  slaTarget,
  firstResponseDue,
  resolutionDue,
  computeSla,
  slaStatus,
  worseStatus,
  toMs,
  normalizePriority,
  normalizeStatus,
  isClosedStatus,
  clampCsat,
  asCsatScore,
  aggregateCsat,
  DEFAULT_SLA_POLICY,
  DEFAULT_WARNING_RATIO,
  type SlaPolicy,
  type CaseLike,
} from '../cases';

const MIN = 60_000;
const HOUR = 60 * MIN;

/* -------------------------------------------------------------------------- */
/* Coercion                                                                    */
/* -------------------------------------------------------------------------- */

test('toMs handles ISO strings, epoch numbers, digit strings, Date, and junk', () => {
  const iso = '2026-06-13T10:00:00.000Z';
  assert.equal(toMs(iso), Date.parse(iso));
  assert.equal(toMs(1_700_000_000_000), 1_700_000_000_000);
  assert.equal(toMs('1700000000000'), 1_700_000_000_000);
  assert.equal(toMs(new Date(iso)), Date.parse(iso));
  assert.equal(toMs(null), null);
  assert.equal(toMs(undefined), null);
  assert.equal(toMs(''), null);
  assert.equal(toMs('not-a-date'), null);
  assert.equal(toMs(NaN), null);
});

test('normalizePriority / normalizeStatus default sensibly and uppercase', () => {
  assert.equal(normalizePriority('urgent'), 'URGENT');
  assert.equal(normalizePriority('HIGH'), 'HIGH');
  assert.equal(normalizePriority('nonsense'), 'MEDIUM');
  assert.equal(normalizePriority(undefined), 'MEDIUM');
  assert.equal(normalizeStatus('open'), 'OPEN');
  assert.equal(normalizeStatus('weird'), 'NEW');
});

test('isClosedStatus only true for RESOLVED / CLOSED', () => {
  assert.equal(isClosedStatus('RESOLVED'), true);
  assert.equal(isClosedStatus('closed'), true);
  assert.equal(isClosedStatus('OPEN'), false);
  assert.equal(isClosedStatus('PENDING'), false);
  assert.equal(isClosedStatus(undefined), false);
});

/* -------------------------------------------------------------------------- */
/* slaTarget / due timestamps                                                  */
/* -------------------------------------------------------------------------- */

test('slaTarget falls back to defaults for partial / missing policy', () => {
  assert.deepEqual(slaTarget('URGENT'), DEFAULT_SLA_POLICY.URGENT);
  // Partial policy missing HIGH → default HIGH used.
  const partial: Partial<SlaPolicy> = {
    LOW: { firstResponseMins: 10, resolutionMins: 100 },
  };
  assert.deepEqual(slaTarget('HIGH', partial), DEFAULT_SLA_POLICY.HIGH);
  assert.deepEqual(slaTarget('LOW', partial), {
    firstResponseMins: 10,
    resolutionMins: 100,
  });
  // Non-positive / non-numeric entries are rejected per-field.
  assert.deepEqual(
    slaTarget('MEDIUM', {
      MEDIUM: { firstResponseMins: 0, resolutionMins: -5 },
    } as Partial<SlaPolicy>),
    DEFAULT_SLA_POLICY.MEDIUM,
  );
});

test('firstResponseDue / resolutionDue add the budget to createdAt', () => {
  const open = Date.parse('2026-06-13T00:00:00.000Z');
  const c: CaseLike = { priority: 'HIGH', createdAt: open };
  // HIGH default = 60m first response, 24h resolution.
  assert.equal(firstResponseDue(c), open + 60 * MIN);
  assert.equal(resolutionDue(c), open + 24 * HOUR);
  // No createdAt → null due times.
  assert.equal(firstResponseDue({ priority: 'HIGH' }), null);
  assert.equal(resolutionDue({ priority: 'HIGH' }), null);
});

/* -------------------------------------------------------------------------- */
/* computeSla / slaStatus                                                      */
/* -------------------------------------------------------------------------- */

test('fresh open case within both windows is ok', () => {
  const open = Date.parse('2026-06-13T00:00:00.000Z');
  const c: CaseLike = { priority: 'HIGH', status: 'OPEN', createdAt: open };
  // 10 minutes in: well under the 60m first-response (warning at 48m) window.
  const r = computeSla(c, open + 10 * MIN);
  assert.equal(r.status, 'ok');
  assert.equal(r.closed, false);
  assert.equal(r.firstResponseMet, false);
});

test('open case past the warning ratio but before due is warning', () => {
  const open = Date.parse('2026-06-13T00:00:00.000Z');
  const c: CaseLike = { priority: 'HIGH', status: 'OPEN', createdAt: open };
  // 50 minutes in: warning threshold for first-response is 0.8 * 60m = 48m.
  const r = computeSla(c, open + 50 * MIN);
  assert.equal(r.status, 'warning');
});

test('open case past the first-response due is breached', () => {
  const open = Date.parse('2026-06-13T00:00:00.000Z');
  const c: CaseLike = { priority: 'HIGH', status: 'OPEN', createdAt: open };
  // 70 minutes in: blew the 60m first-response budget.
  const r = computeSla(c, open + 70 * MIN);
  assert.equal(r.status, 'breached');
  assert.equal(slaStatus(c, open + 70 * MIN), 'breached');
});

test('a stamped first response inside the window keeps it ok even later', () => {
  const open = Date.parse('2026-06-13T00:00:00.000Z');
  const c: CaseLike = {
    priority: 'HIGH',
    status: 'OPEN',
    createdAt: open,
    firstResponseAt: open + 30 * MIN, // responded at 30m, inside the 60m budget
  };
  // Two hours later the first-response clock is satisfied; resolution still open
  // but within its 24h window → ok.
  const r = computeSla(c, open + 2 * HOUR);
  assert.equal(r.firstResponseMet, true);
  assert.equal(r.status, 'ok');
});

test('a LATE first response marks breached even after closing the clock', () => {
  const open = Date.parse('2026-06-13T00:00:00.000Z');
  const c: CaseLike = {
    priority: 'HIGH',
    status: 'OPEN',
    createdAt: open,
    firstResponseAt: open + 90 * MIN, // responded at 90m, past the 60m budget
  };
  const r = computeSla(c, open + 2 * HOUR);
  assert.equal(r.firstResponseMet, true);
  assert.equal(r.status, 'breached');
});

test('resolved case within both budgets is ok (clocks frozen)', () => {
  const open = Date.parse('2026-06-13T00:00:00.000Z');
  const c: CaseLike = {
    priority: 'HIGH',
    status: 'RESOLVED',
    createdAt: open,
    firstResponseAt: open + 10 * MIN,
    resolvedAt: open + 5 * HOUR, // resolved inside the 24h budget
  };
  // Even queried days later, a closed-on-time case stays ok.
  const r = computeSla(c, open + 30 * 24 * HOUR);
  assert.equal(r.closed, true);
  assert.equal(r.resolutionMet, true);
  assert.equal(r.status, 'ok');
});

test('resolved case that blew the resolution budget is breached', () => {
  const open = Date.parse('2026-06-13T00:00:00.000Z');
  const c: CaseLike = {
    priority: 'URGENT', // 4h resolution budget
    status: 'CLOSED',
    createdAt: open,
    firstResponseAt: open + 5 * MIN,
    resolvedAt: open + 10 * HOUR, // way past the 4h budget
  };
  const r = computeSla(c, open + 11 * HOUR);
  assert.equal(r.status, 'breached');
});

test('closed case lacking a resolvedAt does not breach purely from a missing stamp', () => {
  const open = Date.parse('2026-06-13T00:00:00.000Z');
  const c: CaseLike = {
    priority: 'LOW',
    status: 'CLOSED',
    createdAt: open,
    // no firstResponseAt, no resolvedAt — agent forgot to stamp
  };
  // Queried just after open: closed → both clocks treated as met at `now`.
  const r = computeSla(c, open + 5 * MIN);
  assert.equal(r.closed, true);
  assert.equal(r.status, 'ok');
});

test('no createdAt → ok (nothing to measure)', () => {
  const r = computeSla({ priority: 'HIGH', status: 'OPEN' }, Date.now());
  assert.equal(r.status, 'ok');
  assert.equal(r.firstResponseDue, null);
  assert.equal(r.resolutionDue, null);
});

test('worseStatus picks the more severe', () => {
  assert.equal(worseStatus('ok', 'warning'), 'warning');
  assert.equal(worseStatus('warning', 'breached'), 'breached');
  assert.equal(worseStatus('breached', 'ok'), 'breached');
  assert.equal(worseStatus('ok', 'ok'), 'ok');
});

test('DEFAULT_WARNING_RATIO is the documented 0.8', () => {
  assert.equal(DEFAULT_WARNING_RATIO, 0.8);
});

/* -------------------------------------------------------------------------- */
/* CSAT                                                                        */
/* -------------------------------------------------------------------------- */

test('clampCsat rounds and bounds to 0..5', () => {
  assert.equal(clampCsat(3), 3);
  assert.equal(clampCsat('4'), 4);
  assert.equal(clampCsat(4.6), 5);
  assert.equal(clampCsat(0), 0);
  assert.equal(clampCsat(9), 5);
  assert.equal(clampCsat(-2), 0);
  assert.equal(clampCsat('abc'), 0);
  assert.equal(clampCsat(null), 0);
});

test('asCsatScore rejects out-of-range / non-numeric values (no silent clamp)', () => {
  assert.equal(asCsatScore(3), 3);
  assert.equal(asCsatScore('5'), 5);
  assert.equal(asCsatScore(4.4), 4);
  assert.equal(asCsatScore(0), null);
  assert.equal(asCsatScore(7), null);
  assert.equal(asCsatScore(-1), null);
  assert.equal(asCsatScore('abc'), null);
  assert.equal(asCsatScore(null), null);
});

test('aggregateCsat rolls scores into count / average / satisfaction / histogram', () => {
  const agg = aggregateCsat([5, 4, 4, 2, 1, 'garbage', 0, 7]);
  // valid 1..5 scores: 5,4,4,2,1  (0/garbage/7 dropped, NOT clamped to 5)
  assert.equal(agg.count, 5);
  assert.equal(agg.average, 3.2); // (5+4+4+2+1)/5 = 3.2
  // satisfied (>=4): 5,4,4 = 3 of 5 = 60%
  assert.equal(agg.satisfactionRate, 60);
  assert.deepEqual(agg.distribution, { 1: 1, 2: 1, 3: 0, 4: 2, 5: 1 });
});

test('aggregateCsat is empty-safe', () => {
  const agg = aggregateCsat([]);
  assert.equal(agg.count, 0);
  assert.equal(agg.average, 0);
  assert.equal(agg.satisfactionRate, 0);
  assert.deepEqual(agg.distribution, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
});
