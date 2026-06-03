'use client';

/**
 * SabCRM — TimeSeriesLineChart
 *
 * A production-grade line/area chart for rendering {@link TimeSeriesResult}
 * data returned by `runAnalyticsAction({ kind: 'timeSeries', ... })`.
 *
 * Design rules
 * ─────────────
 *  • Pure black-&-white palette using ZoruUI `--zoru-*` CSS custom properties.
 *    No colour hues are used; series are distinguished by stroke pattern.
 *  • Built on the `ZoruChart` namespace (Recharts) exported from
 *    `@/components/zoruui` — no direct recharts import.
 *  • Container + tooltip come from `ZoruChartContainer` / `ZoruChartTooltip`
 *    so the chrome matches the rest of the CRM dashboard.
 *
 * Accessibility
 * ─────────────
 *  • The chart wrapper has `role="img"` and a computed `aria-label`.
 *  • An empty state with descriptive text is rendered when `points` is empty.
 *  • The interval pill buttons are keyboard-navigable `<button>` elements.
 *
 * Usage
 * ─────
 * ```tsx
 * import { TimeSeriesLineChart } from '@/components/sabcrm/charts/line-chart';
 *
 * // data comes from runAnalyticsAction({ kind: 'timeSeries', ... })
 * <TimeSeriesLineChart
 *   data={result}
 *   title="Opportunities over time"
 *   onIntervalChange={(interval) => refetch({ interval })}
 * />
 * ```
 */

import * as React from 'react';
import { TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  cn,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
} from '@/components/zoruui';
import type { TimeSeriesResult, TimeInterval } from '@/app/actions/sabcrm.actions.types';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const INTERVAL_OPTIONS: { label: string; value: TimeInterval }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

/** Stroke used for the single series line — ink (almost black). */
const LINE_STROKE = ZORU_CHART_PALETTE[0]; // hsl(var(--zoru-ink))

/** Grid + axis stroke — subtle separator tone. */
const GRID_STROKE = 'hsl(var(--zoru-line))';

/** Muted tone used for axis tick labels. */
const TICK_FILL = 'hsl(var(--zoru-ink-muted))';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Format a `YYYY-MM-DD` bucket date for X-axis tick labels.
 * Month bucket → "Jan 25"; day/week bucket → "Jan 3".
 */
function formatAxisDate(dateStr: string, interval: TimeInterval): string {
  // Guard against any date parse failure.
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;

  if (interval === 'month') {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Format a `YYYY-MM-DD` bucket date for the tooltip header — always full and
 * human-readable regardless of interval.
 */
function formatTooltipDate(dateStr: string, interval: TimeInterval): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;

  if (interval === 'month') {
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  if (interval === 'week') {
    return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Determine a sensible X-axis tick interval so labels never overlap. */
function xAxisTickInterval(pointCount: number): number | 'preserveStartEnd' {
  if (pointCount <= 12) return 0; // show every tick
  if (pointCount <= 30) return Math.ceil(pointCount / 10) - 1;
  return 'preserveStartEnd';
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

interface CrmLineTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number | string; dataKey?: string; color?: string; name?: string }>;
  label?: string | number;
  interval: TimeInterval;
}

function CrmLineTooltip({ active, payload, label, interval }: CrmLineTooltipProps) {
  if (!active || !payload?.length) return null;
  const dateLabel =
    typeof label === 'string' ? formatTooltipDate(label, interval) : String(label ?? '');
  const value = payload[0]?.value;
  return (
    <ZoruChartTooltip
      active={active}
      payload={payload}
      label={dateLabel}
      className="min-w-[130px]"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Public props                                                                */
/* -------------------------------------------------------------------------- */

export interface TimeSeriesLineChartProps {
  /**
   * Analytics result from `runAnalyticsAction({ kind: 'timeSeries', ... })`.
   * When `undefined` the chart renders a skeleton loader.
   */
  data: TimeSeriesResult | undefined;

  /**
   * Optional chart title shown in the card header. When omitted, the header
   * still renders with a TrendingUp icon and an auto-generated label
   * (`{data.object} by {data.dateField}`).
   */
  title?: string;

  /**
   * When provided, interval selector buttons are rendered and this callback
   * is fired with the newly selected interval. The parent is responsible for
   * re-fetching with the new interval and updating `data`.
   */
  onIntervalChange?: (interval: TimeInterval) => void;

  /**
   * Controls the height of the chart canvas. Defaults to 260 px.
   */
  height?: number;

  /**
   * Optional extra class names applied to the outer `<Card>`.
   */
  className?: string;

  /**
   * Whether to show the filled area beneath the line. Defaults to `true`.
   */
  showArea?: boolean;

  /**
   * Whether to show dots on each data point. Defaults to `false` (dots only
   * on hover).
   */
  showDots?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Main component                                                              */
/* -------------------------------------------------------------------------- */

/**
 * TimeSeriesLineChart — a black-&-white, production-grade line/area chart for
 * SabCRM time-series analytics data.
 */
export function TimeSeriesLineChart({
  data,
  title,
  onIntervalChange,
  height = 260,
  className,
  showArea = true,
  showDots = false,
}: TimeSeriesLineChartProps) {
  const [activeInterval, setActiveInterval] = React.useState<TimeInterval>(
    data?.interval ?? 'day',
  );

  // Sync active interval when parent data changes (e.g. after re-fetch).
  React.useEffect(() => {
    if (data?.interval) {
      setActiveInterval(data.interval);
    }
  }, [data?.interval]);

  const handleIntervalChange = (interval: TimeInterval) => {
    setActiveInterval(interval);
    onIntervalChange?.(interval);
  };

  /* ── Skeleton (loading) ─────────────────────────────────────────────────── */
  if (data === undefined) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="rounded-lg" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  /* ── Derived ────────────────────────────────────────────────────────────── */
  const chartTitle =
    title ??
    `${data.object.charAt(0).toUpperCase()}${data.object.slice(1)} over time`;

  const interval = data.interval;
  const points = data.points;
  const isEmpty = points.length === 0;

  const gradientId = `crmLineFill_${data.object}_${data.dateField}`;

  /* ── Empty state ────────────────────────────────────────────────────────── */
  const emptyContent = (
    <div
      className="flex items-center justify-center text-[13px] text-zoru-ink-muted"
      style={{ height }}
    >
      No data for this period
    </div>
  );

  /* ── Interval controls ──────────────────────────────────────────────────── */
  const intervalControls = onIntervalChange ? (
    <div
      className="flex items-center gap-0.5 rounded-md border border-zoru-line p-0.5 bg-zoru-surface-2"
      role="group"
      aria-label="Select time interval"
    >
      {INTERVAL_OPTIONS.map(({ label, value }) => (
        <button
          key={value}
          type="button"
          onClick={() => handleIntervalChange(value)}
          aria-pressed={activeInterval === value}
          className={cn(
            'rounded px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zoru-ink',
            activeInterval === value
              ? 'bg-zoru-bg text-zoru-ink shadow-sm'
              : 'text-zoru-ink-muted hover:text-zoru-ink',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

  /* ── Chart render ───────────────────────────────────────────────────────── */
  const tickInterval = xAxisTickInterval(points.length);

  const chartContent = (
    <ZoruChartContainer height={height}>
      <ZoruChart.ComposedChart
        data={points}
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {/* Black fill that fades to transparent — pure B&W. */}
            <stop offset="5%" stopColor="hsl(var(--zoru-ink))" stopOpacity={0.12} />
            <stop offset="95%" stopColor="hsl(var(--zoru-ink))" stopOpacity={0} />
          </linearGradient>
        </defs>

        <ZoruChart.CartesianGrid
          strokeDasharray="4 4"
          stroke={GRID_STROKE}
          strokeOpacity={0.5}
          vertical={false}
        />

        <ZoruChart.XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: TICK_FILL }}
          tickFormatter={(v: string) => formatAxisDate(v, interval)}
          interval={tickInterval}
        />

        <ZoruChart.YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: TICK_FILL }}
          allowDecimals={false}
          width={36}
        />

        <ZoruChart.Tooltip
          content={({ active, payload, label }) => (
            <CrmLineTooltip
              active={active}
              payload={payload}
              label={label}
              interval={interval}
            />
          )}
          cursor={{
            stroke: 'hsl(var(--zoru-ink))',
            strokeWidth: 1,
            strokeDasharray: '3 3',
            strokeOpacity: 0.4,
          }}
        />

        {/* Filled area — rendered before the line so the line sits on top. */}
        {showArea && (
          <ZoruChart.Area
            type="monotone"
            dataKey="count"
            stroke="none"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        )}

        <ZoruChart.Line
          type="monotone"
          dataKey="count"
          stroke={LINE_STROKE}
          strokeWidth={2}
          dot={
            showDots
              ? {
                  r: 3,
                  fill: 'hsl(var(--zoru-bg))',
                  stroke: LINE_STROKE,
                  strokeWidth: 2,
                }
              : false
          }
          activeDot={{
            r: 4,
            fill: 'hsl(var(--zoru-ink))',
            stroke: 'hsl(var(--zoru-bg))',
            strokeWidth: 2,
          }}
          isAnimationActive={false}
          name="Records"
        />
      </ZoruChart.ComposedChart>
    </ZoruChartContainer>
  );

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp
              className="h-4 w-4 shrink-0 text-zoru-ink-muted"
              aria-hidden
            />
            <CardTitle className="truncate text-[13px] font-medium text-zoru-ink">
              {chartTitle}
            </CardTitle>
          </div>
          {intervalControls}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Total badge — small contextual KPI below the title */}
        {!isEmpty && (
          <p className="mb-3 text-[11px] text-zoru-ink-muted">
            {data.total.toLocaleString()} record{data.total !== 1 ? 's' : ''} total
          </p>
        )}
        <div
          role="img"
          aria-label={`${chartTitle}: ${data.total} records`}
        >
          {isEmpty ? emptyContent : chartContent}
        </div>
      </CardContent>
    </Card>
  );
}
