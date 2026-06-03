"use client";

/**
 * SabCRM — CrmBarChart
 *
 * A production-grade bar chart for `countByField` and `sumByField` analytics
 * series. Accepts pre-fetched buckets (from `runAnalyticsAction`) and renders
 * them using the ZoruUI chart primitives (ZoruChartContainer + ZoruChartTooltip)
 * which delegate to Recharts under the hood.
 *
 * Design constraints
 * ------------------
 * - B&W palette only — `ZORU_CHART_PALETTE` provides the fill progression, no hues.
 * - ZoruUI tokens for all spacing / radius / typography — no raw Tailwind colour
 *   classes (e.g. `bg-blue-*`).
 * - The component owns no data-fetching state. The caller fetches via
 *   `runAnalyticsAction` and passes the result as a typed prop; this keeps the
 *   component serialisation-safe across the RSC → Client boundary.
 * - Empty / loading / error states are rendered inline rather than throwing.
 * - Fully accessible: the bar chart has `role="img"` with an `aria-label`
 *   derived from the series configuration, plus a visually-hidden data table
 *   fallback for screen readers and keyboard navigation.
 *
 * Usage — countByField series
 * ---------------------------
 * ```tsx
 * import { CrmBarChart } from "@/components/sabcrm/charts/bar-chart";
 * import type { CountByFieldResult } from "@/app/actions/sabcrm.actions";
 *
 * // Server component or useEffect / SWR call:
 * const res = await runAnalyticsAction({ kind: "countByField", object: "opportunities", fieldKey: "stage" });
 * if (res.ok) {
 *   return <CrmBarChart series={{ kind: "countByField", result: res.data }} title="Opportunities by Stage" />;
 * }
 * ```
 *
 * Usage — sumByField series
 * -------------------------
 * ```tsx
 * import { CrmBarChart } from "@/components/sabcrm/charts/bar-chart";
 * import type { SumByFieldResult } from "@/app/actions/sabcrm.actions";
 *
 * const res = await runAnalyticsAction({ kind: "sumByField", object: "opportunities", groupFieldKey: "stage", sumFieldKey: "amount" });
 * if (res.ok) {
 *   return <CrmBarChart series={{ kind: "sumByField", result: res.data }} title="Pipeline by Stage" formatValue={(v) => `$${v.toLocaleString()}`} />;
 * }
 * ```
 */

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import {
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  cn,
  Skeleton,
} from "@/components/zoruui";
import type {
  CountByFieldResult,
  SumByFieldResult,
} from "@/app/actions/sabcrm.actions.types";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** A countByField result paired with its kind tag. */
export interface CrmCountSeries {
  kind: "countByField";
  result: CountByFieldResult;
}

/** A sumByField result paired with its kind tag. */
export interface CrmSumSeries {
  kind: "sumByField";
  result: SumByFieldResult;
}

/** Discriminated union of the two supported series shapes. */
export type CrmBarSeries = CrmCountSeries | CrmSumSeries;

/** Props accepted by the CrmBarChart component. */
export interface CrmBarChartProps {
  /**
   * Pre-fetched analytics result. The discriminated `kind` tag determines
   * which bucket shape is used and how axis labels / tooltip values are built.
   */
  series: CrmBarSeries;

  /**
   * Human-readable chart title. Renders above the chart inside a Card header
   * and doubles as the `aria-label` for screen readers.
   */
  title?: string;

  /**
   * Optional one-line description shown under the title (e.g. "by stage",
   * "last 30 days"). Not rendered when absent.
   */
  description?: string;

  /**
   * Chart height in pixels. Defaults to 280.
   *
   * Pass a number; the container handles responsive width automatically via
   * `ZoruChartContainer` / `ResponsiveContainer`.
   */
  height?: number;

  /**
   * Optional value formatter applied in the Y-axis tick and tooltip value.
   * Use this to add currency symbols, thousands separators, units, etc.
   *
   * @example (v) => `$${v.toLocaleString()}`
   * @example (v) => `${v}%`
   */
  formatValue?: (value: number) => string;

  /**
   * Maximum number of buckets shown. Remaining buckets are summarised as a
   * single "(other)" bar. Defaults to 10.
   *
   * The data is already sorted descending by the analytics layer (count or
   * sum), so the top-N bars are always the most significant.
   */
  maxBars?: number;

  /** Additional class name applied to the outer Card wrapper. */
  className?: string;

  /**
   * Show the chart in a loading skeleton state. Useful while the parent
   * component is waiting for the server action to resolve.
   */
  loading?: boolean;

  /**
   * Error message to display instead of the chart. Rendering an error inline
   * (rather than throwing) keeps the surrounding dashboard stable.
   */
  error?: string;

  /**
   * Orientation of the bars. `vertical` (default) draws bars growing upward;
   * `horizontal` draws bars growing rightward — better for long category names.
   */
  layout?: "vertical" | "horizontal";
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

/** A normalised row that both countByField and sumByField buckets map to. */
interface NormalisedBar {
  label: string;
  value: number;
  /** raw bucket value, kept for keying */
  key: string;
}

function normaliseCountSeries(
  result: CountByFieldResult,
  maxBars: number,
): NormalisedBar[] {
  const { buckets } = result;
  if (buckets.length === 0) return [];

  const shown = buckets.slice(0, maxBars);
  const rest = buckets.slice(maxBars);

  const rows: NormalisedBar[] = shown.map((b) => ({
    key: b.value || "__empty__",
    label: b.label,
    value: b.count,
  }));

  if (rest.length > 0) {
    const otherCount = rest.reduce((acc, b) => acc + b.count, 0);
    rows.push({ key: "__other__", label: "(other)", value: otherCount });
  }

  return rows;
}

function normaliseSumSeries(
  result: SumByFieldResult,
  maxBars: number,
): NormalisedBar[] {
  const { buckets } = result;
  if (buckets.length === 0) return [];

  const shown = buckets.slice(0, maxBars);
  const rest = buckets.slice(maxBars);

  const rows: NormalisedBar[] = shown.map((b) => ({
    key: b.value || "__empty__",
    label: b.label,
    value: b.sum,
  }));

  if (rest.length > 0) {
    const otherSum = rest.reduce((acc, b) => acc + b.sum, 0);
    rows.push({ key: "__other__", label: "(other)", value: otherSum });
  }

  return rows;
}

/** Pick a fill from the B&W palette by index, cycling if there are more bars than palette entries. */
function paletteColor(index: number): string {
  return ZORU_CHART_PALETTE[index % ZORU_CHART_PALETTE.length];
}

/** Default value formatter — integral values shown without decimals, others with 1dp. */
function defaultFormat(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

/**
 * Build a text summary of the chart data for screen readers.
 * Summarises the top bars and total across all bars.
 */
function buildDataSummary(
  bars: NormalisedBar[],
  formatValue: (v: number) => string,
): string {
  if (bars.length === 0) return "No data available";

  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  const topThree = bars.slice(0, 3);
  const topSummary = topThree
    .map((bar) => `${bar.label}: ${formatValue(bar.value)}`)
    .join(", ");

  if (bars.length <= 3) {
    return `Data: ${topSummary}. Total: ${formatValue(total)}`;
  }

  return `Top categories: ${topSummary}. Total across ${bars.length} categories: ${formatValue(total)}`;
}

/* -------------------------------------------------------------------------- */
/* Custom tooltip                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Tooltip wrapper that adapts Recharts' generic TooltipProps to the ZoruChartTooltip
 * prop shape. We build the `payload` array ourselves so we control the label and value.
 */
function CrmBarTooltip({
  active,
  payload,
  label,
  formatValue,
}: TooltipProps<number, string> & { formatValue: (v: number) => string }) {
  if (!active || !payload?.length) return null;

  // Recharts delivers the raw numeric value in payload[0].value.
  const raw = payload[0]?.value;
  const value = typeof raw === "number" ? raw : 0;

  return (
    <ZoruChartTooltip
      active={active}
      payload={[
        {
          name: String(payload[0]?.name ?? label),
          value: formatValue(value),
          dataKey: String(payload[0]?.dataKey ?? "value"),
          color: String(payload[0]?.color ?? ZORU_CHART_PALETTE[0]),
        },
      ]}
      label={typeof label === "string" ? label : undefined}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton loading state                                                     */
/* -------------------------------------------------------------------------- */

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="flex items-end gap-2 px-2"
      style={{ height }}
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, i) => {
        // Varied heights give a realistic bar-chart silhouette.
        const pct = [65, 85, 45, 100, 55, 70][i];
        return (
          <Skeleton
            key={i}
            className="flex-1 rounded-[var(--zoru-radius-sm)]"
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CrmBarChart — public component                                             */
/* -------------------------------------------------------------------------- */

export function CrmBarChart({
  series,
  title,
  description,
  height = 280,
  formatValue,
  maxBars = 10,
  className,
  loading = false,
  error,
  layout = "vertical",
}: CrmBarChartProps) {
  const fmt = formatValue ?? defaultFormat;

  // Derive the accessible label for the chart canvas.
  // Include the series type and key fields for screen reader context.
  const ariaLabel = title
    ? `${title} bar chart showing distribution across categories`
    : series.kind === "countByField"
      ? `${series.result.object} count distribution by ${series.result.field}`
      : `${series.result.object} aggregated ${series.result.sumField} by ${series.result.groupField}`;

  // Normalise both series shapes into a flat array for Recharts.
  const bars = React.useMemo<NormalisedBar[]>(() => {
    if (loading || error) return [];
    if (series.kind === "countByField") {
      return normaliseCountSeries(series.result, maxBars);
    }
    return normaliseSumSeries(series.result, maxBars);
  }, [series, maxBars, loading, error]);

  // Y-axis tick formatter — apply the value formatter.
  const yTickFormatter = React.useCallback(
    (v: number) => {
      // Compact numbers on the Y axis to avoid label overflow.
      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
      return fmt(v);
    },
    [fmt],
  );

  const isEmpty = !loading && !error && bars.length === 0;

  return (
    <Card className={cn("overflow-hidden", className)}>
      {(title || description) && (
        <ZoruCardHeader>
          {title && (
            <ZoruCardTitle className="text-sm font-semibold text-zoru-ink">
              {title}
            </ZoruCardTitle>
          )}
          {description && (
            <ZoruCardDescription className="text-xs text-zoru-ink-subtle">
              {description}
            </ZoruCardDescription>
          )}
        </ZoruCardHeader>
      )}

      <ZoruCardContent className={cn(!title && !description ? "pt-6" : "")}>
        {loading && <ChartSkeleton height={height} />}

        {!loading && error && (
          <div
            className="flex items-center justify-center text-xs text-zoru-ink-muted"
            style={{ height }}
            role="alert"
          >
            {error}
          </div>
        )}

        {!loading && !error && isEmpty && (
          <div
            className="flex items-center justify-center text-xs text-zoru-ink-muted"
            style={{ height }}
          >
            No data
          </div>
        )}

        {!loading && !error && !isEmpty && (
          <ZoruChartContainer height={height}>
            {layout === "vertical" ? (
              <BarChart
                data={bars}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                role="img"
                aria-label={ariaLabel}
                barCategoryGap="30%"
                barGap={2}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--zoru-line))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                    fill: "hsl(var(--zoru-ink-muted))",
                  }}
                  tickMargin={6}
                  // Truncate long labels so they don't crowd the axis.
                  tickFormatter={(v: string) =>
                    v.length > 14 ? `${v.slice(0, 13)}…` : v
                  }
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                    fill: "hsl(var(--zoru-ink-muted))",
                  }}
                  tickMargin={4}
                  tickFormatter={yTickFormatter}
                  width={48}
                />
                <Bar
                  dataKey="value"
                  name={title ?? "Value"}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={56}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-out"
                >
                  {/* Apply B&W palette per bar so each bucket is visually distinct. */}
                  {bars.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={paletteColor(index)}
                    />
                  ))}
                </Bar>
                <CrmBarTooltipWrapper formatValue={fmt} />
              </BarChart>
            ) : (
              /* Horizontal layout — good for long category names */
              <BarChart
                data={bars}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
                role="img"
                aria-label={ariaLabel}
                barCategoryGap="30%"
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="hsl(var(--zoru-line))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                    fill: "hsl(var(--zoru-ink-muted))",
                  }}
                  tickFormatter={yTickFormatter}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                    fill: "hsl(var(--zoru-ink-muted))",
                  }}
                  width={96}
                  tickFormatter={(v: string) =>
                    v.length > 16 ? `${v.slice(0, 15)}…` : v
                  }
                />
                <Bar
                  dataKey="value"
                  name={title ?? "Value"}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={32}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-out"
                >
                  {bars.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={paletteColor(index)}
                    />
                  ))}
                </Bar>
                <CrmBarTooltipWrapper formatValue={fmt} />
              </BarChart>
            )}
          </ZoruChartContainer>
        )}

        {/* Legend row — rendered below the chart for readability. */}
        {!loading && !error && bars.length > 0 && (
          <ul
            aria-label="Chart legend"
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1"
          >
            {bars.map((bar, index) => (
              <li
                key={bar.key}
                className="flex items-center gap-1.5 text-xs text-zoru-ink-muted"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: paletteColor(index) }}
                />
                <span className="truncate max-w-[120px]">{bar.label}</span>
                <span className="font-medium tabular-nums text-zoru-ink">
                  {fmt(bar.value)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Visually-hidden data table for screen readers and keyboard navigation. */}
        {!loading && !error && bars.length > 0 && (
          <div
            className="sr-only"
            role="region"
            aria-label="Chart data table"
          >
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {bars.map((bar) => (
                  <tr key={bar.key}>
                    <td>{bar.label}</td>
                    <td>{fmt(bar.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Text summary for quick context. */}
            <p>{buildDataSummary(bars, fmt)}</p>
          </div>
        )}
      </ZoruCardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Tooltip injector                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A thin wrapper that injects the `formatValue` closure into the Recharts
 * `<Tooltip>` content prop. Recharts requires the Tooltip to be a direct child
 * of the chart — this wrapper renders the Recharts `Tooltip` element so the
 * parent `BarChart` can pick it up via its `children` scan.
 */
function CrmBarTooltipWrapper({
  formatValue,
}: {
  formatValue: (v: number) => string;
}) {
  return (
    <Tooltip
      cursor={{ fill: "hsl(var(--zoru-surface-2))", opacity: 0.6 }}
      content={(props: TooltipProps<number, string>) => (
        <CrmBarTooltip {...props} formatValue={formatValue} />
      )}
    />
  );
}
