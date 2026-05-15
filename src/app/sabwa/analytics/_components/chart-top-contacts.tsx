'use client';

/**
 * ChartTopContacts — horizontal-style bar chart for top contacts by volume.
 */

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Users } from 'lucide-react';

import type { SabwaAnalyticsTopContact } from '@/app/actions/sabwa.actions';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

export interface ChartTopContactsProps {
  data: SabwaAnalyticsTopContact[];
}

export function ChartTopContacts({ data }: ChartTopContactsProps) {
  if (!data.length) {
    return (
      <EmptyState
        icon={Users}
        title="No contact activity yet"
        description="Your most-active contacts will appear here once you exchange messages."
      />
    );
  }
  const chartData = data.map((c) => ({
    label: c.name ?? c.jid.split('@')[0],
    count: c.count,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              fontSize: 12,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--popover))',
            }}
          />
          <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
