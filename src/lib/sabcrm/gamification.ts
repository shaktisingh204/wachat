/**
 * SabCRM — sales gamification — PURE scoring + ranking helpers.
 *
 * The structural twin of `./scoring.ts`: a `'server-only'`- and I/O-free module
 * so the unit tests (`tsx --test`) AND the `'use client'` leaderboard page can
 * import the deterministic points / tier / attainment / streak math directly.
 * All Mongo aggregation + member resolution side effects live in
 * `./gamification.server.ts`, which re-exports the types from here.
 *
 * ## Model
 *
 * Each rep accrues raw counters within a period:
 *   - `wonRevenue`   — summed `data.amount` of their closed-won deals.
 *   - `wonCount`     — number of closed-won deals.
 *   - `activities`   — calls + meetings logged (engagement).
 *
 * A {@link PointsModel} maps those counters to a single `points` total
 * (a weighted linear combination). Reps are then ranked by points desc with a
 * stable, deterministic tie-break (wonRevenue → wonCount → activities → owner
 * id) so the board never "jitters" between equal scores. A rep's points resolve
 * to a {@link Tier} (the highest tier whose `min` the points reach) and may earn
 * one or more {@link Badge}s (independent threshold achievements).
 *
 * Attainment is `actual / target` against a quota (revenue or count) clamped to
 * a display ceiling. Streaks count consecutive active days from a set of
 * activity day-keys (`YYYY-MM-DD`).
 *
 * Everything here is pure + deterministic — no `Date.now()`, no randomness — so
 * the same inputs always rank identically and the unit tests are stable.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** Which raw counter a leaderboard ranks + a quota measures. */
export type GamificationMetric = 'points' | 'revenue' | 'count' | 'activities';

/** Leaderboard period granularity (resolved to a date window server-side). */
export type GamificationPeriod = 'week' | 'month' | 'quarter' | 'year' | 'all';

/** The raw per-owner counters a points model consumes. */
export interface OwnerStats {
  /** Owner (workspace member) hex id. Stable tie-break of last resort. */
  ownerId: string;
  /** Summed `data.amount` of closed-won deals in the period. */
  wonRevenue: number;
  /** Number of closed-won deals in the period. */
  wonCount: number;
  /** Calls + meetings logged in the period. */
  activities: number;
}

/**
 * Linear points model. `points = wonRevenue*revenue + wonCount*perWonDeal +
 * activities*perActivity`. Revenue is weighted small (it is a large magnitude)
 * so a sensible default keeps the three terms commensurate.
 */
export interface PointsModel {
  /** Points per 1 unit of won revenue (e.g. 0.01 → 1pt per $100). */
  revenue: number;
  /** Flat points per closed-won deal. */
  perWonDeal: number;
  /** Flat points per logged call / meeting. */
  perActivity: number;
}

/** A points band: `points >= min` maps to this tier (highest matching wins). */
export interface Tier {
  /** Inclusive lower bound on total points. */
  min: number;
  /** Human label, e.g. "Gold". */
  label: string;
  /** `--ui20-*` token name or hex; drives the colored tier chip. */
  color?: string;
}

/** A single achievement: earned when its counter reaches `threshold`. */
export interface Badge {
  /** Stable id (React key + dedupe). */
  id: string;
  /** Human label, e.g. "Closer". */
  label: string;
  /** Which counter the threshold is checked against. */
  metric: Exclude<GamificationMetric, 'points'> | 'points';
  /** Inclusive threshold the counter must reach. */
  threshold: number;
  /** Optional icon name (lucide) for the UI. */
  icon?: string;
  /** Optional color token. */
  color?: string;
}

/** A fully-scored, ranked leaderboard row. */
export interface ScoreboardEntry extends OwnerStats {
  /** Display name (resolved from the member roster server-side). */
  name: string;
  /** Avatar URL when available. */
  image?: string;
  /** Computed points total (rounded to an integer). */
  points: number;
  /** 1-based rank after sorting. */
  rank: number;
  /** Resolved tier, or null when no tier's `min` is reached. */
  tier: Tier | null;
  /** Ids of every badge earned. */
  badges: string[];
}

/** Quota-attainment computation result. */
export interface Attainment {
  /** Achieved amount in the quota's metric (revenue or count). */
  actual: number;
  /** The quota goal. */
  target: number;
  /** `actual / target`, 0 when no target; NOT clamped. */
  ratio: number;
  /** `ratio * 100`, clamped to [0, ceiling] for the progress bar. */
  percent: number;
  /** True once `actual >= target` (target > 0). */
  attained: boolean;
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sensible default points weighting. Revenue is scaled to ~1pt per $100 so a
 * $10k deal ≈ 100pts, a closed deal is worth 50 flat, and each logged
 * call/meeting is worth 5 — keeping all three terms in the same order of
 * magnitude for a typical book.
 */
export const DEFAULT_POINTS_MODEL: PointsModel = {
  revenue: 0.01,
  perWonDeal: 50,
  perActivity: 5,
};

/** Default tier ladder (Bronze → Diamond). */
export const DEFAULT_TIERS: Tier[] = [
  { min: 0, label: 'Bronze', color: 'orange' },
  { min: 250, label: 'Silver', color: 'gray' },
  { min: 600, label: 'Gold', color: 'yellow' },
  { min: 1200, label: 'Platinum', color: 'sky' },
  { min: 2500, label: 'Diamond', color: 'turquoise' },
];

/** Default achievement badges. */
export const DEFAULT_BADGES: Badge[] = [
  { id: 'first-win', label: 'First Win', metric: 'count', threshold: 1, icon: 'Sparkles', color: 'green' },
  { id: 'closer', label: 'Closer', metric: 'count', threshold: 5, icon: 'Target', color: 'sky' },
  { id: 'rainmaker', label: 'Rainmaker', metric: 'revenue', threshold: 50000, icon: 'CloudRain', color: 'turquoise' },
  { id: 'grinder', label: 'Grinder', metric: 'activities', threshold: 50, icon: 'Activity', color: 'purple' },
  { id: 'mvp', label: 'MVP', metric: 'points', threshold: 1000, icon: 'Crown', color: 'yellow' },
];

/** Progress-bar display ceiling for attainment percent. */
export const ATTAINMENT_CEILING = 150;

/* -------------------------------------------------------------------------- */
/* Numeric helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Coerce any value to a finite number, defaulting to 0. */
export function toFiniteNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Round half-up to an integer (avoids `-0`). */
function roundInt(n: number): number {
  const r = Math.round(n);
  return r === 0 ? 0 : r;
}

/* -------------------------------------------------------------------------- */
/* Points + tier + badges                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Compute a single integer points total from raw counters via the linear model.
 * Negative inputs are floored to 0 (a refunded deal must not penalise points).
 */
export function computePoints(
  stats: OwnerStats,
  model: PointsModel = DEFAULT_POINTS_MODEL,
): number {
  const revenue = Math.max(0, toFiniteNumber(stats.wonRevenue));
  const wonCount = Math.max(0, toFiniteNumber(stats.wonCount));
  const activities = Math.max(0, toFiniteNumber(stats.activities));
  const raw =
    revenue * toFiniteNumber(model.revenue) +
    wonCount * toFiniteNumber(model.perWonDeal) +
    activities * toFiniteNumber(model.perActivity);
  return roundInt(Math.max(0, raw));
}

/** The highest tier whose `min` the points reach, or null. */
export function resolveTier(
  tiers: Tier[] | undefined,
  points: number,
): Tier | null {
  if (!tiers || tiers.length === 0) return null;
  let best: Tier | null = null;
  for (const t of tiers) {
    if (points >= t.min && (best === null || t.min > best.min)) best = t;
  }
  return best;
}

/** The value of the counter a badge checks against. */
function badgeCounter(stats: OwnerStats, points: number, metric: Badge['metric']): number {
  switch (metric) {
    case 'revenue':
      return toFiniteNumber(stats.wonRevenue);
    case 'count':
      return toFiniteNumber(stats.wonCount);
    case 'activities':
      return toFiniteNumber(stats.activities);
    case 'points':
      return points;
    default:
      return 0;
  }
}

/** Ids of every badge whose threshold the rep's counters reach. */
export function earnedBadges(
  stats: OwnerStats,
  points: number,
  badges: Badge[] = DEFAULT_BADGES,
): string[] {
  const out: string[] = [];
  for (const b of badges) {
    if (badgeCounter(stats, points, b.metric) >= b.threshold) out.push(b.id);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                      */
/* -------------------------------------------------------------------------- */

/** Profile fields merged into a scoreboard row by the server layer. */
export interface OwnerProfile {
  name: string;
  image?: string;
}

/**
 * Build a fully-ranked scoreboard from raw per-owner stats. Pure + stable:
 *
 *   1. points are computed per owner via {@link computePoints};
 *   2. rows sort by points desc, then a deterministic tie-break chain
 *      (wonRevenue → wonCount → activities → ownerId asc) so equal scores never
 *      jitter between renders;
 *   3. 1-based `rank` is assigned in the sorted order (dense by position — two
 *      reps with identical points still get distinct ranks via the tie-break,
 *      matching how sales leaderboards display "you are #4").
 *
 * `profiles` maps ownerId → display profile; missing entries fall back to a
 * truncated id so a row is never blank.
 */
export function buildScoreboard(
  stats: OwnerStats[],
  opts?: {
    model?: PointsModel;
    tiers?: Tier[];
    badges?: Badge[];
    profiles?: Map<string, OwnerProfile> | Record<string, OwnerProfile>;
  },
): ScoreboardEntry[] {
  const model = opts?.model ?? DEFAULT_POINTS_MODEL;
  const tiers = opts?.tiers ?? DEFAULT_TIERS;
  const badges = opts?.badges ?? DEFAULT_BADGES;
  const lookup = (id: string): OwnerProfile | undefined => {
    if (!opts?.profiles) return undefined;
    return opts.profiles instanceof Map
      ? opts.profiles.get(id)
      : opts.profiles[id];
  };

  const scored = stats.map((s) => {
    const points = computePoints(s, model);
    const profile = lookup(s.ownerId);
    return {
      ...s,
      wonRevenue: toFiniteNumber(s.wonRevenue),
      wonCount: toFiniteNumber(s.wonCount),
      activities: toFiniteNumber(s.activities),
      name: profile?.name?.trim() || `Member ${String(s.ownerId).slice(-6)}`,
      image: profile?.image,
      points,
      rank: 0,
      tier: resolveTier(tiers, points),
      badges: earnedBadges(s, points, badges),
    } satisfies ScoreboardEntry;
  });

  scored.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wonRevenue !== a.wonRevenue) return b.wonRevenue - a.wonRevenue;
    if (b.wonCount !== a.wonCount) return b.wonCount - a.wonCount;
    if (b.activities !== a.activities) return b.activities - a.activities;
    return String(a.ownerId).localeCompare(String(b.ownerId));
  });

  for (let i = 0; i < scored.length; i += 1) scored[i].rank = i + 1;
  return scored;
}

/** Pull one owner's ranked row out of a scoreboard, or null. */
export function findOwnerEntry(
  board: ScoreboardEntry[],
  ownerId: string,
): ScoreboardEntry | null {
  return board.find((e) => e.ownerId === ownerId) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Attainment                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Quota attainment: `actual / target` as a ratio + a display-clamped percent.
 * A non-positive target yields ratio/percent 0 and `attained: false` (you
 * cannot attain an absent goal). Negative actuals are floored to 0.
 */
export function computeAttainment(
  actual: number,
  target: number,
  ceiling: number = ATTAINMENT_CEILING,
): Attainment {
  const a = Math.max(0, toFiniteNumber(actual));
  const t = toFiniteNumber(target);
  if (t <= 0) {
    return { actual: a, target: Math.max(0, t), ratio: 0, percent: 0, attained: false };
  }
  const ratio = a / t;
  const percent = Math.min(Math.max(ratio * 100, 0), ceiling);
  return { actual: a, target: t, ratio, percent, attained: a >= t };
}

/** Pick the achieved amount for a quota metric from an owner's stats. */
export function actualForMetric(
  stats: OwnerStats,
  metric: 'revenue' | 'count',
): number {
  return metric === 'revenue'
    ? toFiniteNumber(stats.wonRevenue)
    : toFiniteNumber(stats.wonCount);
}

/* -------------------------------------------------------------------------- */
/* Streaks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Length of the current consecutive-day activity streak ending on `todayKey`.
 *
 * `dayKeys` is a set of `YYYY-MM-DD` strings on which the rep logged activity.
 * Counts back from `todayKey` while each prior day is present. If `todayKey`
 * itself is absent but yesterday is present, the streak still counts from
 * yesterday (a "live" streak not yet extended today). Pure: the caller supplies
 * `todayKey` so there is no hidden clock.
 */
export function currentStreak(
  dayKeys: Iterable<string>,
  todayKey: string,
): number {
  const set = dayKeys instanceof Set ? dayKeys : new Set(dayKeys);
  if (set.size === 0) return 0;

  // Start from today if active, else from yesterday (grace for "not yet today").
  let cursor = parseDayKey(todayKey);
  if (!cursor) return 0;
  if (!set.has(formatDayKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!set.has(formatDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (set.has(formatDayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** The longest run of consecutive days anywhere in the set. */
export function longestStreak(dayKeys: Iterable<string>): number {
  const keys = [...new Set(dayKeys)].filter(Boolean).sort();
  if (keys.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i += 1) {
    const prev = parseDayKey(keys[i - 1]);
    const cur = parseDayKey(keys[i]);
    if (prev && cur && diffDays(prev, cur) === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/* ---- day-key arithmetic (UTC, no Date.now) ---- */

/** Parse `YYYY-MM-DD` to a UTC Date at midnight, or null. */
function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key).trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a Date to its UTC `YYYY-MM-DD` day key. */
export function formatDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** A new Date offset by `n` whole days (UTC). */
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/** Whole-day difference `b - a` (assumes UTC-midnight inputs). */
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
