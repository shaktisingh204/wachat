/**
 * SabCRM Forecast — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type the forecast action surfaces to its (client) callers lives in this
 * plain sibling module. Importing it has no runtime cost.
 *
 * ## Forecast math (as implemented in `sabcrm-forecast.actions.ts`)
 *
 * - **Weighted forecast** = `sum(amount × probability / 100)` over the OPEN
 *   leads of one pipeline (stage kind ≠ won/lost), bucketed by close-date
 *   period; plus **won-so-far** per period.
 * - **Stage probability** comes from the pipeline stage's `probability`
 *   governance key (0–100, clamped). When unset, the default is:
 *     - `won` stages → 100, `lost` stages → 0;
 *     - open stages → a **position-based linear ramp**: among the pipeline's
 *       `n` ordered open stages, the `i`-th (0-based) gets
 *       `((i + 1) / (n + 1)) × 100` — early stages low, late stages high,
 *       never 0 or 100.
 * - **Close-date bucketing** uses `data.closeDate ?? data.expectedCloseDate`
 *   (UTC). Open deals with a close date BEFORE the current period are folded
 *   into the current period (overdue ≈ "should close now"); deals with no /
 *   invalid close date land in the `unscheduled` bucket.
 */

export type {
  SabcrmQuotaMetric,
  SabcrmQuotaPeriod,
} from '@/lib/rust-client/sabcrm-targets';
export type { SabcrmStageKind } from '@/lib/rust-client/sabcrm-pipelines';

/** Period granularity of the forecast series. */
export type SabcrmForecastPeriodKind = 'month' | 'quarter';

/** Options accepted by `computeSabcrmForecast`. */
export interface SabcrmForecastOpts {
  /** Pipeline to forecast. Absent → the project's default (or first). */
  pipelineId?: string;
  /** Series granularity. Defaults to `'month'`. */
  period?: SabcrmForecastPeriodKind;
  /**
   * How many periods to project, starting at the current one. Defaults to
   * 6 months / 4 quarters; clamped to 1–12.
   */
  horizon?: number;
}

/** Per-stage breakdown row (drives the weighted-by-stage bar chart). */
export interface SabcrmForecastStageRow {
  stageId: string;
  label: string;
  color?: string;
  /** Resolved classification (explicit `kind` or label heuristic). */
  kind: 'open' | 'won' | 'lost';
  /** Effective probability (%) used for weighting. */
  probabilityPct: number;
  /** Where the probability came from. */
  probabilitySource: 'stage' | 'default';
  /** Open records currently in this stage. */
  count: number;
  /** Unweighted amount sum across those records. */
  amount: number;
  /** `amount × probabilityPct / 100`. */
  weighted: number;
}

/**
 * Salesforce-style forecast category. Open deals fall into Pipeline / Best
 * case / Commit (by a per-record `data.forecastCategory` override, else the
 * stage probability band); won deals are Closed; Omit is excluded from the
 * forecast. Categories are CUMULATIVE: Commit ⊆ Best case ⊆ Pipeline, with
 * Closed always added in.
 */
export type SabcrmForecastCategory =
  | 'PIPELINE'
  | 'BEST_CASE'
  | 'COMMIT'
  | 'CLOSED'
  | 'OMIT';

/** Per-category breakdown row (drives the forecast-category tiles + bar). */
export interface SabcrmForecastCategoryRow {
  category: SabcrmForecastCategory;
  label: string;
  /** `--st-*` token / hex for the tile + bar segment. */
  color?: string;
  /** Records in this category. */
  count: number;
  /** Unweighted amount sum in this category. */
  amount: number;
}

/** One period of the forecast series (oldest → newest). */
export interface SabcrmForecastPeriodRow {
  /** Stable bucket key — `YYYY-MM` (month) or `YYYY-Qn` (quarter). */
  key: string;
  /** Display label — `Jun 2026` / `Q3 2026`. */
  label: string;
  /** First day of the period, `YYYY-MM-DD`. */
  start: string;
  /** Open records whose close date falls in this period. */
  openCount: number;
  /** Unweighted open amount in this period. */
  openAmount: number;
  /** Probability-weighted open amount in this period. */
  weighted: number;
  /** Amount already won (closed) in this period. */
  won: number;
  /** Count of deals won in this period. */
  wonCount: number;
  /** `won + weighted` — the period's expected total. */
  forecast: number;
}

/** Bucket for open deals with no / invalid close date. */
export interface SabcrmForecastUnscheduled {
  count: number;
  amount: number;
  weighted: number;
}

/** Grand totals across the whole open pipeline + the horizon's won deals. */
export interface SabcrmForecastTotals {
  openCount: number;
  openAmount: number;
  /** Probability-weighted value of the ENTIRE open pipeline. */
  weightedPipeline: number;
  /** Won amount inside the horizon. */
  wonAmount: number;
  wonCount: number;
  /** Cumulative forecast — won + commit-category amount. */
  commit: number;
  /** Cumulative forecast — won + commit + best-case amount. */
  bestCase: number;
  /** Cumulative forecast — won + commit + best-case + pipeline amount. */
  pipeline: number;
  /** commit + manager adjustments (present when any adjustment exists). */
  adjustedCommit?: number;
  /** bestCase + manager adjustments. */
  adjustedBestCase?: number;
  /** pipeline + manager adjustments. */
  adjustedPipeline?: number;
}

/** A manager forecast adjustment applied as an overlay (see forecast-adjustments.server). */
export interface SabcrmForecastAdjustment {
  id: string;
  pipelineId: string;
  periodStart: string;
  category: 'commit' | 'bestCase' | 'pipeline';
  amount: number;
  note?: string;
}

/** Result of `computeSabcrmForecast`. */
export interface SabcrmForecastResult {
  pipelineId: string;
  pipelineName: string;
  /** Object slug the pipeline targets (normally `leads`). */
  object: string;
  periodKind: SabcrmForecastPeriodKind;
  periods: SabcrmForecastPeriodRow[];
  byStage: SabcrmForecastStageRow[];
  /** Forecast-category breakdown (Pipeline / Best case / Commit / Closed / Omit). */
  byCategory: SabcrmForecastCategoryRow[];
  /** Manager adjustments applied to this pipeline's forecast (overlay). */
  adjustments: SabcrmForecastAdjustment[];
  unscheduled: SabcrmForecastUnscheduled;
  totals: SabcrmForecastTotals;
  /** True when the record cap was hit and numbers may undercount. */
  truncated: boolean;
}
