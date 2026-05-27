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
} from 'recharts';

/* ─── LateStackedChart ───────────────────────────────────────────────── */

export interface LateStackedDatum {
  month: string;
  task: number;
  project: number;
  invoice: number;
}

export function LateStackedChart({ data }: { data: LateStackedDatum[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-zoru-ink-muted">
        No data.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="task" stackId="a" fill="#f59e0b" name="Tasks" radius={[0, 0, 0, 0]} />
        <Bar dataKey="project" stackId="a" fill="#0ea5e9" name="Projects" radius={[0, 0, 0, 0]} />
        <Bar dataKey="invoice" stackId="a" fill="#ef4444" name="Invoices" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─── RagBarChart ────────────────────────────────────────────────────── */

export interface RagDatum {
  rag: string;
  count: number;
}

const RAG_COLORS: Record<string, string> = {
  'on-track': '#10b981',
  'at-risk': '#f59e0b',
  blocked: '#ef4444',
};

export function RagBarChart({ data }: { data: RagDatum[] }) {
  if (!data.length || data.every((d) => d.count === 0)) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-zoru-ink-muted">
        No data.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="rag" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="count"
          name="Projects"
          radius={[4, 4, 0, 0]}
          fill="#10b981"
          label={false}
        >
          {data.map((entry) => (
            <rect key={entry.rag} fill={RAG_COLORS[entry.rag] ?? '#6b7280'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─── VelocityLineChart ──────────────────────────────────────────────── */

export interface VelocityDatum {
  month: string;
  completed: number;
}

export function VelocityLineChart({ data }: { data: VelocityDatum[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-zoru-ink-muted">
        No data.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="completed"
          name="Tasks completed"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
