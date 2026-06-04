'use client';

/**
 * SabCRM — Native .sabcrm-twenty chart primitives
 * =================================================
 *
 * Inline-SVG charts drawn entirely with `--st-*` design tokens and the
 * `.st-chart*` classes in `twenty-charts.css`. NO Recharts, NO ZoruUI, NO
 * `--zoru-*` tokens — these are the Twenty-faithful replacements for the
 * Recharts-backed ZoruUI charts (`CrmBarChart` / `DonutChart` /
 * `TimeSeriesLineChart`) on the CRM dashboard.
 *
 * The vendored Twenty (`services/sabcrm`) is reskinned to a black-&-white
 * grayscale palette with a single blue accent (see `MainColorsLight.ts`'s
 * `mapRecordToGrayscale`). These charts honour that: the primary series uses
 * `--st-accent` (blue), and multi-category breakdowns step down a greyscale
 * ramp — matching the existing `TwentyFunnelChart`.
 *
 * Components
 * ----------
 *  • {@link TwentyBarChart}   — vertical or horizontal bars (countByField /
 *                               sumByField). Each chart sits inside an
 *                               `.st-panel` with the dashboard chrome.
 *  • {@link TwentyLineChart}  — line + soft area (timeSeries).
 *  • {@link TwentyDonutChart} — donut (or pie) distribution (countByField),
 *                               self-fetching via `runAnalyticsAction`.
 *
 * Every component owns its empty / error / loading state inline and never
 * throws, so one failing chart can't break its dashboard neighbours.
 */

import * as React from 'react';

import { runAnalyticsAction } from '@/app/actions/sabcrm.actions';
import type {
  CountByFieldResult,
  SumByFieldResult,
  TimeSeriesResult,
  TimeInterval,
} from '@/app/actions/sabcrm.actions.types';

import './twenty-charts.css';

/* -------------------------------------------------------------------------- */
/* Palette — Twenty's grayscale reskin + blue accent                          */
/* -------------------------------------------------------------------------- */

/**
 * Greyscale ramp for multi-category breakdowns. Index 0 is the blue accent
 * (the default Twenty series colour); the rest step down a neutral ramp so a
 * bar / slice / legend swatch stays distinguishable without relying on hue.
 * Mirrors the `hsl(220 6% L%)` ramp used by `TwentyFunnelChart`.
 */
function categoryColor(index: number): string {
  if (index === 0) return 'var(--st-accent)';
  // 88% → darker as the index grows; clamps so deep tails stay legible.
  const lightness = 88 - Math.min(index - 1, 6) * 11;
  return `hsl(220 6% ${lightness}%)`;
}

/* -------------------------------------------------------------------------- */
/* Shared formatters / helpers                                                */
/* -------------------------------------------------------------------------- */

function defaultFormat(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

/** Compact axis tick (1.2k / 3.4M) so long values never crowd the axis. */
function compactTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return defaultFormat(value);
}

function truncate(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** "Nice" upper bound for an axis so gridlines land on round numbers. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / pow;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 2.5) nice = 2.5;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

/* -------------------------------------------------------------------------- */
/* State chrome (inside an .st-panel)                                          */
/* -------------------------------------------------------------------------- */

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="st-panel">
      <div className="st-panel__head">{title}</div>
      {description ? (
        <p className="st-chart__desc" style={{ padding: '0 var(--st-space-4)' }}>
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function ChartState({ message }: { message: string }): React.JSX.Element {
  return <div className="st-chart__state">{message}</div>;
}

function ChartSkeleton(): React.JSX.Element {
  const heights = [60, 82, 44, 96, 54, 70];
  return (
    <div className="st-chart__skel" aria-hidden="true" style={{ height: 200 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="st-chart__skel-bar st-skeleton"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Normalised row shared by bar + donut                                       */
/* -------------------------------------------------------------------------- */

interface ChartRow {
  key: string;
  label: string;
  value: number;
}

function rowsFromCount(
  result: CountByFieldResult,
  maxRows: number,
): ChartRow[] {
  const shown = result.buckets.slice(0, maxRows);
  const rest = result.buckets.slice(maxRows);
  const rows: ChartRow[] = shown.map((b) => ({
    key: b.value || '__empty__',
    label: b.label || b.value || '(empty)',
    value: b.count,
  }));
  if (rest.length > 0) {
    rows.push({
      key: '__other__',
      label: '(other)',
      value: rest.reduce((acc, b) => acc + b.count, 0),
    });
  }
  return rows;
}

function rowsFromSum(result: SumByFieldResult, maxRows: number): ChartRow[] {
  const shown = result.buckets.slice(0, maxRows);
  const rest = result.buckets.slice(maxRows);
  const rows: ChartRow[] = shown.map((b) => ({
    key: b.value || '__empty__',
    label: b.label || b.value || '(empty)',
    value: b.sum,
  }));
  if (rest.length > 0) {
    rows.push({
      key: '__other__',
      label: '(other)',
      value: rest.reduce((acc, b) => acc + b.sum, 0),
    });
  }
  return rows;
}

/* ========================================================================== */
/* TwentyBarChart                                                             */
/* ========================================================================== */

export type TwentyBarSeries =
  | { kind: 'countByField'; result: CountByFieldResult }
  | { kind: 'sumByField'; result: SumByFieldResult };

export interface TwentyBarChartProps {
  /** Pre-fetched analytics result, tagged by aggregation kind. */
  series: TwentyBarSeries;
  /** Panel title. */
  title: string;
  /** Optional one-line description under the title. */
  description?: string;
  /** Orientation: vertical bars grow up, horizontal grow right. */
  layout?: 'vertical' | 'horizontal';
  /** Value formatter for labels / legend (e.g. currency). */
  formatValue?: (value: number) => string;
  /** Max bars before the tail collapses into "(other)". Default 8. */
  maxBars?: number;
  /** Inline error message; renders instead of the chart. */
  error?: string;
}

/**
 * Native Twenty bar chart drawn with inline SVG + `--st-*` tokens. Supports
 * both `countByField` and `sumByField` results and either orientation.
 */
export function TwentyBarChart({
  series,
  title,
  description,
  layout = 'vertical',
  formatValue,
  maxBars = 8,
  error,
}: TwentyBarChartProps): React.JSX.Element {
  const fmt = formatValue ?? defaultFormat;

  const rows = React.useMemo<ChartRow[]>(() => {
    if (error) return [];
    return series.kind === 'countByField'
      ? rowsFromCount(series.result, maxBars)
      : rowsFromSum(series.result, maxBars);
  }, [series, maxBars, error]);

  if (error) {
    return (
      <ChartPanel title={title} description={description}>
        <ChartState message={error} />
      </ChartPanel>
    );
  }
  if (rows.length === 0) {
    return (
      <ChartPanel title={title} description={description}>
        <ChartState message="No data to chart yet." />
      </ChartPanel>
    );
  }

  const max = niceMax(rows.reduce((m, r) => Math.max(m, r.value), 0));
  const body =
    layout === 'horizontal' ? (
      <HorizontalBars rows={rows} max={max} fmt={fmt} />
    ) : (
      <VerticalBars rows={rows} max={max} fmt={fmt} />
    );

  return (
    <ChartPanel title={title} description={description}>
      <div className="st-chart">
        {body}
        <SrTable title={title} rows={rows} fmt={fmt} />
      </div>
    </ChartPanel>
  );
}

function VerticalBars({
  rows,
  max,
  fmt,
}: {
  rows: ChartRow[];
  max: number;
  fmt: (v: number) => string;
}): React.JSX.Element {
  const W = 480;
  const H = 220;
  const padLeft = 44;
  const padBottom = 28;
  const padTop = 12;
  const plotW = W - padLeft - 8;
  const plotH = H - padBottom - padTop;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const step = plotW / rows.length;
  const barW = Math.min(48, step * 0.6);

  return (
    <svg
      className="st-chart__canvas"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Bar chart: ${rows
        .map((r) => `${r.label} ${fmt(r.value)}`)
        .join(', ')}`}
      style={{ height: H }}
    >
      {/* Horizontal gridlines + Y ticks */}
      {ticks.map((t) => {
        const y = padTop + plotH - t * plotH;
        return (
          <g key={t}>
            <line
              className="st-chart__grid"
              x1={padLeft}
              y1={y}
              x2={W - 8}
              y2={y}
            />
            <text
              className="st-chart__tick"
              x={padLeft - 6}
              y={y + 3}
              textAnchor="end"
            >
              {compactTick(max * t)}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {rows.map((r, i) => {
        const h = max > 0 ? (r.value / max) * plotH : 0;
        const x = padLeft + i * step + (step - barW) / 2;
        const y = padTop + plotH - h;
        return (
          <g key={r.key}>
            <rect
              className="st-chart__bar"
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, r.value > 0 ? 2 : 0)}
              rx={3}
              fill={categoryColor(i)}
            >
              <title>{`${r.label}: ${fmt(r.value)}`}</title>
            </rect>
            <text
              className="st-chart__tick"
              x={padLeft + i * step + step / 2}
              y={H - padBottom + 16}
              textAnchor="middle"
            >
              {truncate(r.label, 9)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HorizontalBars({
  rows,
  max,
  fmt,
}: {
  rows: ChartRow[];
  max: number;
  fmt: (v: number) => string;
}): React.JSX.Element {
  const rowH = 30;
  const gap = 8;
  const labelW = 110;
  const valueW = 64;
  const W = 480;
  const plotW = W - labelW - valueW;
  const H = rows.length * (rowH + gap) + gap;

  return (
    <svg
      className="st-chart__canvas"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Bar chart: ${rows
        .map((r) => `${r.label} ${fmt(r.value)}`)
        .join(', ')}`}
      style={{ height: H }}
    >
      {rows.map((r, i) => {
        const y = gap + i * (rowH + gap);
        const w = max > 0 ? (r.value / max) * plotW : 0;
        return (
          <g key={r.key}>
            <text
              className="st-chart__tick"
              x={labelW - 8}
              y={y + rowH / 2 + 3}
              textAnchor="end"
            >
              {truncate(r.label, 14)}
            </text>
            {/* Track */}
            <rect
              className="st-chart__grid"
              x={labelW}
              y={y}
              width={plotW}
              height={rowH}
              rx={3}
              fill="var(--st-bg-secondary)"
              stroke="none"
            />
            {/* Fill */}
            <rect
              className="st-chart__bar"
              x={labelW}
              y={y}
              width={Math.max(w, r.value > 0 ? 2 : 0)}
              height={rowH}
              rx={3}
              fill={categoryColor(i)}
            >
              <title>{`${r.label}: ${fmt(r.value)}`}</title>
            </rect>
            <text
              className="st-chart__bar-value"
              x={labelW + plotW + valueW - 4}
              y={y + rowH / 2 + 3}
              textAnchor="end"
            >
              {fmt(r.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ========================================================================== */
/* TwentyLineChart                                                            */
/* ========================================================================== */

export interface TwentyLineChartProps {
  /** timeSeries result; `undefined` renders a skeleton. */
  data: TimeSeriesResult | undefined;
  /** Panel title. */
  title: string;
  /** Optional description. */
  description?: string;
  /** Draw the soft area beneath the line. Default true. */
  showArea?: boolean;
}

function formatAxisDate(dateStr: string, interval: TimeInterval): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  if (interval === 'month') {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    });
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Native Twenty line/area chart for time-series analytics, drawn with inline
 * SVG + `--st-*` tokens.
 */
export function TwentyLineChart({
  data,
  title,
  description,
  showArea = true,
}: TwentyLineChartProps): React.JSX.Element {
  if (data === undefined) {
    return (
      <ChartPanel title={title} description={description}>
        <ChartSkeleton />
      </ChartPanel>
    );
  }

  const points = data.points;
  if (points.length === 0) {
    return (
      <ChartPanel title={title} description={description}>
        <ChartState message="No data for this period." />
      </ChartPanel>
    );
  }

  const W = 480;
  const H = 220;
  const padLeft = 40;
  const padBottom = 26;
  const padTop = 12;
  const plotW = W - padLeft - 8;
  const plotH = H - padBottom - padTop;

  const max = niceMax(points.reduce((m, p) => Math.max(m, p.count), 0));
  const n = points.length;
  const xOf = (i: number): number =>
    n === 1 ? padLeft + plotW / 2 : padLeft + (i / (n - 1)) * plotW;
  const yOf = (v: number): number =>
    padTop + plotH - (max > 0 ? (v / max) * plotH : 0);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(p.count).toFixed(1)}`)
    .join(' ');
  const areaPath =
    `${linePath} L ${xOf(n - 1).toFixed(1)} ${padTop + plotH} ` +
    `L ${xOf(0).toFixed(1)} ${padTop + plotH} Z`;

  const ticks = [0, 0.5, 1];
  // Thin x labels so they never overlap.
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <ChartPanel title={title} description={description}>
      <div className="st-chart">
        <p className="st-chart__desc" style={{ margin: 0 }}>
          {data.total.toLocaleString()} record{data.total !== 1 ? 's' : ''} total
        </p>
        <svg
          className="st-chart__canvas"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Line chart: ${data.total} records over ${n} ${data.interval} buckets`}
          style={{ height: H }}
        >
          {ticks.map((t) => {
            const y = padTop + plotH - t * plotH;
            return (
              <g key={t}>
                <line
                  className="st-chart__grid"
                  x1={padLeft}
                  y1={y}
                  x2={W - 8}
                  y2={y}
                />
                <text
                  className="st-chart__tick"
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                >
                  {compactTick(max * t)}
                </text>
              </g>
            );
          })}
          {showArea ? <path className="st-chart__area" d={areaPath} /> : null}
          <path className="st-chart__line" d={linePath} />
          {points.map((p, i) => (
            <circle
              key={p.date}
              className="st-chart__dot"
              cx={xOf(i)}
              cy={yOf(p.count)}
              r={2.5}
            >
              <title>{`${formatAxisDate(p.date, data.interval)}: ${p.count.toLocaleString()}`}</title>
            </circle>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text
                key={`lbl-${p.date}`}
                className="st-chart__tick"
                x={xOf(i)}
                y={H - padBottom + 16}
                textAnchor="middle"
              >
                {formatAxisDate(p.date, data.interval)}
              </text>
            ) : null,
          )}
        </svg>
        <div className="st-chart__sr">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{formatAxisDate(p.date, data.interval)}</td>
                  <td>{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartPanel>
  );
}

/* ========================================================================== */
/* TwentyDonutChart                                                           */
/* ========================================================================== */

export interface TwentyDonutChartProps {
  /** Object slug to aggregate (e.g. `opportunities`). */
  object: string;
  /** Field key whose values form the distribution. */
  fieldKey: string;
  /** Panel title. */
  title: string;
  /** Optional description. */
  description?: string;
  /** Active project override forwarded to the server action. */
  projectId?: string;
  /** Donut hole (true) vs full pie (false). Default true. */
  showCenter?: boolean;
  /** Max slices before the tail collapses into "(other)". Default 6. */
  maxSlices?: number;
}

function pct(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

/** Polar → cartesian for arc maths. */
function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** Build an SVG donut/pie arc path between two angles. */
function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
): string {
  // Guard a full circle (single 100% slice) — a 360° arc collapses, so split.
  if (end - start >= 359.999) {
    const mid = start + 180;
    return (
      arcPath(cx, cy, rOuter, rInner, start, mid) +
      ' ' +
      arcPath(cx, cy, rOuter, rInner, mid, end)
    );
  }
  const [sx, sy] = polar(cx, cy, rOuter, end);
  const [ex, ey] = polar(cx, cy, rOuter, start);
  const [isx, isy] = polar(cx, cy, rInner, start);
  const [iex, iey] = polar(cx, cy, rInner, end);
  const largeArc = end - start <= 180 ? 0 : 1;
  if (rInner <= 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${ex} ${ey}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${sx} ${sy}`,
      'Z',
    ].join(' ');
  }
  return [
    `M ${sx} ${sy}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${ex} ${ey}`,
    `L ${isx} ${isy}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${iex} ${iey}`,
    'Z',
  ].join(' ');
}

/**
 * Native Twenty donut (or pie) distribution chart. Self-fetches via
 * `runAnalyticsAction({ kind: 'countByField', ... })` (gated behind
 * `sabcrm:view`) and renders inline SVG arcs + a legend, all in `--st-*`.
 */
export function TwentyDonutChart({
  object,
  fieldKey,
  title,
  description,
  projectId,
  showCenter = true,
  maxSlices = 6,
}: TwentyDonutChartProps): React.JSX.Element {
  const [result, setResult] = React.useState<CountByFieldResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void runAnalyticsAction({ kind: 'countByField', object, fieldKey }, projectId)
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (!res.ok) {
          setError(res.error);
          setResult(null);
          return;
        }
        setResult(res.data as CountByFieldResult);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setError('This chart could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [object, fieldKey, projectId]);

  const rows = React.useMemo<ChartRow[]>(
    () => (result ? rowsFromCount(result, maxSlices) : []),
    [result, maxSlices],
  );
  const total = rows.reduce((acc, r) => acc + r.value, 0);

  if (loading) {
    return (
      <ChartPanel title={title} description={description}>
        <ChartSkeleton />
      </ChartPanel>
    );
  }
  if (error) {
    return (
      <ChartPanel title={title} description={description}>
        <ChartState message={error} />
      </ChartPanel>
    );
  }
  if (rows.length === 0 || total === 0) {
    return (
      <ChartPanel title={title} description={description}>
        <ChartState message="No records match the selected field." />
      </ChartPanel>
    );
  }

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = showCenter ? rOuter * 0.6 : 0;

  let angle = 0;
  const arcs = rows.map((r, i) => {
    const sweep = (r.value / total) * 360;
    const d = arcPath(cx, cy, rOuter, rInner, angle, angle + sweep);
    angle += sweep;
    return { d, color: categoryColor(i), row: r };
  });

  return (
    <ChartPanel title={title} description={description}>
      <div className="st-chart">
        <div className="st-chart__donut-wrap">
          <div
            className="st-chart__donut"
            style={{ width: size, height: size }}
          >
            <svg
              viewBox={`0 0 ${size} ${size}`}
              width={size}
              height={size}
              role="img"
              aria-label={`Donut chart: ${rows
                .map((r) => `${r.label} ${pct(r.value, total)}`)
                .join(', ')}`}
            >
              {arcs.map((a) => (
                <path
                  key={a.row.key}
                  className="st-chart__slice"
                  d={a.d}
                  fill={a.color}
                >
                  <title>{`${a.row.label}: ${a.row.value.toLocaleString()} (${pct(
                    a.row.value,
                    total,
                  )})`}</title>
                </path>
              ))}
            </svg>
            {showCenter ? (
              <div className="st-chart__donut-center" aria-hidden="true">
                <span className="st-chart__donut-total">
                  {total.toLocaleString()}
                </span>
                <span className="st-chart__donut-total-label">total</span>
              </div>
            ) : null}
          </div>
          <ul
            className="st-chart__legend"
            aria-label={`${title} distribution`}
          >
            {rows.map((r, i) => (
              <li key={r.key} className="st-chart__legend-item">
                <span
                  className="st-chart__legend-swatch"
                  style={{ background: categoryColor(i) }}
                  aria-hidden="true"
                />
                <span className="st-chart__legend-label">{r.label}</span>
                <span className="st-chart__legend-value">
                  {r.value.toLocaleString()}
                </span>
                <span className="st-chart__legend-pct">
                  {pct(r.value, total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ChartPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen-reader data table (shared)                                          */
/* -------------------------------------------------------------------------- */

function SrTable({
  title,
  rows,
  fmt,
}: {
  title: string;
  rows: ChartRow[];
  fmt: (v: number) => string;
}): React.JSX.Element {
  return (
    <div className="st-chart__sr" role="region" aria-label={`${title} data table`}>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
