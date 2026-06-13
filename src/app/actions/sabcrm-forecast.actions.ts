'use server';

/**
 * SabCRM — weighted-forecast server action.
 *
 * Pure-TS computation over the existing gated record/pipeline actions — NO
 * new Rust surface. Powers `/sabcrm/forecast`:
 *
 *   1. resolve the pipeline (explicit id → `isDefault` → first);
 *   2. classify its stages (explicit `kind` governance, label heuristic
 *      fallback) and resolve each stage's win probability — the stage's
 *      `probability` governance key (0–100, clamped) or the documented
 *      default (won = 100, lost = 0, open = position-based linear ramp:
 *      the `i`-th of `n` open stages gets `((i + 1) / (n + 1)) × 100`);
 *   3. load the pipeline's OPEN leads (stage ∈ open stages) and its WON
 *      leads through {@link listSabcrmRecordsTw} (each page re-runs the
 *      full session → project → RBAC → plan gate; reads are request-cached);
 *   4. weight every open lead `amount × probability / 100`, bucket by
 *      close-date period (`data.closeDate ?? data.expectedCloseDate`, UTC;
 *      overdue → current period; missing/invalid → `unscheduled`), bucket
 *      won leads the same way, and return the per-period + per-stage series
 *      for charting.
 *
 * Gate recipe is copied from the sibling `sabcrm-targets.actions.ts`
 * (session → project → RBAC → plan), and the action degrades to
 * `{ ok: false, error }` when the Rust engine is down.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmPipelinesApi } from '@/lib/rust-client/sabcrm-pipelines';
import type {
  SabcrmRustPipeline,
  SabcrmRustPipelineStage,
} from '@/lib/rust-client/sabcrm-pipelines';
import type { SabcrmRustRecord } from '@/lib/rust-client/sabcrm-records';
import type { ActionResult } from '@/lib/sabcrm/types';
import { listSabcrmRecordsTw } from './sabcrm-twenty.actions';
import type {
  SabcrmForecastOpts,
  SabcrmForecastPeriodKind,
  SabcrmForecastPeriodRow,
  SabcrmForecastResult,
  SabcrmForecastStageRow,
  SabcrmForecastCategory,
  SabcrmForecastCategoryRow,
} from './sabcrm-forecast.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Page size used while draining records from the engine. */
const PAGE_LIMIT = 500;

/** Hard cap on records loaded per bucket (open / won) — keeps the action
 * bounded on huge pipelines; `truncated: true` is surfaced when hit. */
const RECORD_CAP = 2000;

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate (copied from sabcrm-targets.actions.ts)
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline, including the
 * cross-tenant defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user.
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Stage classification + probability
// ---------------------------------------------------------------------------

type ResolvedKind = 'open' | 'won' | 'lost';

/**
 * Resolves a stage's classification: the explicit `kind` governance key when
 * valid, otherwise a label heuristic for legacy pipelines (`won`/`customer`
 * → won, `lost` → lost, anything else → open).
 */
function resolveStageKind(stage: SabcrmRustPipelineStage): ResolvedKind {
  if (stage.kind === 'open' || stage.kind === 'won' || stage.kind === 'lost') {
    return stage.kind;
  }
  const label = (stage.label ?? stage.id ?? '').toLowerCase();
  if (/\bwon\b|customer/.test(label)) return 'won';
  if (/\blost\b/.test(label)) return 'lost';
  return 'open';
}

/** Clamp a number into [0, 100]. */
function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

interface StageMeta {
  stage: SabcrmRustPipelineStage;
  kind: ResolvedKind;
  probabilityPct: number;
  probabilitySource: 'stage' | 'default';
}

/**
 * Resolves every stage's effective win probability.
 *
 * Explicit `probability` (0–100, clamped) wins. Defaults when unset:
 * won → 100, lost → 0, and open stages get a **position-based linear
 * ramp** — among the pipeline's `n` ordered open stages, the `i`-th
 * (0-based) gets `((i + 1) / (n + 1)) × 100`, so early stages weigh low,
 * late stages high, and the default never hits 0 or 100.
 */
function resolveStageMetas(stages: SabcrmRustPipelineStage[]): StageMeta[] {
  const kinds = stages.map(resolveStageKind);
  const openCount = kinds.filter((k) => k === 'open').length;
  let openIndex = 0;

  return stages.map((stage, i) => {
    const kind = kinds[i];
    const position = kind === 'open' ? openIndex++ : 0;

    if (typeof stage.probability === 'number') {
      return {
        stage,
        kind,
        probabilityPct: clampPct(stage.probability),
        probabilitySource: 'stage' as const,
      };
    }

    let pct: number;
    if (kind === 'won') pct = 100;
    else if (kind === 'lost') pct = 0;
    else pct = ((position + 1) / (openCount + 1)) * 100;

    return {
      stage,
      kind,
      probabilityPct: Math.round(pct * 10) / 10,
      probabilitySource: 'default' as const,
    };
  });
}

// ---------------------------------------------------------------------------
// Forecast categories (Pipeline / Best case / Commit / Closed / Omit)
// ---------------------------------------------------------------------------

/** Display metadata + render order for the five forecast categories. */
const CATEGORY_META: Record<
  SabcrmForecastCategory,
  { label: string; color: string }
> = {
  PIPELINE: { label: 'Pipeline', color: 'var(--st-text-secondary)' },
  BEST_CASE: { label: 'Best case', color: 'var(--st-info, #38bdf8)' },
  COMMIT: { label: 'Commit', color: 'var(--st-accent)' },
  CLOSED: { label: 'Closed', color: 'var(--st-success, #22c55e)' },
  OMIT: { label: 'Omit', color: 'var(--st-danger, #ef4444)' },
};

const CATEGORY_ORDER: SabcrmForecastCategory[] = [
  'PIPELINE',
  'BEST_CASE',
  'COMMIT',
  'CLOSED',
  'OMIT',
];

const VALID_CATEGORIES: ReadonlySet<string> = new Set(CATEGORY_ORDER);

/**
 * Default forecast category for an open stage from its resolved probability:
 * won → Closed, lost → Omit, ≥80% → Commit, ≥50% → Best case, else Pipeline.
 */
function defaultCategoryFor(meta: StageMeta): SabcrmForecastCategory {
  if (meta.kind === 'won') return 'CLOSED';
  if (meta.kind === 'lost') return 'OMIT';
  if (meta.probabilityPct >= 80) return 'COMMIT';
  if (meta.probabilityPct >= 50) return 'BEST_CASE';
  return 'PIPELINE';
}

/**
 * A record's forecast category: the per-record `data.forecastCategory`
 * override when it is one of the five valid values (forward-compatible — takes
 * effect the moment the optional SELECT field is added to the object),
 * otherwise the stage default.
 */
function recordCategory(
  record: SabcrmRustRecord,
  fallback: SabcrmForecastCategory,
): SabcrmForecastCategory {
  const raw = record.data?.forecastCategory;
  if (typeof raw === 'string' && VALID_CATEGORIES.has(raw)) {
    return raw as SabcrmForecastCategory;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Record field coercion
// ---------------------------------------------------------------------------

/**
 * Coerces a record's amount value to a number. Tolerates plain numbers,
 * numeric strings and Twenty-style CURRENCY objects (`{ amountMicros }`).
 */
function coerceAmount(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.amountMicros === 'number' && Number.isFinite(o.amountMicros)) {
      return o.amountMicros / 1_000_000;
    }
    if (typeof o.amount === 'number' && Number.isFinite(o.amount)) {
      return o.amount;
    }
  }
  return 0;
}

/** `data.closeDate ?? data.expectedCloseDate` parsed as a Date, or null. */
function recordCloseDate(record: SabcrmRustRecord): Date | null {
  const raw = record.data?.closeDate ?? record.data?.expectedCloseDate;
  if (typeof raw !== 'string' || !raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Stringified `data.stage` of a record (numeric ids tolerated). */
function recordStageId(record: SabcrmRustRecord): string {
  const raw = record.data?.stage;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  return '';
}

// ---------------------------------------------------------------------------
// Period math (UTC, dependency-free)
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** First UTC day of the period containing `d`. */
function periodStartOf(d: Date, kind: SabcrmForecastPeriodKind): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const startMonth = kind === 'quarter' ? Math.floor(m / 3) * 3 : m;
  return new Date(Date.UTC(y, startMonth, 1));
}

/** Advance a period start by `n` periods. */
function addPeriods(
  start: Date,
  kind: SabcrmForecastPeriodKind,
  n: number,
): Date {
  const step = kind === 'quarter' ? 3 : 1;
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n * step, 1),
  );
}

/** Stable bucket key — `YYYY-MM` (month) or `YYYY-Qn` (quarter). */
function periodKeyOf(d: Date, kind: SabcrmForecastPeriodKind): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (kind === 'quarter') return `${y}-Q${Math.floor(m / 3) + 1}`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Display label — `Jun 2026` / `Q3 2026`. */
function periodLabelOf(start: Date, kind: SabcrmForecastPeriodKind): string {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  if (kind === 'quarter') return `Q${Math.floor(m / 3) + 1} ${y}`;
  return `${MONTH_NAMES[m]} ${y}`;
}

/** `YYYY-MM-DD` of a UTC date. */
function isoDayOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Record loading
// ---------------------------------------------------------------------------

/**
 * Drains the records of `object` whose `data.stage` is one of `stageIds`,
 * paging through {@link listSabcrmRecordsTw} until done or {@link RECORD_CAP}.
 */
async function loadRecordsByStages(
  object: string,
  stageIds: string[],
  projectId: string,
): Promise<{ records: SabcrmRustRecord[]; truncated: boolean }> {
  if (stageIds.length === 0) return { records: [], truncated: false };

  const records: SabcrmRustRecord[] = [];
  let page = 1;
  for (;;) {
    const res = await listSabcrmRecordsTw(
      object,
      {
        filters: { stage: { op: 'in', value: stageIds } },
        page,
        limit: PAGE_LIMIT,
        sortBy: 'closeDate',
        sortDir: 'asc',
      },
      projectId,
    );
    if (!res.ok) throw new Error(res.error);

    records.push(...res.data.records);
    if (records.length >= RECORD_CAP) {
      return { records: records.slice(0, RECORD_CAP), truncated: true };
    }
    if (
      res.data.records.length < PAGE_LIMIT ||
      records.length >= res.data.total
    ) {
      return { records, truncated: false };
    }
    page += 1;
  }
}

// ---------------------------------------------------------------------------
// computeSabcrmForecast
// ---------------------------------------------------------------------------

/**
 * Computes the weighted sales forecast for one pipeline.
 *
 * See the module doc + `sabcrm-forecast.actions.types.ts` for the math
 * (probability resolution, close-date bucketing, overdue folding).
 */
export async function computeSabcrmForecast(
  opts: SabcrmForecastOpts = {},
  projectId?: string,
): Promise<ActionResult<SabcrmForecastResult>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const periodKind: SabcrmForecastPeriodKind =
    opts.period === 'quarter' ? 'quarter' : 'month';
  const horizon = Math.min(
    12,
    Math.max(1, opts.horizon ?? (periodKind === 'quarter' ? 4 : 6)),
  );

  try {
    // 1. resolve the pipeline: explicit id → isDefault → first.
    const pipelines = await sabcrmPipelinesApi.list(g.ctx.projectId);
    const pipeline: SabcrmRustPipeline | undefined = opts.pipelineId
      ? pipelines.find((p) => p.id === opts.pipelineId)
      : (pipelines.find((p) => p.isDefault) ?? pipelines[0]);
    if (!pipeline) {
      return { ok: false, error: 'No pipeline found for this project.' };
    }

    // 2. classify stages + resolve probabilities.
    const metas = resolveStageMetas(pipeline.stages ?? []);
    const metaByStageId = new Map(metas.map((m) => [String(m.stage.id), m]));
    const openStageIds = metas
      .filter((m) => m.kind === 'open')
      .map((m) => String(m.stage.id));
    const wonStageIds = metas
      .filter((m) => m.kind === 'won')
      .map((m) => String(m.stage.id));

    // 3. load open + won records (paged, capped).
    const [open, won] = await Promise.all([
      loadRecordsByStages(pipeline.object, openStageIds, g.ctx.projectId),
      loadRecordsByStages(pipeline.object, wonStageIds, g.ctx.projectId),
    ]);

    // 4. build the period horizon, starting at the current period.
    const now = new Date();
    const horizonStart = periodStartOf(now, periodKind);
    const periods: SabcrmForecastPeriodRow[] = [];
    const periodIndexByKey = new Map<string, number>();
    for (let i = 0; i < horizon; i++) {
      const start = addPeriods(horizonStart, periodKind, i);
      const key = periodKeyOf(start, periodKind);
      periodIndexByKey.set(key, i);
      periods.push({
        key,
        label: periodLabelOf(start, periodKind),
        start: isoDayOf(start),
        openCount: 0,
        openAmount: 0,
        weighted: 0,
        won: 0,
        wonCount: 0,
        forecast: 0,
      });
    }

    // 5. per-stage rollup + per-period open buckets.
    const stageRows = new Map<string, SabcrmForecastStageRow>();
    for (const m of metas) {
      if (m.kind !== 'open') continue;
      stageRows.set(String(m.stage.id), {
        stageId: String(m.stage.id),
        label: m.stage.label || String(m.stage.id),
        color: m.stage.color,
        kind: m.kind,
        probabilityPct: m.probabilityPct,
        probabilitySource: m.probabilitySource,
        count: 0,
        amount: 0,
        weighted: 0,
      });
    }

    const unscheduled = { count: 0, amount: 0, weighted: 0 };
    let openCount = 0;
    let openAmount = 0;
    let weightedPipeline = 0;

    // Forecast-category buckets (Pipeline / Best case / Commit / Closed / Omit).
    const catBuckets: Record<
      SabcrmForecastCategory,
      { count: number; amount: number }
    > = {
      PIPELINE: { count: 0, amount: 0 },
      BEST_CASE: { count: 0, amount: 0 },
      COMMIT: { count: 0, amount: 0 },
      CLOSED: { count: 0, amount: 0 },
      OMIT: { count: 0, amount: 0 },
    };

    for (const record of open.records) {
      const stageId = recordStageId(record);
      const meta = metaByStageId.get(stageId);
      if (!meta || meta.kind !== 'open') continue; // stale stage value

      const amount = coerceAmount(record.data?.amount);
      const weighted = (amount * meta.probabilityPct) / 100;

      openCount += 1;
      openAmount += amount;
      weightedPipeline += weighted;

      const cat = recordCategory(record, defaultCategoryFor(meta));
      catBuckets[cat].count += 1;
      catBuckets[cat].amount += amount;

      const row = stageRows.get(stageId);
      if (row) {
        row.count += 1;
        row.amount += amount;
        row.weighted += weighted;
      }

      const close = recordCloseDate(record);
      if (!close) {
        unscheduled.count += 1;
        unscheduled.amount += amount;
        unscheduled.weighted += weighted;
        continue;
      }
      // Overdue open deals fold into the current period.
      const effective = close < horizonStart ? horizonStart : close;
      const idx = periodIndexByKey.get(periodKeyOf(effective, periodKind));
      if (idx === undefined) {
        // Beyond the horizon — counted in totals, not in a period row.
        continue;
      }
      const period = periods[idx];
      period.openCount += 1;
      period.openAmount += amount;
      period.weighted += weighted;
    }

    // 6. won-so-far per period (by close date; outside-horizon drops).
    let wonAmount = 0;
    let wonCount = 0;
    for (const record of won.records) {
      const close = recordCloseDate(record);
      if (!close) continue;
      const idx = periodIndexByKey.get(periodKeyOf(close, periodKind));
      if (idx === undefined) continue;
      const amount = coerceAmount(record.data?.amount);
      const period = periods[idx];
      period.won += amount;
      period.wonCount += 1;
      wonAmount += amount;
      wonCount += 1;

      const cat = recordCategory(record, 'CLOSED');
      catBuckets[cat].count += 1;
      catBuckets[cat].amount += amount;
    }

    for (const period of periods) {
      period.forecast = period.won + period.weighted;
    }

    // Forecast-category breakdown + cumulative rollup (Commit ⊆ Best case ⊆
    // Pipeline, with Closed always added in; Omit excluded).
    const byCategory: SabcrmForecastCategoryRow[] = CATEGORY_ORDER.map((c) => ({
      category: c,
      label: CATEGORY_META[c].label,
      color: CATEGORY_META[c].color,
      count: catBuckets[c].count,
      amount: catBuckets[c].amount,
    }));
    const commit = catBuckets.CLOSED.amount + catBuckets.COMMIT.amount;
    const bestCase = commit + catBuckets.BEST_CASE.amount;
    const pipelineForecast = bestCase + catBuckets.PIPELINE.amount;

    return {
      ok: true,
      data: {
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        object: pipeline.object,
        periodKind,
        periods,
        byStage: [...stageRows.values()],
        byCategory,
        unscheduled,
        totals: {
          openCount,
          openAmount,
          weightedPipeline,
          wonAmount,
          wonCount,
          commit,
          bestCase,
          pipeline: pipelineForecast,
        },
        truncated: open.truncated || won.truncated,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute the forecast.');
  }
}
