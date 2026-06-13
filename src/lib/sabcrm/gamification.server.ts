import 'server-only';

/**
 * SabCRM — sales gamification runtime (server-only).
 *
 * Builds the leaderboard, per-rep scorecard and contest data the
 * `/sabcrm/leaderboard` surface renders, plus CRUD for sales contests
 * (`sabcrm_contests`). Read-mostly: the only writes are contest config.
 *
 * ## Data sources (all tenant-scoped by `projectId`)
 *
 *   - **Won deals** — `sabcrm_records` where `object: 'leads'` (the
 *     leads/deals/opportunities object) and `data.stage` is a closed-won stage.
 *     Revenue is `data.amount` cast to a double; owner attribution follows the
 *     chain `data.owner → data.ownerId → data.assigneeId → userId` (creator),
 *     each coerced to a hex id (relation values may be `{id}`/`{value}`
 *     objects). Window: `closeDate` when present, else `updatedAt`/`createdAt`.
 *   - **Activities** — `sabcrm_activities` of type CALL / MEETING, attributed to
 *     `authorId`, windowed by `createdAt` (a native `Date`).
 *   - **Quotas** — reused from the Rust `sabcrm-targets` quotas surface
 *     ({@link sabcrmQuotasApi}) — gamification never re-implements targets.
 *   - **Member profiles** — {@link listCrmMembers} (owner + agents roster).
 *
 * ## Performance note
 *
 * Ranking is done with Mongo `$group` aggregation, NOT Redis. For very large
 * orgs a Redis ZSET (one sorted set per `projectId:period:metric`, incremented
 * on deal-won / activity-logged events) would let the board read in O(log N)
 * without a full scan — a future optimisation, deliberately out of scope here
 * to keep the feature IN-HOUSE with zero new infra.
 *
 * The pure ranking / tier / badge / attainment / streak math lives in
 * `./gamification.ts`; this module only hydrates it from Mongo + the roster.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { sabcrmRecords, sabcrmActivities } from './db';
import { listCrmMembers } from './members.server';
import {
  sabcrmQuotasApi,
  type SabcrmRustQuota,
  type SabcrmQuotaMetric,
} from '@/lib/rust-client/sabcrm-targets';
import {
  buildScoreboard,
  findOwnerEntry,
  computeAttainment,
  actualForMetric,
  currentStreak,
  longestStreak,
  formatDayKey,
  toFiniteNumber,
  DEFAULT_TIERS,
  DEFAULT_BADGES,
  type GamificationPeriod,
  type GamificationMetric,
  type OwnerStats,
  type OwnerProfile,
  type ScoreboardEntry,
  type Attainment,
  type Tier,
  type Badge,
} from './gamification';

export {
  buildScoreboard,
  computeAttainment,
  currentStreak,
  longestStreak,
  DEFAULT_TIERS,
  DEFAULT_BADGES,
  type GamificationPeriod,
  type GamificationMetric,
  type OwnerStats,
  type ScoreboardEntry,
  type Attainment,
  type Tier,
  type Badge,
} from './gamification';

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** The leads/deals/opportunities object slug (one concept in SabCRM). */
const DEALS_OBJECT = 'leads';

/** Stage values treated as closed-won. `CUSTOMER` is the standard schema value. */
const WON_STAGES = ['CUSTOMER', 'WON', 'CLOSED_WON'];

const CONTESTS_COLL = 'sabcrm_contests';

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

/** Options for {@link buildLeaderboard}. */
export interface LeaderboardOptions {
  /** Time window (default `month`). */
  period?: GamificationPeriod;
  /** Ranking metric for the headline ordering (always points internally;
   *  `metric` controls which counter the UI emphasises). Default `points`. */
  metric?: GamificationMetric;
}

/** Full leaderboard payload returned to the action. */
export interface LeaderboardResult {
  period: GamificationPeriod;
  metric: GamificationMetric;
  /** ISO window the board covers. */
  window: { start: string; end: string };
  /** Ranked rows (highest first). */
  entries: ScoreboardEntry[];
  /** Active contests in the project (for the board's "Contests" rail). */
  contests: Contest[];
  /** Tier ladder used (so the UI can render the legend). */
  tiers: Tier[];
  /** Badge catalogue used (label/icon lookup). */
  badges: Badge[];
}

/** A single rep's scorecard (their own ranked stats + attainment + streak). */
export interface Scorecard {
  ownerId: string;
  period: GamificationPeriod;
  window: { start: string; end: string };
  /** This rep's ranked board row, or null when they have no activity yet. */
  entry: ScoreboardEntry | null;
  /** Total reps on the board (for "rank X of N"). */
  totalReps: number;
  /** Quota attainment for this rep, when a matching quota exists. */
  attainment:
    | (Attainment & { metric: SabcrmQuotaMetric; quotaName: string })
    | null;
  /** Current consecutive-day activity streak. */
  streak: number;
  /** Longest streak in the trailing window. */
  bestStreak: number;
  /** Badges earned (resolved to label/icon for display). */
  earnedBadges: Badge[];
}

/** A persisted sales contest. */
export interface Contest {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  /** What the contest ranks on. */
  metric: GamificationMetric;
  /** ISO start/end of the contest window. */
  startsAt: string;
  endsAt: string;
  /** Free-text prize. */
  prize?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Input accepted by {@link upsertContest}. */
export interface ContestInput {
  id?: string;
  name: string;
  description?: string;
  metric?: GamificationMetric;
  startsAt: string;
  endsAt: string;
  prize?: string;
  enabled?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Period windows                                                              */
/* -------------------------------------------------------------------------- */

/** Resolve a period to a `[start, end)` UTC window ending at `now`. */
export function periodWindow(
  period: GamificationPeriod,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  switch (period) {
    case 'week': {
      const day = start.getUTCDay(); // 0=Sun
      const offset = (day + 6) % 7; // back to Monday
      start.setUTCDate(start.getUTCDate() - offset);
      break;
    }
    case 'month':
      start.setUTCDate(1);
      break;
    case 'quarter': {
      const q = Math.floor(start.getUTCMonth() / 3) * 3;
      start.setUTCMonth(q, 1);
      break;
    }
    case 'year':
      start.setUTCMonth(0, 1);
      break;
    case 'all':
      start.setTime(0); // epoch
      break;
  }
  return { start, end };
}

/* -------------------------------------------------------------------------- */
/* Aggregation: won deals per owner                                            */
/* -------------------------------------------------------------------------- */

/**
 * Mongo expression that resolves an owner hex id from a record, coalescing the
 * attribution chain and unwrapping relation `{id}`/`{value}` objects.
 */
const OWNER_EXPR = {
  $let: {
    vars: {
      // Each candidate normalised to a string (objects → their id/value).
      o: {
        $cond: [
          { $eq: [{ $type: '$data.owner' }, 'object'] },
          { $ifNull: ['$data.owner.id', '$data.owner.value'] },
          '$data.owner',
        ],
      },
      a: {
        $cond: [
          { $eq: [{ $type: '$data.assigneeId' }, 'object'] },
          { $ifNull: ['$data.assigneeId.id', '$data.assigneeId.value'] },
          '$data.assigneeId',
        ],
      },
    },
    in: {
      $let: {
        vars: {
          chosen: {
            $ifNull: [
              '$$o',
              { $ifNull: ['$data.ownerId', { $ifNull: ['$$a', '$userId'] }] },
            ],
          },
        },
        in: { $toString: '$$chosen' },
      },
    },
  },
};

/**
 * Per-owner won-deal revenue + count within `[start, end)`. The window is keyed
 * on `data.closeDate` when present, else `updatedAt`, else `createdAt` (each
 * coerced to a date). Tenant-scoped by `projectId`, restricted to the deals
 * object + won stages.
 */
async function wonDealsByOwner(
  projectId: string,
  start: Date,
  end: Date,
): Promise<Map<string, { wonRevenue: number; wonCount: number }>> {
  const col = await sabcrmRecords();
  const rows = await col
    .aggregate<{ _id: string; wonRevenue: number; wonCount: number }>([
      {
        $match: {
          projectId,
          object: DEALS_OBJECT,
          'data.stage': { $in: WON_STAGES },
          deletedAt: { $in: [null] },
        },
      },
      {
        $addFields: {
          _closedAt: {
            $convert: {
              input: {
                $ifNull: [
                  '$data.closeDate',
                  { $ifNull: ['$updatedAt', '$createdAt'] },
                ],
              },
              to: 'date',
              onError: null,
              onNull: null,
            },
          },
          _owner: OWNER_EXPR,
          _amount: { $convert: { input: '$data.amount', to: 'double', onError: 0, onNull: 0 } },
        },
      },
      { $match: { _closedAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: '$_owner',
          wonRevenue: { $sum: '$_amount' },
          wonCount: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const map = new Map<string, { wonRevenue: number; wonCount: number }>();
  for (const r of rows) {
    const id = String(r._id ?? '').trim();
    if (!id) continue;
    map.set(id, {
      wonRevenue: toFiniteNumber(r.wonRevenue),
      wonCount: toFiniteNumber(r.wonCount),
    });
  }
  return map;
}

/**
 * Per-author CALL + MEETING counts within `[start, end)` (the engagement term).
 * Attributed to `authorId`, windowed on the native `createdAt` Date.
 */
async function activitiesByOwner(
  projectId: string,
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  const col = await sabcrmActivities();
  const rows = await col
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          projectId,
          type: { $in: ['CALL', 'MEETING'] },
          createdAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: '$authorId', count: { $sum: 1 } } },
    ])
    .toArray();

  const map = new Map<string, number>();
  for (const r of rows) {
    const id = String(r._id ?? '').trim();
    if (!id) continue;
    map.set(id, toFiniteNumber(r.count));
  }
  return map;
}

/** Distinct activity day-keys (`YYYY-MM-DD`) for one author in the window. */
async function activityDayKeys(
  projectId: string,
  authorId: string,
  start: Date,
  end: Date,
): Promise<string[]> {
  const col = await sabcrmActivities();
  const rows = await col
    .aggregate<{ _id: string }>([
      {
        $match: {
          projectId,
          authorId,
          type: { $in: ['CALL', 'MEETING', 'NOTE', 'EMAIL', 'TASK'] },
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
          },
        },
      },
    ])
    .toArray();
  return rows.map((r) => String(r._id)).filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Roster + stats assembly                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Assemble per-owner {@link OwnerStats} for the whole project in `[start, end)`,
 * UNION of (a) every member on the roster and (b) every owner that actually
 * has won deals / activities — so a closer who left the roster still ranks, and
 * a fresh member shows up at 0. Returns stats + a profile map.
 */
async function assembleStats(
  projectId: string,
  start: Date,
  end: Date,
): Promise<{ stats: OwnerStats[]; profiles: Map<string, OwnerProfile> }> {
  const [deals, acts, members] = await Promise.all([
    wonDealsByOwner(projectId, start, end),
    activitiesByOwner(projectId, start, end),
    listCrmMembers(projectId),
  ]);

  const profiles = new Map<string, OwnerProfile>();
  for (const m of members) {
    profiles.set(m.userId, {
      name: m.name?.trim() || m.email,
      image: m.image,
    });
  }

  const ownerIds = new Set<string>([
    ...members.map((m) => m.userId),
    ...deals.keys(),
    ...acts.keys(),
  ]);

  const stats: OwnerStats[] = [];
  for (const ownerId of ownerIds) {
    if (!ownerId) continue;
    const d = deals.get(ownerId);
    stats.push({
      ownerId,
      wonRevenue: d?.wonRevenue ?? 0,
      wonCount: d?.wonCount ?? 0,
      activities: acts.get(ownerId) ?? 0,
    });
  }
  return { stats, profiles };
}

/* -------------------------------------------------------------------------- */
/* Public: leaderboard                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Build the ranked leaderboard for a project + period. Reads won deals +
 * activities, ranks via the pure {@link buildScoreboard}, and attaches the
 * active contests. Read-only. Returns an empty board (never throws) on error so
 * the page always renders.
 */
export async function buildLeaderboard(
  projectId: string,
  opts: LeaderboardOptions = {},
): Promise<LeaderboardResult> {
  const period = opts.period ?? 'month';
  const metric = opts.metric ?? 'points';
  const { start, end } = periodWindow(period);
  const window = { start: start.toISOString(), end: end.toISOString() };

  try {
    const [{ stats, profiles }, contests] = await Promise.all([
      assembleStats(projectId, start, end),
      listContests(projectId, { activeOnly: true }),
    ]);
    const entries = buildScoreboard(stats, { profiles });
    return {
      period,
      metric,
      window,
      entries,
      contests,
      tiers: DEFAULT_TIERS,
      badges: DEFAULT_BADGES,
    };
  } catch {
    return {
      period,
      metric,
      window,
      entries: [],
      contests: [],
      tiers: DEFAULT_TIERS,
      badges: DEFAULT_BADGES,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Public: scorecard + attainment                                             */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the best-matching quota for an owner + period: prefer a quota scoped
 * to this `memberId` whose period overlaps `start`; fall back to a team-wide
 * quota (no `memberId`). Returns null when no quota applies.
 */
function pickQuota(
  quotas: SabcrmRustQuota[],
  ownerId: string,
  start: Date,
): SabcrmRustQuota | null {
  const startKey = formatDayKey(start);
  const inWindow = (q: SabcrmRustQuota): boolean => {
    // Match on the quota's period start month/quarter containing our window.
    if (!q.periodStart) return true;
    return q.periodStart.slice(0, 7) === startKey.slice(0, 7) || q.period === 'quarter';
  };
  const mine = quotas.filter((q) => q.memberId === ownerId && inWindow(q));
  if (mine.length) return mine[0];
  const team = quotas.filter((q) => !q.memberId && inWindow(q));
  return team[0] ?? null;
}

/**
 * Attainment for one owner: pull their stats for the period, match a quota
 * (reusing the Rust quotas surface — gamification never re-implements targets),
 * and compute % via the pure {@link computeAttainment}. Quota fetch failures
 * degrade to `null` (no attainment), never throw.
 */
export async function attainmentForOwner(
  projectId: string,
  ownerId: string,
  period: GamificationPeriod = 'month',
): Promise<(Attainment & { metric: SabcrmQuotaMetric; quotaName: string }) | null> {
  const { start, end } = periodWindow(period);
  const deals = await wonDealsByOwner(projectId, start, end);
  const d = deals.get(ownerId) ?? { wonRevenue: 0, wonCount: 0 };
  const stats: OwnerStats = {
    ownerId,
    wonRevenue: d.wonRevenue,
    wonCount: d.wonCount,
    activities: 0,
  };

  let quotas: SabcrmRustQuota[] = [];
  try {
    // Map the leaderboard period to the quota period vocabulary.
    const qp = period === 'quarter' ? 'quarter' : 'month';
    quotas = await sabcrmQuotasApi.list(projectId, { period: qp });
  } catch {
    return null;
  }
  const quota = pickQuota(quotas, ownerId, start);
  if (!quota) return null;

  const actual = actualForMetric(stats, quota.metric);
  return {
    ...computeAttainment(actual, quota.amount),
    metric: quota.metric,
    quotaName: quota.name,
  };
}

/**
 * Build the full scorecard for one rep: their ranked board row, total reps,
 * quota attainment, streak, best streak, and resolved earned badges. Read-only.
 */
export async function buildScorecard(
  projectId: string,
  ownerId: string,
  period: GamificationPeriod = 'month',
): Promise<Scorecard> {
  const { start, end } = periodWindow(period);
  const window = { start: start.toISOString(), end: end.toISOString() };

  const [board, attainment, dayKeys] = await Promise.all([
    buildLeaderboard(projectId, { period }),
    attainmentForOwner(projectId, ownerId, period),
    activityDayKeys(projectId, ownerId, start, end),
  ]);

  const entry = findOwnerEntry(board.entries, ownerId);
  const earned = entry
    ? DEFAULT_BADGES.filter((b) => entry.badges.includes(b.id))
    : [];
  const todayKey = formatDayKey(new Date());

  return {
    ownerId,
    period,
    window,
    entry,
    totalReps: board.entries.length,
    attainment,
    streak: currentStreak(dayKeys, todayKey),
    bestStreak: longestStreak(dayKeys),
    earnedBadges: earned,
  };
}

/* -------------------------------------------------------------------------- */
/* Contests CRUD (sabcrm_contests)                                            */
/* -------------------------------------------------------------------------- */

interface ContestDoc {
  _id: ObjectId | string;
  projectId: string;
  name: string;
  description?: string;
  metric?: GamificationMetric;
  startsAt: string;
  endsAt: string;
  prize?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toContest(doc: ContestDoc): Contest {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    name: doc.name,
    description: doc.description,
    metric: doc.metric ?? 'points',
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    prize: doc.prize,
    enabled: doc.enabled !== false,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/** List contests in a project (optionally only those currently active). */
export async function listContests(
  projectId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<Contest[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const query: Record<string, unknown> = { projectId };
  if (opts.activeOnly) {
    const nowIso = new Date().toISOString();
    query.enabled = { $ne: false };
    query.startsAt = { $lte: nowIso };
    query.endsAt = { $gte: nowIso };
  }
  const docs = (await db
    .collection(CONTESTS_COLL)
    .find(query)
    .sort({ startsAt: -1 })
    .limit(200)
    .toArray()) as unknown as ContestDoc[];
  return docs.map(toContest);
}

/** One contest by id, scoped to the project, or null. */
export async function getContest(
  projectId: string,
  id: string,
): Promise<Contest | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(CONTESTS_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as ContestDoc | null;
  return doc ? toContest(doc) : null;
}

/** Create (no id) or update (valid id) a contest. Bumps its own `updatedAt`. */
export async function upsertContest(
  projectId: string,
  input: ContestInput,
): Promise<Contest> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    name: input.name?.trim() || 'Untitled contest',
    description: input.description?.trim() || undefined,
    metric: input.metric ?? 'points',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    prize: input.prize?.trim() || undefined,
    enabled: input.enabled !== false,
    updatedAt: now,
  };

  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(CONTESTS_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getContest(projectId, input.id);
    if (saved) return saved;
  }

  const res = await db
    .collection(CONTESTS_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toContest({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

/** Delete a contest by id. Returns true when a doc was removed. */
export async function deleteContest(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(CONTESTS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}
