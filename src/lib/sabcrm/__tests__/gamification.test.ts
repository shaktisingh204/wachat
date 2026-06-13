/**
 * Unit tests for the PURE gamification math (`../gamification`).
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/gamification.test.ts`
 *
 * Covers points computation, tier resolution, badge awarding, deterministic
 * ranking + tie-breaks, attainment %, and streak counting. No I/O — every
 * function under test is pure and deterministic.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computePoints,
  resolveTier,
  earnedBadges,
  buildScoreboard,
  findOwnerEntry,
  computeAttainment,
  actualForMetric,
  currentStreak,
  longestStreak,
  formatDayKey,
  toFiniteNumber,
  DEFAULT_POINTS_MODEL,
  DEFAULT_TIERS,
  DEFAULT_BADGES,
  ATTAINMENT_CEILING,
  type OwnerStats,
} from '../gamification';

/* -------------------------------------------------------------------------- */
/* computePoints                                                               */
/* -------------------------------------------------------------------------- */

test('computePoints: linear combination of the three terms', () => {
  // 10000*0.01 + 2*50 + 10*5 = 100 + 100 + 50 = 250
  const pts = computePoints(
    { ownerId: 'a', wonRevenue: 10_000, wonCount: 2, activities: 10 },
    DEFAULT_POINTS_MODEL,
  );
  assert.equal(pts, 250);
});

test('computePoints: zero stats yield zero', () => {
  assert.equal(
    computePoints({ ownerId: 'a', wonRevenue: 0, wonCount: 0, activities: 0 }),
    0,
  );
});

test('computePoints: negative counters are floored to 0 (refund cannot penalise)', () => {
  const pts = computePoints({
    ownerId: 'a',
    wonRevenue: -5000,
    wonCount: -1,
    activities: -3,
  });
  assert.equal(pts, 0);
});

test('computePoints: non-finite inputs coerce to 0', () => {
  const pts = computePoints({
    ownerId: 'a',
    wonRevenue: Number.NaN,
    wonCount: Infinity as unknown as number,
    activities: 4,
  });
  assert.equal(pts, 20); // only activities*5 survives
});

test('computePoints: custom model is respected', () => {
  const pts = computePoints(
    { ownerId: 'a', wonRevenue: 1000, wonCount: 1, activities: 0 },
    { revenue: 1, perWonDeal: 0, perActivity: 0 },
  );
  assert.equal(pts, 1000);
});

/* -------------------------------------------------------------------------- */
/* resolveTier                                                                 */
/* -------------------------------------------------------------------------- */

test('resolveTier: highest tier whose min is reached', () => {
  assert.equal(resolveTier(DEFAULT_TIERS, 0)?.label, 'Bronze');
  assert.equal(resolveTier(DEFAULT_TIERS, 250)?.label, 'Silver');
  assert.equal(resolveTier(DEFAULT_TIERS, 599)?.label, 'Silver');
  assert.equal(resolveTier(DEFAULT_TIERS, 600)?.label, 'Gold');
  assert.equal(resolveTier(DEFAULT_TIERS, 99_999)?.label, 'Diamond');
});

test('resolveTier: empty tiers → null', () => {
  assert.equal(resolveTier([], 500), null);
  assert.equal(resolveTier(undefined, 500), null);
});

test('resolveTier: below the lowest min → null when no zero tier', () => {
  const tiers = [{ min: 100, label: 'A' }];
  assert.equal(resolveTier(tiers, 50), null);
});

/* -------------------------------------------------------------------------- */
/* earnedBadges                                                                */
/* -------------------------------------------------------------------------- */

test('earnedBadges: thresholds across every metric', () => {
  const stats: OwnerStats = {
    ownerId: 'a',
    wonRevenue: 60_000,
    wonCount: 6,
    activities: 60,
  };
  const points = computePoints(stats); // 600 + 300 + 300 = 1200
  const ids = earnedBadges(stats, points);
  // first-win(count>=1), closer(count>=5), rainmaker(rev>=50k),
  // grinder(act>=50), mvp(points>=1000)
  assert.deepEqual(
    ids.sort(),
    ['closer', 'first-win', 'grinder', 'mvp', 'rainmaker'].sort(),
  );
});

test('earnedBadges: nothing earned for an empty rep', () => {
  const stats: OwnerStats = { ownerId: 'a', wonRevenue: 0, wonCount: 0, activities: 0 };
  assert.deepEqual(earnedBadges(stats, 0), []);
});

test('earnedBadges: boundary is inclusive', () => {
  const stats: OwnerStats = { ownerId: 'a', wonRevenue: 0, wonCount: 1, activities: 0 };
  assert.ok(earnedBadges(stats, 50, DEFAULT_BADGES).includes('first-win'));
});

/* -------------------------------------------------------------------------- */
/* buildScoreboard                                                            */
/* -------------------------------------------------------------------------- */

test('buildScoreboard: ranks by points desc and assigns 1-based rank', () => {
  const board = buildScoreboard([
    { ownerId: 'low', wonRevenue: 1000, wonCount: 0, activities: 1 },
    { ownerId: 'high', wonRevenue: 100_000, wonCount: 5, activities: 20 },
    { ownerId: 'mid', wonRevenue: 20_000, wonCount: 1, activities: 5 },
  ]);
  assert.deepEqual(
    board.map((e) => e.ownerId),
    ['high', 'mid', 'low'],
  );
  assert.deepEqual(
    board.map((e) => e.rank),
    [1, 2, 3],
  );
});

test('buildScoreboard: deterministic tie-break chain on equal points', () => {
  // Construct two reps with identical points (200) but different wonRevenue.
  // rep X: 0 revenue, 4 deals → 200 pts; rep Y: 20000 rev, 0 deals → 200 pts.
  const board = buildScoreboard([
    { ownerId: 'X', wonRevenue: 0, wonCount: 4, activities: 0 },
    { ownerId: 'Y', wonRevenue: 20_000, wonCount: 0, activities: 0 },
  ]);
  assert.equal(board[0].points, board[1].points); // tied on points
  // Y wins the tie-break via higher wonRevenue.
  assert.equal(board[0].ownerId, 'Y');
  assert.equal(board[1].ownerId, 'X');
});

test('buildScoreboard: identical stats fall back to ownerId asc (stable)', () => {
  const a: OwnerStats = { ownerId: 'bbb', wonRevenue: 100, wonCount: 1, activities: 1 };
  const b: OwnerStats = { ownerId: 'aaa', wonRevenue: 100, wonCount: 1, activities: 1 };
  const board = buildScoreboard([a, b]);
  assert.deepEqual(board.map((e) => e.ownerId), ['aaa', 'bbb']);
});

test('buildScoreboard: merges profiles and falls back to a truncated id', () => {
  const board = buildScoreboard(
    [
      { ownerId: 'abcdef123456', wonRevenue: 100, wonCount: 0, activities: 0 },
      { ownerId: 'zzz', wonRevenue: 50, wonCount: 0, activities: 0 },
    ],
    { profiles: { abcdef123456: { name: 'Asha Rao', image: 'x.png' } } },
  );
  const asha = findOwnerEntry(board, 'abcdef123456');
  assert.equal(asha?.name, 'Asha Rao');
  assert.equal(asha?.image, 'x.png');
  const zzz = findOwnerEntry(board, 'zzz');
  assert.equal(zzz?.name, 'Member zzz'); // last-6 of "zzz" is "zzz"
});

test('buildScoreboard: tier + badges attached to rows', () => {
  const board = buildScoreboard([
    { ownerId: 'a', wonRevenue: 60_000, wonCount: 6, activities: 60 },
  ]);
  assert.equal(board[0].tier?.label, 'Platinum'); // 1200 pts → Platinum (>=1200)
  assert.ok(board[0].badges.includes('mvp'));
});

test('buildScoreboard: empty input → empty board', () => {
  assert.deepEqual(buildScoreboard([]), []);
});

/* -------------------------------------------------------------------------- */
/* computeAttainment                                                          */
/* -------------------------------------------------------------------------- */

test('computeAttainment: ratio and percent', () => {
  const at = computeAttainment(7500, 10_000);
  assert.equal(at.actual, 7500);
  assert.equal(at.target, 10_000);
  assert.equal(at.ratio, 0.75);
  assert.equal(at.percent, 75);
  assert.equal(at.attained, false);
});

test('computeAttainment: attained at exactly target', () => {
  const at = computeAttainment(10_000, 10_000);
  assert.equal(at.attained, true);
  assert.equal(at.percent, 100);
});

test('computeAttainment: percent clamps to the ceiling', () => {
  const at = computeAttainment(1_000_000, 10_000);
  assert.equal(at.percent, ATTAINMENT_CEILING);
  assert.ok(at.ratio > 1); // ratio is NOT clamped
  assert.equal(at.attained, true);
});

test('computeAttainment: zero/absent target → 0 percent, not attained', () => {
  const at = computeAttainment(500, 0);
  assert.equal(at.ratio, 0);
  assert.equal(at.percent, 0);
  assert.equal(at.attained, false);
});

test('computeAttainment: negative actual floored to 0', () => {
  const at = computeAttainment(-500, 10_000);
  assert.equal(at.actual, 0);
  assert.equal(at.percent, 0);
});

test('actualForMetric: picks the right counter', () => {
  const s: OwnerStats = { ownerId: 'a', wonRevenue: 9000, wonCount: 3, activities: 2 };
  assert.equal(actualForMetric(s, 'revenue'), 9000);
  assert.equal(actualForMetric(s, 'count'), 3);
});

/* -------------------------------------------------------------------------- */
/* streaks                                                                     */
/* -------------------------------------------------------------------------- */

test('currentStreak: consecutive days ending today', () => {
  const days = ['2026-06-11', '2026-06-12', '2026-06-13'];
  assert.equal(currentStreak(days, '2026-06-13'), 3);
});

test('currentStreak: gap breaks the streak', () => {
  const days = ['2026-06-09', '2026-06-12', '2026-06-13'];
  assert.equal(currentStreak(days, '2026-06-13'), 2);
});

test('currentStreak: grace when today is not yet logged but yesterday is', () => {
  const days = ['2026-06-11', '2026-06-12'];
  assert.equal(currentStreak(days, '2026-06-13'), 2);
});

test('currentStreak: no recent activity → 0', () => {
  const days = ['2026-06-01'];
  assert.equal(currentStreak(days, '2026-06-13'), 0);
});

test('currentStreak: empty set → 0', () => {
  assert.equal(currentStreak([], '2026-06-13'), 0);
});

test('currentStreak: invalid today key → 0', () => {
  assert.equal(currentStreak(['2026-06-13'], 'not-a-date'), 0);
});

test('longestStreak: finds the longest run anywhere', () => {
  const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-02-01', '2026-02-02'];
  assert.equal(longestStreak(days), 3);
});

test('longestStreak: single day → 1, empty → 0', () => {
  assert.equal(longestStreak(['2026-01-01']), 1);
  assert.equal(longestStreak([]), 0);
});

test('longestStreak: dedupes repeated keys', () => {
  assert.equal(longestStreak(['2026-01-01', '2026-01-01', '2026-01-02']), 2);
});

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

test('formatDayKey: UTC YYYY-MM-DD', () => {
  assert.equal(formatDayKey(new Date(Date.UTC(2026, 5, 13))), '2026-06-13');
  assert.equal(formatDayKey(new Date(Date.UTC(2026, 0, 5))), '2026-01-05');
});

test('toFiniteNumber: coerces strings and rejects junk', () => {
  assert.equal(toFiniteNumber('42'), 42);
  assert.equal(toFiniteNumber('abc'), 0);
  assert.equal(toFiniteNumber(null), 0);
  assert.equal(toFiniteNumber(Number.NaN), 0);
});
