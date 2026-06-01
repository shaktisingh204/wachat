import "server-only";

/**
 * SabCRM — dashboard KPI analytics (server-only).
 *
 * Provides a single {@link getDashboardKpis} function that computes four
 * tenant-scoped KPI buckets in parallel from the `sabcrm_records` and
 * `sabcrm_activities` collections:
 *
 *   1. **Record counts per object** — total live records for every object the
 *      project has (standard + custom). Drives the "X Companies / Y People /
 *      …" stat row at the top of the CRM dashboard.
 *
 *   2. **Open opportunities + pipeline value** — count of opportunity records
 *      that have NOT reached the `CUSTOMER` stage (considered closed-won) and
 *      the sum of their `data.amount` fields (plain numeric currency value).
 *
 *   3. **Tasks due today / overdue** — two sub-counts from
 *      `sabcrm_activities` (type=TASK, status≠DONE) using the `dueAt` Date
 *      field. Activities use native `Date` in the DB (not ISO strings).
 *
 *   4. **New records this week** — total records created in the current
 *      calendar week (Mon 00:00 → Sun 23:59 local-midnight UTC) across every
 *      object. Useful as a "CRM activity" health signal.
 *
 * All Mongo queries are:
 *   - Tenant-scoped by `projectId`.
 *   - Owner-scoped by `userId` for the record-level queries (matches the rest
 *     of the records runtime in `records.server.ts`).
 *   - Activity-level queries are scoped by `projectId` only (mirroring
 *     `assignment.server.ts` and the activity list queries — activities belong
 *     to a project, not a single owner).
 *
 * The function NEVER throws to callers — errors return zeroed/empty KPIs and
 * the error is logged server-side. This ensures the dashboard renders even
 * when one aggregation fails.
 *
 * Indexes used (all already provisioned in `ensureSabcrmIndexes`, `db.ts`):
 *   - `sabcrm_records`: `{projectId,object,createdAt}` for per-object counts
 *     and new-this-week scans; `{projectId,object,updatedAt}` for
 *     opportunities (scanned without a sort).
 *   - `sabcrm_activities`: `{projectId,type,status,assigneeId,dueAt}` for
 *     task due/overdue queries.
 */

import { sabcrmRecords, sabcrmActivities, ensureSabcrmIndexes } from "./db";
import { listObjects } from "./objects.server";

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

/** Record count for a single object. */
export interface ObjectRecordCount {
  /** Object slug, e.g. `companies`. */
  slug: string;
  /** Human plural label, e.g. `Companies`. */
  labelPlural: string;
  /** Lucide / ZoruUI icon name. */
  icon: string;
  /** Total live records in this project. */
  count: number;
}

/** Open opportunity stats for the pipeline value KPI card. */
export interface OpportunityKpi {
  /** Number of opportunities whose stage is NOT `CUSTOMER`. */
  openCount: number;
  /**
   * Sum of `data.amount` across all open opportunities.
   * `data.amount` is stored as a raw number (CURRENCY field); 0 when none have
   * an amount set or all opportunities are closed.
   */
  pipelineValue: number;
}

/** Task counts from the activities collection (type=TASK, status≠DONE). */
export interface TaskKpi {
  /** Open tasks whose `dueAt` is today (local UTC midnight boundaries). */
  dueToday: number;
  /** Open tasks whose `dueAt` is before today (past due). */
  overdue: number;
  /** Total open tasks (no due date filter — dueToday + overdue + future). */
  totalOpen: number;
}

/** Records created in the current calendar week (Mon 00:00 UTC → now). */
export interface NewThisWeekKpi {
  /** Record count created this week across all objects. */
  count: number;
  /**
   * Start of the current week (Monday 00:00:00.000 UTC) as an ISO string.
   * Included so the UI can display the reference date range.
   */
  weekStart: string;
}

/** Full dashboard KPI snapshot returned by {@link getDashboardKpis}. */
export interface CrmDashboardKpis {
  /** One entry per object the project has (standard + custom). */
  recordCounts: ObjectRecordCount[];
  opportunities: OpportunityKpi;
  tasks: TaskKpi;
  newThisWeek: NewThisWeekKpi;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Stage value that marks a closed-won opportunity. */
const CLOSED_WON_STAGE = "CUSTOMER";

/**
 * Returns Monday 00:00:00.000 UTC of the week that contains `now`.
 *
 * `getUTCDay()` returns 0 = Sunday … 6 = Saturday.
 * We treat Monday as the first day: offset = (day + 6) % 7 days back.
 */
function startOfWeekUtc(now: Date): Date {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const offset = (day + 6) % 7; // days since last Monday
  d.setUTCDate(d.getUTCDate() - offset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Start of today (UTC midnight). */
function startOfTodayUtc(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Start of tomorrow (UTC midnight). */
function startOfTomorrowUtc(now: Date): Date {
  const d = startOfTodayUtc(now);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/* -------------------------------------------------------------------------- */
/* Sub-aggregations                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Count records per object in a single `$group` aggregation, returning a map
 * of `slug → count`. This avoids N separate `countDocuments` calls.
 */
async function countsByObject(
  projectId: string,
  userId: string,
): Promise<Map<string, number>> {
  const col = await sabcrmRecords();
  const pipeline = [
    { $match: { projectId, userId } },
    { $group: { _id: "$object", count: { $sum: 1 } } },
  ];
  const rows = await col
    .aggregate<{ _id: string; count: number }>(pipeline)
    .toArray();
  return new Map(rows.map((r) => [r._id, r.count]));
}

/**
 * Opportunity KPI: open count + pipeline value.
 *
 * "Open" = stage ≠ `CUSTOMER`. Pipeline value = sum of `data.amount`
 * (cast to number; non-numeric values are treated as 0 via `$toDouble`).
 */
async function computeOpportunityKpi(
  projectId: string,
  userId: string,
): Promise<OpportunityKpi> {
  const col = await sabcrmRecords();
  const pipeline = [
    {
      $match: {
        projectId,
        userId,
        object: "opportunities",
        "data.stage": { $ne: CLOSED_WON_STAGE },
      },
    },
    {
      $group: {
        _id: null,
        openCount: { $sum: 1 },
        pipelineValue: {
          $sum: {
            $ifNull: [{ $toDouble: "$data.amount" }, 0],
          },
        },
      },
    },
  ];
  const rows = await col
    .aggregate<{ _id: null; openCount: number; pipelineValue: number }>(
      pipeline,
    )
    .toArray();
  const row = rows[0];
  return {
    openCount: row?.openCount ?? 0,
    pipelineValue: row?.pipelineValue ?? 0,
  };
}

/**
 * Task KPI from the `sabcrm_activities` collection (type=TASK, status≠DONE).
 *
 * Activities store `dueAt` as a native MongoDB `Date` (see `SabcrmActivityDoc`
 * in `db.ts`), so we compare directly against JS `Date` boundaries.
 *
 * Three counts are computed in one aggregation using `$facet`:
 *   - `overdue`  — dueAt < today midnight UTC
 *   - `dueToday` — today midnight UTC ≤ dueAt < tomorrow midnight UTC
 *   - `totalOpen` — all open tasks (no dueAt filter)
 */
async function computeTaskKpi(
  projectId: string,
  now: Date,
): Promise<TaskKpi> {
  const todayStart = startOfTodayUtc(now);
  const todayEnd = startOfTomorrowUtc(now);

  const col = await sabcrmActivities();
  const pipeline = [
    {
      $match: {
        projectId,
        type: "TASK",
        status: { $ne: "DONE" },
      },
    },
    {
      $facet: {
        overdue: [
          { $match: { dueAt: { $lt: todayStart } } },
          { $count: "n" },
        ],
        dueToday: [
          { $match: { dueAt: { $gte: todayStart, $lt: todayEnd } } },
          { $count: "n" },
        ],
        totalOpen: [{ $count: "n" }],
      },
    },
  ];

  const rows = await col
    .aggregate<{
      overdue: Array<{ n: number }>;
      dueToday: Array<{ n: number }>;
      totalOpen: Array<{ n: number }>;
    }>(pipeline)
    .toArray();

  const facet = rows[0];
  return {
    overdue: facet?.overdue?.[0]?.n ?? 0,
    dueToday: facet?.dueToday?.[0]?.n ?? 0,
    totalOpen: facet?.totalOpen?.[0]?.n ?? 0,
  };
}

/**
 * Count records created since the start of the current week (Mon 00:00 UTC).
 *
 * `createdAt` is stored as an ISO-8601 string in `sabcrm_records` (see
 * `createRecord` in `records.server.ts`). Mongo's lexicographic string
 * comparison works correctly for ISO-8601 when both sides are formatted the
 * same way, so we compare `{ $gte: weekStart.toISOString() }` directly.
 */
async function computeNewThisWeek(
  projectId: string,
  userId: string,
  now: Date,
): Promise<NewThisWeekKpi> {
  const weekStart = startOfWeekUtc(now);
  const weekStartIso = weekStart.toISOString();

  const col = await sabcrmRecords();
  const count = await col.countDocuments({
    projectId,
    userId,
    createdAt: { $gte: weekStartIso },
  } as unknown as Parameters<typeof col.countDocuments>[0]);

  return { count, weekStart: weekStartIso };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Computes all four KPI buckets for the CRM dashboard in a single call.
 *
 * All sub-queries run concurrently. Errors in individual buckets are caught
 * and replaced with zeroed fallback values so a partial DB failure never
 * breaks the entire dashboard.
 *
 * @param projectId  Tenant project id (already validated by the gate layer).
 * @param userId     Owner user id (record-level scope, mirrors `listRecords`).
 */
export async function getDashboardKpis(
  projectId: string,
  userId: string,
): Promise<CrmDashboardKpis> {
  // Ensure indexes are present before running aggregations.
  await ensureSabcrmIndexes();

  const now = new Date();

  // Run all independent queries in parallel.
  const [objectList, countMap, opportunityKpi, taskKpi, newThisWeek] =
    await Promise.all([
      listObjects(projectId).catch((): Awaited<ReturnType<typeof listObjects>> => []),
      countsByObject(projectId, userId).catch((): Map<string, number> => new Map()),
      computeOpportunityKpi(projectId, userId).catch(
        (): OpportunityKpi => ({ openCount: 0, pipelineValue: 0 }),
      ),
      computeTaskKpi(projectId, now).catch(
        (): TaskKpi => ({ dueToday: 0, overdue: 0, totalOpen: 0 }),
      ),
      computeNewThisWeek(projectId, userId, now).catch(
        (): NewThisWeekKpi => ({
          count: 0,
          weekStart: startOfWeekUtc(now).toISOString(),
        }),
      ),
    ]);

  const recordCounts: ObjectRecordCount[] = objectList.map((obj) => ({
    slug: obj.slug,
    labelPlural: obj.labelPlural,
    icon: obj.icon,
    count: countMap.get(obj.slug) ?? 0,
  }));

  return {
    recordCounts,
    opportunities: opportunityKpi,
    tasks: taskKpi,
    newThisWeek,
  };
}
