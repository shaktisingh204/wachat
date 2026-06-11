/**
 * SabFlow — scheduled-trigger tick (the thing that makes `schedule` events
 * actually fire).
 *
 * One tick = "it is now minute M; find every published flow with an enabled
 * `schedule` event whose cron expression matches M, and enqueue one
 * execution per (flow, event)". Runs from two entry points:
 *
 *   - the PM2 scheduler worker (`src/workers/sabflow-scheduler.ts`), the
 *     canonical driver on the self-hosted box, and
 *   - `GET /api/cron/sabflow-scheduled`, kept for external cron/HTTP ticks.
 *
 * Both pass their own `Db` handle — this module deliberately does NOT
 * import `@/lib/mongodb` (it is `server-only` and crashes under the
 * worker's tsx runtime).
 *
 * Idempotency: each (flow, event, minute) is claimed atomically via a
 * Mongo upsert on `fireKey` in `sabflow_executions` — whichever tick
 * claims the row enqueues; everyone else skips. The BullMQ `jobId` carries
 * the same key as a second guard against producer races.
 *
 * Timezones: expressions are evaluated against the wall clock of the
 * event's `options.timezone` (IANA name) when present, UTC otherwise.
 */

import { ObjectId, type Db } from 'mongodb';

import { enqueueWorkerExecution } from '@/lib/sabflow/queue/enqueue-worker';
import type { SabFlowEvent, ScheduleEventOptions } from '@/lib/sabflow/types';

/** Hard ceiling on enqueues per tick — keeps the queue + Mongo healthy. */
const MAX_ENQUEUES_PER_TICK = 50;
/** Mongo find() limit — only fetch as many candidates as we might dispatch. */
const MAX_CANDIDATES_PER_TICK = 1000;

export interface ScheduledTickResult {
  /** Flows scanned (published, with at least one schedule event). */
  scanned: number;
  /** (flow, event) pairs whose expression matched this minute. */
  matched: number;
  /** Executions actually enqueued by this tick. */
  enqueued: number;
  /** Matched fires already claimed by a concurrent/earlier tick. */
  alreadyClaimed: number;
  /** Matched fires dropped because the per-tick cap was reached. */
  deferred: number;
  /** Per-fire failures (logged, never fatal to the tick). */
  errors: number;
  /** The UTC minute this tick evaluated, ISO string. */
  minute: string;
}

// ─── Minute bucketing ────────────────────────────────────────────────────────

/** Truncate `date` to whole-minute UTC: ISO form + compact `YYYY-MM-DDTHH:MM`. */
function minuteBucket(date: Date): { iso: string; stamp: string } {
  const d = new Date(date.getTime());
  d.setUTCSeconds(0, 0);
  const iso = d.toISOString();
  return { iso, stamp: iso.slice(0, 16) };
}

// ─── Cron matching (5-field grammar, same matcher the route used) ───────────

interface CurrentMoment {
  minute: number;
  hour: number;
  dom: number;
  month: number;
  dow: number;
}

/** Wall-clock components of `date` in `timeZone` (UTC when omitted/invalid). */
function momentIn(date: Date, timeZone?: string): CurrentMoment {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        minute: 'numeric',
        hour: 'numeric',
        hour12: false,
        day: 'numeric',
        month: 'numeric',
        weekday: 'short',
      }).formatToParts(date);
      const get = (type: string) =>
        Number(parts.find((p) => p.type === type)?.value ?? NaN);
      const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
      const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
      const moment = {
        minute: get('minute'),
        // Intl yields 24 for midnight with hour12:false in some engines.
        hour: get('hour') % 24,
        dom: get('day'),
        month: get('month'),
        dow: dow === -1 ? date.getUTCDay() : dow,
      };
      if ([moment.minute, moment.hour, moment.dom, moment.month].every(Number.isFinite)) {
        return moment;
      }
    } catch {
      // Unknown IANA name — fall through to UTC.
    }
  }
  return {
    minute: date.getUTCMinutes(),
    hour: date.getUTCHours(),
    dom: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    dow: date.getUTCDay(),
  };
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;
  for (const token of field.split(',')) {
    const stepIdx = token.indexOf('/');
    let rangePart = token;
    let step = 1;
    if (stepIdx !== -1) {
      rangePart = token.slice(0, stepIdx);
      const s = Number(token.slice(stepIdx + 1));
      if (!Number.isFinite(s) || s < 1 || !Number.isInteger(s)) continue;
      step = s;
    }
    let lo = min;
    let hi = max;
    if (rangePart !== '*') {
      const dashIdx = rangePart.indexOf('-');
      if (dashIdx !== -1) {
        lo = Number(rangePart.slice(0, dashIdx));
        hi = Number(rangePart.slice(dashIdx + 1));
      } else {
        lo = Number(rangePart);
        hi = stepIdx === -1 ? lo : max;
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    }
    for (let v = lo; v <= hi; v += step) {
      if (v === value) return true;
    }
  }
  return false;
}

/** 5-field cron match against an already-resolved wall-clock moment. */
export function cronExpressionMatches(expr: string, now: CurrentMoment): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [m, h, d, mon, dow] = parts;

  if (!matchField(m, now.minute, 0, 59)) return false;
  if (!matchField(h, now.hour, 0, 23)) return false;
  if (!matchField(mon, now.month, 1, 12)) return false;

  // cron OR semantics: when both DOM and DOW are restricted, either match
  // is sufficient; when only one is restricted, that one governs.
  const domWildcard = d === '*';
  const dowWildcard = dow === '*';
  const domOk = matchField(d, now.dom, 1, 31);
  const dowOk = matchField(dow, now.dow, 0, 6);

  if (!domWildcard && !dowWildcard) return domOk || dowOk;
  return domOk && dowOk;
}

// ─── The tick ────────────────────────────────────────────────────────────────

interface ScheduledFlowRow {
  _id: ObjectId;
  userId?: string;
  name?: string;
  events?: SabFlowEvent[];
}

export async function runScheduledTick(
  db: Db,
  now: Date = new Date(),
): Promise<ScheduledTickResult> {
  const { iso: scheduledFor, stamp } = minuteBucket(now);
  const result: ScheduledTickResult = {
    scanned: 0,
    matched: 0,
    enqueued: 0,
    alreadyClaimed: 0,
    deferred: 0,
    errors: 0,
    minute: scheduledFor,
  };

  const flows = (await db
    .collection('sabflows')
    .find({
      status: 'PUBLISHED',
      events: { $elemMatch: { type: 'schedule' } },
    })
    .limit(MAX_CANDIDATES_PER_TICK)
    .toArray()) as unknown as ScheduledFlowRow[];

  result.scanned = flows.length;
  const execCol = db.collection('sabflow_executions');

  for (const flow of flows) {
    const flowId = flow._id.toHexString();
    const projectId = String(flow.userId ?? '');
    if (!projectId) continue;

    for (const event of flow.events ?? []) {
      if (event.type !== 'schedule') continue;
      const options = (event.options ?? {}) as ScheduleEventOptions;
      if (options.enabled === false) continue;
      const expr = options.cronExpression?.trim();
      if (!expr) continue;

      if (!cronExpressionMatches(expr, momentIn(now, options.timezone))) continue;
      result.matched += 1;

      if (result.enqueued >= MAX_ENQUEUES_PER_TICK) {
        result.deferred += 1;
        continue;
      }

      const fireKey = `cron:${flowId}:${event.id}:${stamp}`;
      try {
        const executionId = new ObjectId().toHexString();
        const created = new Date();
        // Atomic claim: only the tick that upserts the row may enqueue.
        const claim = await execCol.updateOne(
          { fireKey },
          {
            $setOnInsert: {
              fireKey,
              executionId,
              flowId,
              projectId,
              status: 'queued',
              triggerMode: 'schedule',
              triggerData: { eventId: event.id, scheduledFor },
              startedAt: null,
              finishedAt: null,
              durationMs: null,
              error: null,
              createdAt: created,
              updatedAt: created,
            },
          },
          { upsert: true },
        );
        if (claim.upsertedCount === 0) {
          result.alreadyClaimed += 1;
          continue;
        }

        await enqueueWorkerExecution(
          {
            executionId,
            flowId,
            projectId,
            flowSnapshot: flow,
            triggerMode: 'schedule',
            triggerData: { eventId: event.id, scheduledFor },
            variables: {},
          },
          { jobId: fireKey },
        );
        result.enqueued += 1;
      } catch (err) {
        result.errors += 1;
        console.error(
          `[sabflow][cron-tick] fire failed for ${fireKey}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return result;
}
