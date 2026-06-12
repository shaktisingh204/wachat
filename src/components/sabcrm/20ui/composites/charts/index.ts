/**
 * 20ui · charts composites — local barrel.
 *
 * The ONE chart kit for SabCRM surfaces. Generic data props only (arrays of
 * `{ label, value }`-ish rows) — no server calls; callers fetch + map.
 * Built on the 20ui chart primitives (`../../chart`) + recharts, tokens only.
 *
 * Supersedes the legacy duplicated stacks:
 *   - `components/sabcrm/twenty/twenty-charts.tsx`
 *   - `components/sabcrm/charts/funnel-chart.tsx`
 *   - `app/sabcrm/dashboard/dashboard-charts.tsx`
 */

export { formatChartNumber, type ChartDatum, type FunnelStage } from './types';
export { Sparkline, type SparklineProps } from './sparkline';
export { KpiCard, type KpiCardProps, type KpiDeltaTone } from './kpi-card';
export { BarChart, type BarChartProps } from './bar';
export { LineChart, type LineChartProps } from './line';
export { DonutChart, type DonutChartProps } from './donut';
export { FunnelChart, type FunnelChartProps } from './funnel';
