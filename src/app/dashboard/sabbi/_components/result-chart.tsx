'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import type { BiChartRunResponse } from '@/lib/rust-client/bi-charts';

export type ResultChartType =
  | 'table'
  | 'bar'
  | 'stacked'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'kpi';

const PALETTE = [
  'var(--st-accent)',
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
];

type Row = Record<string, unknown>;
/** measure key → format hint (currency | percent | number | duration). */
export type Formats = Record<string, string | undefined>;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Format a numeric value per its measure's format hint. */
export function formatValue(v: unknown, fmt?: string): string {
  if (v == null) return '—';
  if (typeof v !== 'number') return String(v);
  switch (fmt) {
    case 'percent':
      return `${(v <= 1 && v >= -1 ? v * 100 : v).toFixed(1)}%`;
    case 'duration':
      return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
    case 'currency':
      return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    default:
      return v.toLocaleString();
  }
}

function roleKeys(result: BiChartRunResponse, role: 'dimension' | 'measure'): string[] {
  const fromCols = (result.columns ?? []).filter((c) => c.role === role).map((c) => c.key);
  if (fromCols.length > 0) return fromCols;
  const first = result.rows[0] as Row | undefined;
  if (!first) return [];
  const keys = Object.keys(first);
  return role === 'measure'
    ? keys.filter((k) => typeof first[k] === 'number')
    : keys.filter((k) => typeof first[k] !== 'number');
}

export function ResultChart({
  result,
  type,
  formats = {},
  height = 320,
  onPick,
}: {
  result: BiChartRunResponse;
  type: ResultChartType;
  formats?: Formats;
  height?: number;
  /** Cross-filter: fired with the dimension column + clicked value on bar/pie. */
  onPick?: (column: string, value: string) => void;
}) {
  const rows = result.rows as Row[];
  if (!rows || rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-[var(--st-text-secondary)]">
        No rows.
      </div>
    );
  }

  const dimKeys = roleKeys(result, 'dimension');
  const measKeys = roleKeys(result, 'measure');
  const xKey = dimKeys[0];
  const fmtFor = (k: string) => formats[k];

  const pickFromBar = (d: unknown) => {
    if (!onPick || !xKey) return;
    const row = ((d as { payload?: Row } | undefined)?.payload ?? (d as Row | undefined)) ?? {};
    const v = row[xKey];
    if (v != null) onPick(xKey, String(v));
  };
  const pickFromPie = (d: unknown) => {
    if (!onPick || !xKey) return;
    const name = (d as { name?: unknown } | undefined)?.name;
    if (name != null) onPick(xKey, String(name));
  };
  const tooltipFmt = (value: unknown, name: unknown): [string, string] => [
    formatValue(value, fmtFor(String(name))),
    String(name),
  ];

  if (type === 'kpi') {
    const mk = measKeys[0];
    const total = rows.reduce((a, r) => a + num(r[mk]), 0);
    return (
      <div className="flex flex-col gap-1 p-2">
        <span className="text-3xl font-semibold tabular-nums text-[var(--st-text)]">
          {formatValue(total, fmtFor(mk))}
        </span>
        <span className="text-sm text-[var(--st-text-secondary)]">{mk ?? 'value'}</span>
      </div>
    );
  }

  if (type === 'table' || !xKey || measKeys.length === 0) {
    const cols = Object.keys(rows[0]);
    return (
      <div className="overflow-auto">
        <Table>
          <THead>
            <Tr>
              {cols.map((c) => (
                <Th key={c} align="left">
                  {c}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {rows.slice(0, 100).map((r, i) => (
              <Tr key={i}>
                {cols.map((c) => (
                  <Td key={c}>{formatValue(r[c], fmtFor(c))}</Td>
                ))}
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    );
  }

  if (type === 'pie' || type === 'donut') {
    const mk = measKeys[0];
    const data = rows.map((r) => ({ name: String(r[xKey] ?? '—'), value: num(r[mk]) }));
    const outer = Math.min(height / 2 - 10, 130);
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={outer}
            innerRadius={type === 'donut' ? outer * 0.55 : 0}
            label
            onClick={pickFromPie}
            cursor={onPick ? 'pointer' : undefined}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: unknown) => formatValue(v, fmtFor(mk))} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const axisFmt = (v: number) => formatValue(v, fmtFor(measKeys[0]));

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--st-text-secondary)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--st-text-secondary)" tickFormatter={axisFmt} />
          <Tooltip formatter={tooltipFmt} />
          <Legend />
          {measKeys.map((mk, i) => (
            <Line key={mk} type="monotone" dataKey={mk} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--st-text-secondary)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--st-text-secondary)" tickFormatter={axisFmt} />
          <Tooltip formatter={tooltipFmt} />
          <Legend />
          {measKeys.map((mk, i) => (
            <Area
              key={mk}
              type="monotone"
              dataKey={mk}
              stroke={PALETTE[i % PALETTE.length]}
              fill={PALETTE[i % PALETTE.length]}
              fillOpacity={0.2}
              stackId={type === 'area' ? '1' : undefined}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // bar / stacked
  const stackId = type === 'stacked' ? 'a' : undefined;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--st-text-secondary)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--st-text-secondary)" tickFormatter={axisFmt} />
        <Tooltip formatter={tooltipFmt} />
        <Legend />
        {measKeys.map((mk, i) => (
          <Bar
            key={mk}
            dataKey={mk}
            stackId={stackId}
            fill={PALETTE[i % PALETTE.length]}
            radius={[3, 3, 0, 0]}
            onClick={pickFromBar}
            cursor={onPick ? 'pointer' : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
