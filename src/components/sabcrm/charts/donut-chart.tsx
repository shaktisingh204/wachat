'use client';

/**
 * SabCRM — DonutChart
 *
 * A pure black-&-white donut/pie chart for distribution analytics (e.g. deals
 * by stage, tasks by status). Data is fetched via the gated
 * {@link runAnalyticsAction} `countByField` spec so it respects the full
 * session → project → RBAC → plan pipeline without any direct Mongo access on
 * the client.
 *
 * Design principles
 * -----------------
 * - ZoruUI only: uses `ZoruChartContainer`, `ZoruChartTooltip`,
 *   `ZORU_CHART_PALETTE`, `Card`, `Skeleton`, `EmptyState`, `Badge`, `cn`
 *   from `@/components/zoruui` and `@/components/zoruui/chart`.
 * - B&W palette: slices are drawn from `ZORU_CHART_PALETTE` (greyscale). No
 *   hue-based colour is used; the palette wraps for objects with more buckets
 *   than 5 palette stops.
 * - Accessible: the SVG region is `aria-hidden`; results are also rendered
 *   as a visible legend table so screen-reader users get the same information
 *   without parsing the chart.
 * - Resilient: loading, error and empty states are handled inline. The
 *   component never throws to an error boundary.
 * - Strict TypeScript: no `any`. Only the Recharts `CustomTooltipProps`
 *   workaround (recharts tooltips receive an untyped payload) uses the
 *   `ZoruChartTooltipProps` shape already established in `chart.tsx`.
 */

import * as React from 'react';
import { PieChart } from 'recharts';
import { BarChart2, RefreshCw } from 'lucide-react';

import {
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruChart,
  ZORU_CHART_PALETTE,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  cn,
} from '@/components/zoruui';
import {
  runAnalyticsAction,
  type CountByFieldResult,
} from '@/app/actions/sabcrm.actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DonutChartProps {
  /** Object slug to aggregate, e.g. `opportunities`. */
  object: string;
  /** Field key whose values form the distribution buckets, e.g. `stage`. */
  fieldKey: string;
  /** Human-readable title rendered above the chart. */
  title?: string;
  /** Optional sub-label below the title. */
  description?: string;
  /** Active project override forwarded to the server action. */
  projectId?: string;
  /** Chart height in px. Defaults to 220. */
  height?: number;
  /**
   * When true the inner hole displays a count summary.
   * Defaults to true (donut); set false for a full pie.
   */
  showCenter?: boolean;
  /** Additional class on the root Card element. */
  className?: string;
  /**
   * External refresh token: bump to force a refetch (e.g. after a record
   * is created or updated in the parent view).
   */
  refreshToken?: number;
}

// Internal shape passed to Recharts (no `any` — all fields are known).
interface SliceDatum {
  name: string;
  value: number;
  fill: string;
  /** Original bucket value (raw, not label) used for aria + tooltip matching. */
  bucketValue: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap palette index so we never go out of bounds on large bucket sets. */
function paletteColor(idx: number): string {
  return ZORU_CHART_PALETTE[idx % ZORU_CHART_PALETTE.length] as string;
}

/** Format a percentage for display, rounded to 1 decimal place. */
function pct(count: number, total: number): string {
  if (total === 0) return '0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

/**
 * Wraps {@link ZoruChartTooltip} with the slice-specific label and percentage.
 * Recharts injects a `payload` array of active slices; we take the first one.
 */
function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  total: number;
}): React.ReactElement | null {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const count = typeof entry?.value === 'number' ? entry.value : 0;

  return (
    <ZoruChartTooltip
      active={active}
      payload={[
        {
          name: entry?.name,
          value: count,
          color: entry?.color,
          dataKey: entry?.dataKey,
        },
      ]}
      label={pct(count, total)}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Donut (or pie) chart showing the distribution of CRM records over one SELECT
 * (or any discrete) field. Fetches data via `runAnalyticsAction({ kind:
 * 'countByField', object, fieldKey })` — gated behind `sabcrm:view`.
 */
export function DonutChart({
  object,
  fieldKey,
  title,
  description,
  projectId,
  height = 220,
  showCenter = true,
  className,
  refreshToken = 0,
}: DonutChartProps): React.ReactElement {
  const [result, setResult] = React.useState<CountByFieldResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [localTick, setLocalTick] = React.useState(0);

  // Fetch whenever inputs or the refresh token changes.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void runAnalyticsAction(
      { kind: 'countByField', object, fieldKey },
      projectId,
    ).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        return;
      }
      // Type-narrow: runAnalyticsAction returns `AnalyticsResult` (union);
      // we know `countByField` always returns `CountByFieldResult`.
      const data = res.data as CountByFieldResult;
      setResult(data);
    });

    return () => {
      cancelled = true;
    };
  }, [object, fieldKey, projectId, refreshToken, localTick]);

  // Build Recharts-friendly data from buckets.
  const slices: SliceDatum[] = React.useMemo(() => {
    if (!result) return [];
    return result.buckets.map((b, idx) => ({
      name: b.label || b.value || '(empty)',
      value: b.count,
      fill: paletteColor(idx),
      bucketValue: b.value,
    }));
  }, [result]);

  const total = result?.total ?? 0;

  // Inner-radius ratio for the donut hole.
  const innerRadius = showCenter ? '55%' : '0%';
  const outerRadius = '80%';

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  const header = (
    <div className="flex items-start justify-between gap-2 px-4 pt-4">
      <div className="min-w-0">
        {title && (
          <p className="truncate text-sm font-semibold text-zoru-ink">{title}</p>
        )}
        {description && (
          <p className="mt-0.5 truncate text-xs text-zoru-ink-muted">
            {description}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Refresh chart"
        disabled={loading}
        onClick={() => setLocalTick((n) => n + 1)}
      >
        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
      </Button>
    </div>
  );

  if (loading && !result) {
    return (
      <Card variant="default" className={cn('gap-0 overflow-hidden', className)}>
        {header}
        <DonutSkeleton height={height} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="default" className={cn('gap-0 overflow-hidden', className)}>
        {header}
        <EmptyState
          compact
          icon={<BarChart2 />}
          title="Failed to load chart"
          description={error}
          className="m-4 border-dashed"
        />
      </Card>
    );
  }

  if (!result || slices.length === 0) {
    return (
      <Card variant="default" className={cn('gap-0 overflow-hidden', className)}>
        {header}
        <EmptyState
          compact
          icon={<BarChart2 />}
          title="No data"
          description="No records match the selected field."
          className="m-4 border-dashed"
        />
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Chart
  // ---------------------------------------------------------------------------

  return (
    <Card variant="default" className={cn('gap-0 overflow-hidden', className)}>
      {header}

      {/* SVG chart — aria-hidden because data is duplicated in the legend below */}
      <div aria-hidden className="relative px-4 pb-2 pt-3">
        <ZoruChartContainer height={height}>
          <PieChart>
            <ZoruChart.Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              strokeWidth={2}
              stroke="hsl(var(--zoru-bg))"
            >
              {slices.map((slice) => (
                <ZoruChart.Cell
                  key={slice.bucketValue}
                  fill={slice.fill}
                />
              ))}
            </ZoruChart.Pie>
            <ZoruChart.Tooltip
              content={
                <DonutTooltip total={total} />
              }
            />
          </PieChart>
        </ZoruChartContainer>

        {/* Center label — shown only in donut mode */}
        {showCenter && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          >
            <span className="text-2xl font-semibold tabular-nums leading-none text-zoru-ink">
              {total}
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-zoru-ink-muted">
              total
            </span>
          </div>
        )}
      </div>

      {/* Legend — accessible table; also the primary output for SR users */}
      <div className="border-t border-zoru-line px-4 pb-4 pt-3">
        <ul
          role="list"
          aria-label={`${title ?? fieldKey} distribution`}
          className="space-y-2"
        >
          {slices.map((slice, idx) => (
            <li
              key={slice.bucketValue}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                {/* Colour swatch — decorative, colour is also conveyed by text */}
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: paletteColor(idx) }}
                />
                <span className="truncate text-zoru-ink-muted">{slice.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary" className="tabular-nums">
                  {slice.value}
                </Badge>
                <span
                  className="w-12 text-right tabular-nums text-zoru-ink-muted"
                  aria-label={`${pct(slice.value, total)} of total`}
                >
                  {pct(slice.value, total)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DonutSkeleton({ height }: { height: number }): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
      {/* Chart area placeholder */}
      <Skeleton
        className="mx-auto rounded-full"
        style={{
          width: height * 0.9,
          height: height * 0.9,
          maxWidth: '100%',
        }}
      />
      {/* Legend rows */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-2.5 rounded-sm" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-8 rounded-full" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}
