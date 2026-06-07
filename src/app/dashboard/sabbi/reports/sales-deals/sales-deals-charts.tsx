'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LineChart as LineChartIcon, PieChart as PieChartIcon } from 'lucide-react';
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
import { EmptyState } from '@/components/sabcrm/20ui';

const PIE_COLORS = [
  'var(--st-accent)',
  'var(--st-status-ok)',
  'var(--st-warn)',
  'var(--st-danger)',
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

const TOOLTIP_STYLE = {
  background: 'var(--st-bg)',
  border: '1px solid var(--st-border)',
  borderRadius: 'var(--st-radius)',
  fontSize: 12,
} as const;

export function SalesLineChart({ lineData }: { lineData: any[] }) {
  if (lineData.length === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="No closed deals in this range"
        description="Adjust the date filter to see won and lost deals over time."
        size="sm"
      />
    );
  }
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <LineChart
          data={lineData}
          margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
          <XAxis
            dataKey="period"
            stroke="var(--st-text-secondary)"
            fontSize={11}
          />
          <YAxis stroke="var(--st-text-secondary)" fontSize={11} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="Won"
            stroke="var(--st-status-ok)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="Lost"
            stroke="var(--st-danger)"
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
      <EmptyState
        icon={PieChartIcon}
        title="No deals yet"
        description="Deals will appear here grouped by stage once you start adding them."
        size="sm"
      />
    );
  }
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            outerRadius={80}
            label={(d: { name?: string }) => d.name ?? ''}
            onClick={handleClick}
            className="cursor-pointer"
          >
            {pieData.map((_, i) => (
              <Cell
                key={`pie-${i}`}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
