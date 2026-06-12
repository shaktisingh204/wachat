'use client';

/**
 * SabCRM — Report chart renderer (20ui).
 *
 * A single self-contained visualiser shared by the saved-reports run output
 * (`./page.tsx`) and the builder live preview (`./builder/page.tsx`). It
 * switches on the report's `chartType` hint and renders the same
 * {@link ReportDataSeries} shape five ways, all through the shared 20ui charts
 * composites (`@/components/sabcrm/20ui/composites/charts`):
 *
 *   - `bar`    → horizontal bands (BarChart, the improved default),
 *   - `line`   → trend line (LineChart),
 *   - `pie`    → distribution donut (DonutChart),
 *   - `number` → a single big metric tile,
 *   - `table`  → a clean 20ui label/value table.
 *
 * Behaviour degrades gracefully for empty series (an inline empty note) and
 * for ungrouped/single-value reports (which always collapse to the metric tile
 * regardless of the requested chart type).
 */

import * as React from 'react';

import {
  BarChart,
  LineChart,
  DonutChart,
  type ChartDatum,
} from '@/components/sabcrm/20ui/composites/charts';
import { Table, THead, TBody, TFoot, Tr, Th, Td } from '@/components/sabcrm/20ui';
import type {
  ReportDataSeries,
  ReportChartType,
} from '@/app/actions/sabcrm.actions.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOTAL_KEY = '__total__';

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

/** Map series rows into the generic `{ label, value, color? }` chart shape. */
function toChartData(series: ReportDataSeries): ChartDatum[] {
  return series.rows.map((row) => ({
    label: row.label,
    value: row.value,
    color: row.color,
  }));
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
    <div className="rp-metric">
      <span className="rp-metric__value">{formatReportValue(value)}</span>
      <span className="rp-metric__caption">{caption}</span>
    </div>
  );
}

function TableChart({ series }: { series: ReportDataSeries }): React.JSX.Element {
  const total = series.rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="rp-table-wrap">
      <Table density="compact">
        <THead>
          <Tr>
            <Th>Group</Th>
            <Th align="right">{series.metric === 'count' ? 'Count' : 'Value'}</Th>
            <Th align="right">Share</Th>
          </Tr>
        </THead>
        <TBody>
          {series.rows.map((r, i) => (
            <Tr key={r.key || i}>
              <Td>
                <span className="rp-table__label" title={r.label}>
                  {r.color ? (
                    <span
                      className="rp-table__dot"
                      style={{ background: r.color }}
                      aria-hidden="true"
                    />
                  ) : null}
                  {r.label}
                </span>
              </Td>
              <Td align="right">{formatReportValue(r.value)}</Td>
              <Td align="right">
                {total > 0 ? `${((r.value / total) * 100).toFixed(1)}%` : '—'}
              </Td>
            </Tr>
          ))}
        </TBody>
        {series.rows.length > 1 ? (
          <TFoot>
            <Tr>
              <Td>Total</Td>
              <Td align="right">{formatReportValue(total)}</Td>
              <Td align="right">100%</Td>
            </Tr>
          </TFoot>
        ) : null}
      </Table>
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
          <div className="rp-result-foot">
            <span>{series.recordCount} record(s) matched</span>
          </div>
        )}
      </div>
    );
  }

  const data = toChartData(series);

  let body: React.JSX.Element;
  switch (chartType) {
    case 'line':
      body = (
        <LineChart
          data={data}
          formatValue={formatReportValue}
          seriesLabel="Value"
          emptyLabel="No records matched the report filters."
        />
      );
      break;
    case 'pie':
      body = (
        <DonutChart
          data={data}
          formatValue={formatReportValue}
          emptyLabel="No positive values to chart."
        />
      );
      break;
    case 'table':
      body = <TableChart series={series} />;
      break;
    case 'bar':
    default:
      body = (
        <BarChart
          data={data}
          layout="horizontal"
          formatValue={formatReportValue}
          seriesLabel="Value"
          emptyLabel="No records matched the report filters."
        />
      );
      break;
  }

  return (
    <div>
      {body}
      {showFooter && (
        <div className="rp-result-foot">
          <span>
            {series.rows.length} group(s) · {series.recordCount} record(s) matched
          </span>
        </div>
      )}
    </div>
  );
}
