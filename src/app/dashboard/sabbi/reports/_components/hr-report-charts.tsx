'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const PIE_COLORS = [
  'hsl(var(--primary))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

/* ─── Horizontal bar — agents by leads/revenue ───────────────────────── */

export interface HorizontalBarDatum {
  label: string;
  value: number;
  secondary?: number;
}

export function HorizontalBarChart({
  data,
  primaryKey = 'value',
  primaryName = 'Value',
  secondaryKey,
  secondaryName,
  height = 320,
}: {
  data: HorizontalBarDatum[];
  primaryKey?: 'value' | 'secondary';
  primaryName?: string;
  secondaryKey?: 'value' | 'secondary';
  secondaryName?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
        No data.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 60, right: 16 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          horizontal={false}
        />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey={primaryKey}
          name={primaryName}
          fill="hsl(var(--primary))"
          radius={[0, 4, 4, 0]}
        />
        {secondaryKey ? (
          <Bar
            dataKey={secondaryKey}
            name={secondaryName ?? 'Secondary'}
            fill="#10b981"
            radius={[0, 4, 4, 0]}
          />
        ) : null}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─── Daily attendance line ───────────────────────────────────────────── */

export interface DailyAttendanceDatum {
  date: string; // 'YYYY-MM-DD'
  present: number;
  absent: number;
  leave: number;
}

export function DailyAttendanceChart({
  data,
  height = 280,
}: {
  data: DailyAttendanceDatum[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
        No attendance recorded.
      </div>
    );
  }
  // Compress label to DD for x-axis density
  const formatted = data.map((d) => ({
    ...d,
    day: d.date.slice(-2),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted} margin={{ left: 4, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
          labelFormatter={(label) => `Day ${label}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="present"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          name="Present"
        />
        <Line
          type="monotone"
          dataKey="absent"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          name="Absent"
        />
        <Line
          type="monotone"
          dataKey="leave"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={false}
          name="Leave"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ─── Pie of leaves by type ───────────────────────────────────────────── */

export interface CategoryDatum {
  label: string;
  value: number;
}

export function CategoryPieChart({
  data,
  height = 280,
}: {
  data: CategoryDatum[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
        No data.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={40}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ─── Monthly trend line (leave) ──────────────────────────────────────── */

export interface MonthlyTrendDatum {
  period: string;
  days: number;
}

export function MonthlyTrendChart({
  data,
  label = 'Days',
  height = 240,
}: {
  data: MonthlyTrendDatum[];
  label?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
        No data.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 4, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="days"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot
          name={label}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ─── Stacked bar — leave types per employee ──────────────────────────── */

export type StackedDatum = Record<string, string | number>;

export function StackedBarChart({
  data,
  keys,
  height = 360,
}: {
  data: StackedDatum[];
  keys: string[];
  height?: number;
}) {
  if (data.length === 0 || keys.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
        No data.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 16 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          horizontal={false}
        />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            name={k}
            stackId="a"
            fill={PIE_COLORS[i % PIE_COLORS.length]}
            radius={i === keys.length - 1 ? [0, 4, 4, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
