'use client';

/**
 * SabCRM — Report chart renderer (Twenty-style, pure CSS/SVG).
 *
 * A single self-contained visualiser shared by the saved-reports run output
 * (`../reports/page.tsx`) and the builder live preview
 * (`../reports/builder/page.tsx`). It switches on the report's `chartType`
 * hint and renders the same {@link ReportDataSeries} shape five ways:
 *
 *   - `bar`    → horizontal CSS bars (the improved default),
 *   - `line`   → an inline SVG polyline with axis ticks + dots,
 *   - `pie`    → an SVG donut built from the series, with a legend,
 *   - `number` → a single big metric tile,
 *   - `table`  → a clean Twenty label/value table.
 *
 * NO chart library and NO new deps — everything is hand-rolled CSS/SVG using
 * the shared `.st-*` kit plus the page-local classes in `./reports-twenty.css`
 * (all scoped under `.sabcrm-twenty`). Behaviour degrades gracefully for empty
 * series (an inline empty note) and for ungrouped/single-value reports (which
 * always collapse to the metric tile regardless of the requested chart type).
 */

import * as React from 'react';
import type {
  ReportDataSeries,
  ReportChartType,
} from '@/app/actions/sabcrm.actions.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOTAL_KEY = '__total__';

/** Twenty-faithful B&W-leaning categorical palette (used for pie/legend). */
const PALETTE: ReadonlyArray<string> = [
  'var(--st-text)',
  '#6b7280',
  '#9ca3af',
  '#374151',
  '#d1d5db',
  '#4b5563',
  '#111827',
  '#a1a1aa',
];

function sliceColor(index: number, hint?: string): string {
  return hint || PALETTE[index % PALETTE.length] || 'var(--st-text)';
}

export function formatReportValue(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

/** True when a series can only be shown as a single value tile. */
export function isSingleValueSeries(series: ReportDataSeries): boolean {
  return (
    !series.groupByField ||
    series.rows.length === 0 ||
    (series.rows.length === 1 && series.rows[0]?.key === TOTAL_KEY)
  );
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

function MetricTile({
  value,
  caption,
}: {
  value: number;
  caption: string;
}): React.JSX.Element {
  return (
    <div className="st-metric">
      <span className="st-metric__value">{formatReportValue(value)}</span>
      <span className="st-metric__caption">{caption}</span>
    </div>
  );
}

function BarChart({ series }: { series: ReportDataSeries }): React.JSX.Element {
  const max = series.rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  return (
    <div className="st-bars">
      {series.rows.map((row, i) => {
        const pct = Math.max(2, Math.round((row.value / max) * 100));
        return (
          <div className="st-bar" key={row.key || i}>
            <span className="st-bar__label" title={row.label}>
              {row.label}
            </span>
            <span className="st-bar__track">
              <span
                className="st-bar__fill"
                style={{
                  width: `${pct}%`,
                  ...(row.color ? { background: row.color } : null),
                }}
              />
            </span>
            <span className="st-bar__value">{formatReportValue(row.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ series }: { series: ReportDataSeries }): React.JSX.Element {
  const rows = series.rows;
  // viewBox geometry (responsive via width:100%, fixed aspect via viewBox)
  const W = 640;
  const H = 240;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  const min = rows.reduce((m, r) => Math.min(m, r.value), 0);
  const lo = Math.min(0, min);
  const span = max - lo || 1;

  const n = rows.length;
  const x = (i: number): number =>
    n <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (n - 1)) * plotW;
  const y = (v: number): number => PAD_T + plotH - ((v - lo) / span) * plotH;

  const points = rows.map((r, i) => `${x(i)},${y(r.value)}`).join(' ');
  const areaPoints =
    `${x(0)},${PAD_T + plotH} ` +
    points +
    ` ${x(n - 1)},${PAD_T + plotH}`;

  // y-axis ticks (4 gridlines)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const value = lo + span * t;
    return { value, yPos: y(value) };
  });

  return (
    <div className="st-chart">
      <svg
        className="st-chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Line chart"
        preserveAspectRatio="none"
      >
        {/* gridlines + y ticks */}
        {ticks.map((tk, i) => (
          <g key={i}>
            <line
              className="st-chart__grid"
              x1={PAD_L}
              x2={W - PAD_R}
              y1={tk.yPos}
              y2={tk.yPos}
            />
            <text
              className="st-chart__tick"
              x={PAD_L + 2}
              y={tk.yPos - 3}
            >
              {formatReportValue(tk.value)}
            </text>
          </g>
        ))}

        {/* area fill */}
        {n > 1 && (
          <polygon className="st-chart__area" points={areaPoints} />
        )}

        {/* line */}
        <polyline className="st-chart__line" points={points} />

        {/* dots */}
        {rows.map((r, i) => (
          <circle
            key={r.key || i}
            className="st-chart__dot"
            cx={x(i)}
            cy={y(r.value)}
            r={3}
          >
            <title>{`${r.label}: ${formatReportValue(r.value)}`}</title>
          </circle>
        ))}
      </svg>

      {/* x-axis labels (HTML so they wrap/ellipsize cleanly) */}
      <div className="st-chart__xaxis">
        {rows.map((r, i) => (
          <span className="st-chart__xlabel" key={r.key || i} title={r.label}>
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PieChart({ series }: { series: ReportDataSeries }): React.JSX.Element {
  const rows = series.rows.filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);

  if (total <= 0) {
    return <div className="st-chart-empty">No positive values to chart.</div>;
  }

  const R = 80;
  const C = 100; // centre
  const STROKE = 34; // donut thickness
  const radius = R - STROKE / 2;
  const circumference = 2 * Math.PI * radius;

  let acc = 0;
  const arcs = rows.map((r, i) => {
    const frac = r.value / total;
    const dash = frac * circumference;
    const gap = circumference - dash;
    const offset = -acc * circumference;
    acc += frac;
    return {
      key: r.key || String(i),
      label: r.label,
      value: r.value,
      pct: frac * 100,
      color: sliceColor(i, r.color),
      dash,
      gap,
      offset,
    };
  });

  return (
    <div className="st-pie">
      <svg
        className="st-pie__svg"
        viewBox="0 0 200 200"
        role="img"
        aria-label="Pie chart"
      >
        <g transform={`rotate(-90 ${C} ${C})`}>
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={C}
              cy={C}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={STROKE}
              strokeDasharray={`${a.dash} ${a.gap}`}
              strokeDashoffset={a.offset}
            >
              <title>{`${a.label}: ${formatReportValue(a.value)} (${a.pct.toFixed(1)}%)`}</title>
            </circle>
          ))}
        </g>
        <text className="st-pie__center-num" x={C} y={C - 2}>
          {formatReportValue(total)}
        </text>
        <text className="st-pie__center-cap" x={C} y={C + 16}>
          total
        </text>
      </svg>

      <ul className="st-pie__legend">
        {arcs.map((a) => (
          <li className="st-pie__legend-item" key={a.key}>
            <span
              className="st-pie__swatch"
              style={{ background: a.color }}
              aria-hidden="true"
            />
            <span className="st-pie__legend-label" title={a.label}>
              {a.label}
            </span>
            <span className="st-pie__legend-val">
              {formatReportValue(a.value)}
              <span className="st-pie__legend-pct">{a.pct.toFixed(1)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableChart({ series }: { series: ReportDataSeries }): React.JSX.Element {
  const total = series.rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="st-rtable-wrap">
      <table className="st-rtable">
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col" className="st-rtable__num">
              {series.metric === 'count' ? 'Count' : 'Value'}
            </th>
            <th scope="col" className="st-rtable__num">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {series.rows.map((r, i) => (
            <tr key={r.key || i}>
              <td>
                <span className="st-rtable__label" title={r.label}>
                  {r.color && (
                    <span
                      className="st-rtable__dot"
                      style={{ background: r.color }}
                      aria-hidden="true"
                    />
                  )}
                  {r.label}
                </span>
              </td>
              <td className="st-rtable__num">{formatReportValue(r.value)}</td>
              <td className="st-rtable__num st-rtable__muted">
                {total > 0 ? `${((r.value / total) * 100).toFixed(1)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        {series.rows.length > 1 && (
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="st-rtable__num">{formatReportValue(total)}</td>
              <td className="st-rtable__num st-rtable__muted">100%</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public renderer
// ---------------------------------------------------------------------------

export interface ReportChartProps {
  series: ReportDataSeries;
  /** Visualisation hint from the report definition. Defaults to `bar`. */
  chartType?: ReportChartType;
  /** Caption shown under a single-value / number tile. */
  metricCaption: string;
  /** Whether to render the "N group(s) · M record(s) matched" footer. */
  showFooter?: boolean;
}

/**
 * Renders a {@link ReportDataSeries} as the requested chart type. Ungrouped /
 * empty series always collapse to the single-value metric tile.
 */
export function ReportChart({
  series,
  chartType = 'bar',
  metricCaption,
  showFooter = true,
}: ReportChartProps): React.JSX.Element {
  // Single-value (or `number` chart) → big metric tile.
  if (chartType === 'number' || isSingleValueSeries(series)) {
    const value = series.rows[0]?.value ?? 0;
    return (
      <div>
        <MetricTile value={value} caption={metricCaption} />
        {showFooter && (
          <div className="st-result-foot">
            <span>{series.recordCount} record(s) matched</span>
          </div>
        )}
      </div>
    );
  }

  let body: React.JSX.Element;
  switch (chartType) {
    case 'line':
      body = <LineChart series={series} />;
      break;
    case 'pie':
      body = <PieChart series={series} />;
      break;
    case 'table':
      body = <TableChart series={series} />;
      break;
    case 'bar':
    default:
      body = <BarChart series={series} />;
      break;
  }

  return (
    <div>
      {body}
      {showFooter && (
        <div className="st-result-foot">
          <span>
            {series.rows.length} group(s) · {series.recordCount} record(s) matched
          </span>
        </div>
      )}
    </div>
  );
}
