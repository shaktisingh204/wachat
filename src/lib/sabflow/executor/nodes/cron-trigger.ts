/**
 * SabFlow `SabFlow.CronTrigger` node — periodic workflow ignition driven
 * by Vercel Cron.
 *
 * Track B Phase 3 (sub-task #3 of 10).
 *
 * Architecture
 * ------------
 * SabNode runs on Vercel (see CLAUDE.md → "Deployment platform"). Periodic
 * work is *only* legal via Vercel Cron — `node-cron`, `agenda`, `Bull`, and
 * similar in-process schedulers are forbidden because Vercel Functions are
 * ephemeral and stateless. The wire-up is:
 *
 *   vercel.json `crons[]`
 *       └── POST /api/cron/sabflow-scheduled  (every minute)
 *               └── for each active workflow whose root is a CronTrigger:
 *                      pick the cron expressions returned by
 *                      `cronExpressionsForNode()` and, when one matches
 *                      the current minute, dispatch `execute(ctx)` with
 *                      `{ scheduledFor, fireKey }` injected via
 *                      `ctx.getNodeParameter("__fire", 0)`.
 *
 * Phase 6 sub-task #2 owns the `/api/cron/sabflow-scheduled` route; the
 * helpers exported here are the contract that route consumes.
 *
 * n8n parity: this is the SabFlow analogue of n8n's `Schedule Trigger` node
 * (`n8n-nodes-base.scheduleTrigger`). Property shape mirrors n8n's
 * `triggerTimes` fixed-collection so imported n8n workflows round-trip
 * losslessly.
 */

import type {
  NodeExecutionContext,
  NodeExecutionItem,
  NodeExecutionResult,
  NodeRegistration,
} from '../contract';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * n8n-shape trigger-time entry. One CronTrigger node may declare multiple
 * entries; each one expands to a single 5-field cron expression.
 *
 * `mode` matches n8n `Schedule Trigger`'s "Trigger Interval" options.
 */
export type CronTriggerMode =
  | 'everyMinute'
  | 'everyHour'
  | 'everyDay'
  | 'everyWeek'
  | 'everyMonth'
  | 'cronExpression';

export interface CronTriggerTime {
  mode: CronTriggerMode;
  /** 0–23. Used by everyDay / everyWeek / everyMonth. Defaults to 0. */
  hour?: number;
  /** 0–59. Used by everyHour / everyDay / everyWeek / everyMonth. Defaults to 0. */
  minute?: number;
  /** 0–6 (Sunday=0). Used by everyWeek. Defaults to 1 (Monday). */
  weekday?: number;
  /** 1–31. Used by everyMonth. Defaults to 1. */
  dayOfMonth?: number;
  /** Raw 5-field cron string. Used by cronExpression. */
  expression?: string;
}

export interface CronTriggerParameters {
  triggerTimes: CronTriggerTime[];
}

/**
 * Payload injected by the `/api/cron/sabflow-scheduled` handler before it
 * dispatches `execute(ctx)`. Mirrors what n8n emits from its Schedule
 * Trigger so downstream nodes (e.g. `$json.scheduledFor`) work unchanged.
 */
export interface CronFirePayload {
  /** ISO-8601 string for the minute that triggered this run. */
  scheduledFor: string;
  /**
   * Deterministic dedupe key — `${workflowId}:${nodeId}:${scheduledFor}`.
   * The dispatcher uses it to guarantee at-most-once delivery per minute
   * even if Vercel double-invokes the cron handler.
   */
  fireKey: string;
}

// ─── Cron parsing (hand-rolled, zero deps) ──────────────────────────────────

/**
 * A normalised 5-field cron expression. Each field is the explicit set of
 * integers it may match. `null` means "wildcard" (any value).
 *
 * Field order matches the POSIX / Vercel Cron convention:
 *   minute  hour  dayOfMonth  month  dayOfWeek
 */
interface ParsedCron {
  minute: number[] | null;
  hour: number[] | null;
  dayOfMonth: number[] | null;
  month: number[] | null;
  dayOfWeek: number[] | null;
}

const FIELD_BOUNDS: Array<{
  name: keyof ParsedCron;
  min: number;
  max: number;
}> = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'dayOfMonth', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'dayOfWeek', min: 0, max: 6 },
];

/** Throws when the expression is malformed or violates Vercel's one-per-minute floor. */
function parseCronExpression(expr: string): ParsedCron {
  const trimmed = expr.trim().replace(/\s+/g, ' ');
  const parts = trimmed.split(' ');
  if (parts.length !== 5) {
    throw new Error(
      `CronTrigger: expression "${expr}" must have exactly 5 fields (got ${parts.length}).`,
    );
  }

  const result: Partial<ParsedCron> = {};
  for (let i = 0; i < 5; i++) {
    const { name, min, max } = FIELD_BOUNDS[i];
    const raw = parts[i];

    // Reject sub-minute step shorthand on the minute field. Vercel Cron
    // fires at minute resolution at best, so `*/0` and any `*/n` with
    // n < 1 (or fractional) would imply >1 fire/minute.
    if (i === 0 && raw.startsWith('*/')) {
      const step = Number(raw.slice(2));
      if (!Number.isFinite(step) || step < 1 || !Number.isInteger(step)) {
        throw new Error(
          `CronTrigger: minute step "${raw}" would fire more than once per minute (Vercel Cron limit).`,
        );
      }
    }

    result[name] = expandField(raw, min, max, name);
  }
  return result as ParsedCron;
}

/** Expand a single cron field into the explicit integer set (or null for `*`). */
function expandField(
  raw: string,
  min: number,
  max: number,
  fieldName: string,
): number[] | null {
  if (raw === '*') return null;

  const values = new Set<number>();
  for (const chunk of raw.split(',')) {
    // Step form: `*/n` or `a-b/n` or `a/n`.
    let rangePart = chunk;
    let step = 1;
    const slashIdx = chunk.indexOf('/');
    if (slashIdx !== -1) {
      rangePart = chunk.slice(0, slashIdx);
      const stepStr = chunk.slice(slashIdx + 1);
      step = Number(stepStr);
      if (!Number.isFinite(step) || step < 1 || !Number.isInteger(step)) {
        throw new Error(
          `CronTrigger: invalid step "${stepStr}" in field "${fieldName}".`,
        );
      }
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
        // When step is present without a range (e.g. `5/15`), n8n/Vercel
        // interpret `lo` as the start and `hi` as the field max.
        hi = slashIdx === -1 ? lo : max;
      }
    }

    if (
      !Number.isFinite(lo) ||
      !Number.isFinite(hi) ||
      !Number.isInteger(lo) ||
      !Number.isInteger(hi) ||
      lo < min ||
      hi > max ||
      lo > hi
    ) {
      throw new Error(
        `CronTrigger: field "${fieldName}" range "${chunk}" is out of bounds [${min}–${max}].`,
      );
    }

    for (let v = lo; v <= hi; v += step) values.add(v);
  }

  return Array.from(values).sort((a, b) => a - b);
}

/** True when `date` (UTC) is matched by the parsed expression. */
function matchesCron(parsed: ParsedCron, date: Date): boolean {
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const dom = date.getUTCDate();
  // JS getUTCMonth() is 0-based; cron is 1-based.
  const month = date.getUTCMonth() + 1;
  // JS getUTCDay() returns 0=Sunday, matches cron.
  const dow = date.getUTCDay();

  const fieldMatches = (field: number[] | null, value: number): boolean =>
    field === null || field.includes(value);

  if (!fieldMatches(parsed.minute, minute)) return false;
  if (!fieldMatches(parsed.hour, hour)) return false;
  if (!fieldMatches(parsed.month, month)) return false;

  // Cron's "OR" semantics: when both dayOfMonth AND dayOfWeek are
  // restricted, a match in either is sufficient. When one is `*`, the
  // other governs alone.
  const domRestricted = parsed.dayOfMonth !== null;
  const dowRestricted = parsed.dayOfWeek !== null;
  const domOk = fieldMatches(parsed.dayOfMonth, dom);
  const dowOk = fieldMatches(parsed.dayOfWeek, dow);

  if (domRestricted && dowRestricted) return domOk || dowOk;
  return domOk && dowOk;
}

// ─── triggerTimes → cron expression conversion ──────────────────────────────

function clamp(v: number | undefined, min: number, max: number, dflt: number): number {
  const n = v ?? dflt;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(
      `CronTrigger: value ${v} is outside [${min}–${max}].`,
    );
  }
  return n;
}

function triggerTimeToCron(t: CronTriggerTime): string {
  switch (t.mode) {
    case 'everyMinute':
      return '* * * * *';
    case 'everyHour': {
      const minute = clamp(t.minute, 0, 59, 0);
      return `${minute} * * * *`;
    }
    case 'everyDay': {
      const minute = clamp(t.minute, 0, 59, 0);
      const hour = clamp(t.hour, 0, 23, 0);
      return `${minute} ${hour} * * *`;
    }
    case 'everyWeek': {
      const minute = clamp(t.minute, 0, 59, 0);
      const hour = clamp(t.hour, 0, 23, 0);
      const weekday = clamp(t.weekday, 0, 6, 1);
      return `${minute} ${hour} * * ${weekday}`;
    }
    case 'everyMonth': {
      const minute = clamp(t.minute, 0, 59, 0);
      const hour = clamp(t.hour, 0, 23, 0);
      const dom = clamp(t.dayOfMonth, 1, 31, 1);
      return `${minute} ${hour} ${dom} * *`;
    }
    case 'cronExpression': {
      if (!t.expression || typeof t.expression !== 'string') {
        throw new Error('CronTrigger: cronExpression mode requires `expression`.');
      }
      // Validate by parsing — also enforces the once-per-minute floor.
      parseCronExpression(t.expression);
      return t.expression.trim().replace(/\s+/g, ' ');
    }
    default: {
      const _exhaustive: never = t.mode;
      throw new Error(`CronTrigger: unknown mode "${_exhaustive}".`);
    }
  }
}

/**
 * Convert a CronTrigger node's `triggerTimes` parameter into the array of
 * 5-field cron expressions Vercel Cron should be registered against. Used
 * by Phase 6 #2 (the `/api/cron/sabflow-scheduled` handler) to know which
 * minute(s) should dispatch the workflow.
 *
 * Duplicates are deduped so we don't double-fire when the editor lets a
 * user add the same row twice.
 */
export function cronExpressionsForNode(params: CronTriggerParameters): string[] {
  if (!params || !Array.isArray(params.triggerTimes) || params.triggerTimes.length === 0) {
    throw new Error('CronTrigger: at least one triggerTimes entry is required.');
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of params.triggerTimes) {
    const expr = triggerTimeToCron(t);
    if (!seen.has(expr)) {
      seen.add(expr);
      out.push(expr);
    }
  }
  return out;
}

// ─── Editor-side preview: next N fire times ─────────────────────────────────

const ONE_MINUTE_MS = 60_000;
// Hard ceiling so a pathological "Feb 29 + Sunday" combo can't loop forever.
const MAX_SEARCH_MINUTES = 60 * 24 * 366 * 4;

/**
 * Compute the next `count` UTC fire times across the union of `expressions`
 * strictly after `after`. Used by the editor's CronTrigger preview panel.
 *
 * Naive minute-step scan — fine for editor previews (the upper bound is
 * `count * stepCost`, and `count` defaults to 5).
 */
export function nextFireTimes(
  expressions: string[],
  after: Date,
  count = 5,
): Date[] {
  if (!Array.isArray(expressions) || expressions.length === 0) return [];
  if (!(after instanceof Date) || Number.isNaN(after.getTime())) {
    throw new Error('CronTrigger.nextFireTimes: `after` must be a valid Date.');
  }
  if (!Number.isInteger(count) || count < 1) return [];

  const parsed = expressions.map(parseCronExpression);
  const results: Date[] = [];

  // Start at the next whole minute after `after`.
  const start = new Date(after.getTime());
  start.setUTCSeconds(0, 0);
  let cursor = start.getTime() + ONE_MINUTE_MS;

  for (let i = 0; i < MAX_SEARCH_MINUTES && results.length < count; i++) {
    const candidate = new Date(cursor);
    for (const p of parsed) {
      if (matchesCron(p, candidate)) {
        results.push(candidate);
        break;
      }
    }
    cursor += ONE_MINUTE_MS;
  }

  return results;
}

// ─── NodeRegistration ───────────────────────────────────────────────────────

/**
 * Pull the `{ scheduledFor, fireKey }` payload that the Vercel Cron
 * dispatcher injects via a synthetic node parameter.
 *
 * The handler at `/api/cron/sabflow-scheduled` calls
 * `ctx.getNodeParameter("__fire", 0)` substitution via the workflow run's
 * static parameter map. We accept the object form here, and fall back to
 * a manual-test default so the node is still runnable from the editor
 * "Test step" button.
 */
function resolveFirePayload(ctx: NodeExecutionContext): CronFirePayload {
  const raw = ctx.getNodeParameter<CronFirePayload | undefined>('__fire', 0, undefined);
  if (
    raw &&
    typeof raw === 'object' &&
    typeof raw.scheduledFor === 'string' &&
    typeof raw.fireKey === 'string'
  ) {
    return raw;
  }
  // Editor "Test step" path: synthesise the current minute so downstream
  // nodes see a realistic payload.
  const now = new Date();
  now.setUTCSeconds(0, 0);
  const scheduledFor = now.toISOString();
  return {
    scheduledFor,
    fireKey: `manual:${scheduledFor}`,
  };
}

async function execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
  const fire = resolveFirePayload(ctx);
  const item: NodeExecutionItem = {
    json: {
      scheduledFor: fire.scheduledFor,
      fireKey: fire.fireKey,
    },
  };
  return { output: [[item]] };
}

export const cronTriggerNode: NodeRegistration = {
  type: 'SabFlow.CronTrigger',
  typeVersion: 1,
  description:
    'Fire the workflow on a periodic schedule. Backed by Vercel Cron; ' +
    'each entry expands to a single 5-field cron expression.',
  defaults: {
    name: 'Cron Trigger',
    color: '#56a5ff',
  },
  properties: [
    {
      displayName: 'Trigger Times',
      name: 'triggerTimes',
      type: 'fixedCollection',
      // The shape is enforced by `CronTriggerTime`; the editor renders one
      // row per entry with mode-specific sub-fields.
      default: { triggerTimes: [{ mode: 'everyDay', hour: 0, minute: 0 }] },
      required: true,
      description:
        'One or more periodic triggers. Each row becomes a Vercel Cron entry ' +
        'when the workflow is activated. Sub-minute schedules are rejected ' +
        'because Vercel Cron fires at minute resolution.',
      noDataExpression: true,
    },
  ],
  execute,
};

export default cronTriggerNode;
