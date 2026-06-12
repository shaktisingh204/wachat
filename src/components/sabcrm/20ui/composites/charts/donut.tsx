'use client';

/**
 * 20ui · charts — DonutChart.
 *
 * A distribution donut over generic `{ label, value }` rows, built on the
 * 20ui chart primitives + recharts (Pie with an inner radius). Ships its own
 * compact HTML legend (label · value · share) and an optional center overlay
 * (defaults to the series total). Per-datum `color` overrides the quiet
 * greyscale CHART_PALETTE ramp.
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

export interface DonutChartProps {
  data: ReadonlyArray<ChartDatum>;
  /** Plot height in px. Defaults to 180. */
  height?: number;
  /** Formats legend / tooltip / center values. */
  formatValue?: (value: number) => string;
  /** Center overlay caption (defaults to "total"). */
  centerLabel?: React.ReactNode;
  /** Center overlay value (defaults to the formatted total). */
  centerValue?: React.ReactNode;
  /** Render the compact legend under the plot. Defaults to true. */
  showLegend?: boolean;
  /** Message rendered when there are no positive rows. */
  emptyLabel?: string;
  className?: string;
}

/** A quiet distribution donut on the 20ui chart primitives. */
export function DonutChart({
  data,
  height = 180,
  formatValue = formatChartNumber,
  centerLabel = 'total',
  centerValue,
  showLegend = true,
  emptyLabel = 'No data to chart yet.',
  className,
}: DonutChartProps): React.JSX.Element {
  const rows = React.useMemo(
    () =>
      data
        .filter((d) => d.value > 0)
        .map((d, i) => ({
          label: d.label,
          value: d.value,
          fill: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
        })),
    [data],
  );

  const total = React.useMemo(
    () => rows.reduce((sum, r) => sum + r.value, 0),
    [rows],
  );

  if (rows.length === 0 || total <= 0) {
    return <div className="u-chx-empty">{emptyLabel}</div>;
  }

  return (
    <div className={['u-chx-donut', className].filter(Boolean).join(' ')}>
      <div className="u-chx-donut__plot">
        <ChartContainer config={{}} style={{ height, aspectRatio: 'auto' }}>
          <Recharts.PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="label"
                  formatter={(value, name, item) => (
                    <>
                      <span
                        aria-hidden="true"
                        className="u-chart-tt__indicator u-chart-tt__indicator--dot"
                        style={
                          {
                            '--u-chart-indicator':
                              (item.payload?.fill as string | undefined) ?? item.color,
                          } as React.CSSProperties
                        }
                      />
                      <div className="u-chart-tt__content">
                        <span className="u-chart-tt__name">{String(name)}</span>
                        <span className="u-chart-tt__value">
                          {formatValue(Number(value))}
                        </span>
                      </div>
                    </>
                  )}
                />
              }
            />
            <Recharts.Pie
              data={rows}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              strokeWidth={1}
              stroke="var(--st-bg)"
              paddingAngle={1}
            >
              {rows.map((row, i) => (
                <Recharts.Cell key={row.label || i} fill={row.fill} />
              ))}
            </Recharts.Pie>
          </Recharts.PieChart>
        </ChartContainer>
        <div className="u-chx-donut__center" aria-hidden="true">
          <span className="u-chx-donut__center-value">
            {centerValue ?? formatValue(total)}
          </span>
          <span className="u-chx-donut__center-cap">{centerLabel}</span>
        </div>
      </div>

      {showLegend ? (
        <ul className="u-chx-donut__legend">
          {rows.map((row, i) => {
            const pct = total > 0 ? (row.value / total) * 100 : 0;
            return (
              <li className="u-chx-donut__legend-item" key={row.label || i}>
                <span
                  className="u-chx-donut__swatch"
                  style={{ background: row.fill }}
                  aria-hidden="true"
                />
                <span className="u-chx-donut__legend-label" title={row.label}>
                  {row.label}
                </span>
                <span className="u-chx-donut__legend-val">
                  {formatValue(row.value)}
                </span>
                <span className="u-chx-donut__legend-pct">{pct.toFixed(1)}%</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
