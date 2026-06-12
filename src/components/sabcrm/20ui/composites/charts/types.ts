/**
 * 20ui · charts composites — shared data shapes.
 *
 * Every chart composite in this folder takes plain, generic data props (no
 * server calls, no fetching): callers map their domain results into
 * `{ label, value }` rows and hand them over.
 */

/** One categorical datum (a bar, a slice, a point). */
export interface ChartDatum {
  label: string;
  value: number;
  /** Optional explicit color (CSS value). Falls back to CHART_PALETTE. */
  color?: string;
}

/** One ordered funnel stage (top-of-funnel first). */
export interface FunnelStage {
  /** Stable key for React; falls back to the label. */
  key?: string;
  label: string;
  /** Numeric weight that drives band width + conversion %. */
  value: number;
  /** Pre-formatted value for display (e.g. "$1.2M"); falls back to the number. */
  display?: string;
}

/** Compact default number formatter shared by the chart composites. */
export function formatChartNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}
