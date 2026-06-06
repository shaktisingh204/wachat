'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

export function SalesLineChart({ lineData }: { lineData: any[] }) {
  if (lineData.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
        No closed deals in this range.
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <LineChart
          data={lineData}
          margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="period"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="Won"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="Lost"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesPieChart({ pieData }: { pieData: any[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClick = (entry: any) => {
    if (!entry || !entry.name) return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get('stage') === entry.name) {
      params.delete('stage');
    } else {
      params.set('stage', entry.name);
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  if (pieData.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
        No deals.
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            outerRadius={80}
            label={(d: { name?: string }) => d.name ?? ''}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            {pieData.map((_, i) => (
              <Cell
                key={`pie-${i}`}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
