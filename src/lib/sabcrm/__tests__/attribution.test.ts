/**
 * Unit tests for the PURE attribution math in `../attribution.ts`.
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/attribution.test.ts`
 *
 * Covers: chronological touch sort (incl. stable ties + bad timestamps), the
 * three credit models (first/last/linear), the synthetic `(direct)` fallback,
 * single-deal attribution invariants (revenue + deal weight conservation), and
 * the full campaign rollup (grouping, ranking, fractional deal counts).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  sortTouches,
  creditedTouches,
  attributeDeal,
  buildCampaignRollup,
  DIRECT_SOURCE,
  NONE_CAMPAIGN,
  type Touch,
  type AttributableDeal,
} from '../attribution';

const T = (source: string, at: string, campaign?: string): Touch => ({
  source,
  at,
  campaign,
});

/* ------------------------------------------------------------------ sort -- */

test('sortTouches orders chronologically without mutating input', () => {
  const input = [
    T('b', '2026-02-01T00:00:00Z'),
    T('a', '2026-01-01T00:00:00Z'),
    T('c', '2026-03-01T00:00:00Z'),
  ];
  const snapshot = JSON.stringify(input);
  const out = sortTouches(input);
  assert.deepEqual(
    out.map((t) => t.source),
    ['a', 'b', 'c'],
  );
  // Input untouched (pure).
  assert.equal(JSON.stringify(input), snapshot);
});

test('sortTouches is stable for equal/unparseable timestamps', () => {
  const out = sortTouches([
    T('first', 'not-a-date'),
    T('second', 'also-bad'),
    T('real', '2026-01-01T00:00:00Z'),
  ]);
  // Bad timestamps sort to epoch 0 (before the real one), keeping input order.
  assert.deepEqual(
    out.map((t) => t.source),
    ['first', 'second', 'real'],
  );
});

/* --------------------------------------------------------------- credit -- */

test('creditedTouches: first → earliest only, weight 1', () => {
  const touches = [
    T('mid', '2026-02-01T00:00:00Z'),
    T('early', '2026-01-01T00:00:00Z'),
    T('late', '2026-03-01T00:00:00Z'),
  ];
  const c = creditedTouches(touches, 'first');
  assert.equal(c.length, 1);
  assert.equal(c[0].touch.source, 'early');
  assert.equal(c[0].weight, 1);
});

test('creditedTouches: last → latest only, weight 1', () => {
  const touches = [
    T('early', '2026-01-01T00:00:00Z'),
    T('late', '2026-03-01T00:00:00Z'),
  ];
  const c = creditedTouches(touches, 'last');
  assert.equal(c.length, 1);
  assert.equal(c[0].touch.source, 'late');
});

test('creditedTouches: linear → equal weights summing to 1', () => {
  const touches = [
    T('a', '2026-01-01T00:00:00Z'),
    T('b', '2026-02-01T00:00:00Z'),
    T('c', '2026-03-01T00:00:00Z'),
    T('d', '2026-04-01T00:00:00Z'),
  ];
  const c = creditedTouches(touches, 'linear');
  assert.equal(c.length, 4);
  for (const x of c) assert.equal(x.weight, 0.25);
  const total = c.reduce((s, x) => s + x.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('creditedTouches: empty history → synthetic (direct), weight 1', () => {
  for (const model of ['first', 'last', 'linear'] as const) {
    const c = creditedTouches([], model);
    assert.equal(c.length, 1);
    assert.equal(c[0].touch.source, DIRECT_SOURCE);
    assert.equal(c[0].weight, 1);
  }
});

/* -------------------------------------------------------- attributeDeal -- */

test('attributeDeal: revenue + deal weight are conserved (linear)', () => {
  const deal: AttributableDeal = {
    recordId: 'r1',
    revenue: 1000,
    touches: [
      T('google', '2026-01-01T00:00:00Z', 'brand'),
      T('email', '2026-02-01T00:00:00Z', 'nurture'),
    ],
  };
  const slices = attributeDeal(deal, 'linear');
  assert.equal(slices.length, 2);
  const rev = slices.reduce((s, x) => s + x.revenue, 0);
  const deals = slices.reduce((s, x) => s + x.deals, 0);
  assert.equal(rev, 1000);
  assert.ok(Math.abs(deals - 1) < 1e-9);
  assert.equal(slices[0].revenue, 500);
});

test('attributeDeal: first-touch credits one channel fully', () => {
  const deal: AttributableDeal = {
    recordId: 'r2',
    revenue: 800,
    touches: [
      T('linkedin', '2026-01-01T00:00:00Z', 'webinar'),
      T('referral', '2026-02-01T00:00:00Z'),
    ],
  };
  const slices = attributeDeal(deal, 'first');
  assert.equal(slices.length, 1);
  assert.equal(slices[0].source, 'linkedin');
  assert.equal(slices[0].campaign, 'webinar');
  assert.equal(slices[0].revenue, 800);
  assert.equal(slices[0].deals, 1);
});

test('attributeDeal: blank campaign normalizes to (none); bad revenue → 0', () => {
  const deal: AttributableDeal = {
    recordId: 'r3',
    revenue: Number.NaN,
    touches: [T('google', '2026-01-01T00:00:00Z')],
  };
  const slices = attributeDeal(deal, 'last');
  assert.equal(slices[0].campaign, NONE_CAMPAIGN);
  assert.equal(slices[0].revenue, 0);
});

/* ---------------------------------------------------- buildCampaignRollup -- */

test('buildCampaignRollup: groups + ranks by source (last touch)', () => {
  const deals: AttributableDeal[] = [
    {
      recordId: 'd1',
      revenue: 1000,
      touches: [
        T('google', '2026-01-01T00:00:00Z'),
        T('email', '2026-02-01T00:00:00Z'),
      ],
    },
    {
      recordId: 'd2',
      revenue: 500,
      touches: [T('google', '2026-01-15T00:00:00Z')],
    },
  ];
  const rollup = buildCampaignRollup(deals, 'last');
  assert.equal(rollup.totalRevenue, 1500);
  assert.equal(rollup.totalDeals, 2);
  // d1 last touch = email (1000), d2 = google (500). Ranked by revenue desc.
  assert.equal(rollup.bySource[0].source, 'email');
  assert.equal(rollup.bySource[0].revenue, 1000);
  assert.equal(rollup.bySource[1].source, 'google');
  assert.equal(rollup.bySource[1].revenue, 500);
});

test('buildCampaignRollup: linear splits one deal across sources', () => {
  const deals: AttributableDeal[] = [
    {
      recordId: 'd1',
      revenue: 900,
      touches: [
        T('google', '2026-01-01T00:00:00Z', 'c1'),
        T('email', '2026-02-01T00:00:00Z', 'c2'),
        T('google', '2026-03-01T00:00:00Z', 'c3'),
      ],
    },
  ];
  const rollup = buildCampaignRollup(deals, 'linear');
  // google appears twice → 2/3 of revenue + 2/3 of a deal.
  const google = rollup.bySource.find((r) => r.source === 'google');
  const email = rollup.bySource.find((r) => r.source === 'email');
  assert.ok(google && email);
  assert.equal(google!.revenue, 600);
  assert.equal(email!.revenue, 300);
  assert.ok(Math.abs(google!.deals - 2 / 3) < 1e-9);
  // Per-campaign rows keep google's two campaigns separate.
  assert.equal(rollup.byCampaign.filter((r) => r.source === 'google').length, 2);
});

test('buildCampaignRollup: deal with no touches → (direct) source', () => {
  const deals: AttributableDeal[] = [
    { recordId: 'd1', revenue: 250, touches: [] },
  ];
  const rollup = buildCampaignRollup(deals, 'first');
  assert.equal(rollup.bySource.length, 1);
  assert.equal(rollup.bySource[0].source, DIRECT_SOURCE);
  assert.equal(rollup.bySource[0].revenue, 250);
  assert.equal(rollup.totalRevenue, 250);
});

test('buildCampaignRollup: empty input → zeroed rollup', () => {
  const rollup = buildCampaignRollup([], 'linear');
  assert.equal(rollup.totalRevenue, 0);
  assert.equal(rollup.totalDeals, 0);
  assert.deepEqual(rollup.bySource, []);
  assert.deepEqual(rollup.byCampaign, []);
});
