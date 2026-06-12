'use client';

/**
 * 20ui · charts — LineChart.
 *
 * A single-series trend line over generic `{ label, value }` rows, built on
 * the 20ui chart primitives + recharts. Quiet monotone styling: one line, a
 * faint area fill, horizontal gridlines, no dots until hover.
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

export interface LineChartProps {
  /** Ordered rows (oldest → newest for time series). */
  data: ReadonlyArray<ChartDatum>;
  /** Plot height in px. Defaults to 220. */
  height?: number;
  /** Formats axis ticks + tooltip values. */
  formatValue?: (value: number) => string;
  /** Series name shown in the tooltip. */
  seriesLabel?: string;
  /** Message rendered when there are no rows. */
  emptyLabel?: string;
  className?: string;
}

/** A quiet single-series trend line on the 20ui chart primitives. */
export function LineChart({
  data,
  height = 220,
  formatValue = formatChartNumber,
  seriesLabel = 'Value',
  emptyLabel = 'No data to chart yet.',
  className,
}: LineChartProps): React.JSX.Element {
  const rows = React.useMemo(
    () => data.map((d) => ({ label: d.label, value: d.value })),
    [data],
  );

  if (rows.length === 0) {
    return <div className="u-chx-empty">{emptyLabel}</div>;
  }

  const config = { value: { label: seriesLabel, color: CHART_PALETTE[0] } };

  return (
    <ChartContainer
      config={config}
      className={className}
      style={{ height, aspectRatio: 'auto' }}
    >
      <Recharts.AreaChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
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
        <ChartTooltip
          cursor={{ stroke: 'var(--st-border-strong)' }}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value) => (
                <div className="u-chart-tt__content">
                  <span className="u-chart-tt__name">{seriesLabel}</span>
                  <span className="u-chart-tt__value">
                    {formatValue(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Recharts.Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          fill="var(--color-value)"
          fillOpacity={0.06}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </Recharts.AreaChart>
    </ChartContainer>
  );
}
