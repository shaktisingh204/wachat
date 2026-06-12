'use client';

/**
 * 20ui · charts — BarChart.
 *
 * A categorical bar chart over generic `{ label, value }` rows, built on the
 * 20ui chart primitives (ChartContainer + ChartTooltipContent) and recharts.
 * Two layouts:
 *   - `vertical`   (default) — columns, labels along the X axis,
 *   - `horizontal` — bands, labels along the Y axis (auto-height per row;
 *     the natural read for stage / owner breakdowns with long labels).
 *
 * Quiet greyscale by default (CHART_PALETTE[0]); per-datum `color` overrides.
 * No data fetching — callers map domain results into rows.
 */

import * as React from 'react';

import {
  CHART_PALETTE,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Recharts,
} from '../../chart';
import { formatChartNumber, type ChartDatum } from './types';

import './charts.css';

export interface BarChartProps {
  data: ReadonlyArray<ChartDatum>;
  /** `vertical` = columns (default); `horizontal` = left-to-right bands. */
  layout?: 'vertical' | 'horizontal';
  /** Plot height in px. Horizontal layout defaults to ~34px per row. */
  height?: number;
  /** Formats axis ticks + tooltip values (e.g. currency). */
  formatValue?: (value: number) => string;
  /** Series name shown in the tooltip. */
  seriesLabel?: string;
  /** Message rendered when there are no rows. */
  emptyLabel?: string;
  className?: string;
}

/** Categorical bars on the 20ui chart primitives. */
export function BarChart({
  data,
  layout = 'vertical',
  height,
  formatValue = formatChartNumber,
  seriesLabel = 'Value',
  emptyLabel = 'No data to chart yet.',
  className,
}: BarChartProps): React.JSX.Element {
  const rows = React.useMemo(
    () => data.map((d) => ({ label: d.label, value: d.value, color: d.color })),
    [data],
  );

  if (rows.length === 0) {
    return <div className="u-chx-empty">{emptyLabel}</div>;
  }

  const horizontal = layout === 'horizontal';
  const resolvedHeight = height ?? (horizontal ? rows.length * 34 + 12 : 220);

  const config = { value: { label: seriesLabel, color: CHART_PALETTE[0] } };

  const tooltip = (
    <ChartTooltip
      cursor={{ fill: 'var(--st-hover)' }}
      content={
        <ChartTooltipContent
          hideIndicator
          formatter={(value) => (
            <div className="u-chart-tt__content">
              <span className="u-chart-tt__name">{seriesLabel}</span>
              <span className="u-chart-tt__value">{formatValue(Number(value))}</span>
            </div>
          )}
        />
      }
    />
  );

  const cells = rows.map((row, i) => (
    <Recharts.Cell key={row.label || i} fill={row.color ?? 'var(--color-value)'} />
  ));

  return (
    <ChartContainer
      config={config}
      className={className}
      style={{ height: resolvedHeight, aspectRatio: 'auto' }}
    >
      {horizontal ? (
        <Recharts.BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
        >
          <Recharts.CartesianGrid horizontal={false} />
          <Recharts.XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
            allowDecimals={false}
            tick={{ fontSize: 11 }}
          />
          <Recharts.YAxis
            type="category"
            dataKey="label"
            width={110}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
          />
          {tooltip}
          <Recharts.Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={20}>
            {cells}
          </Recharts.Bar>
        </Recharts.BarChart>
      ) : (
        <Recharts.BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <Recharts.CartesianGrid vertical={false} />
          <Recharts.XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tick={{ fontSize: 11 }}
          />
          <Recharts.YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatValue}
            allowDecimals={false}
            tick={{ fontSize: 11 }}
          />
          {tooltip}
          <Recharts.Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={40}>
            {cells}
          </Recharts.Bar>
        </Recharts.BarChart>
      )}
    </ChartContainer>
  );
}
