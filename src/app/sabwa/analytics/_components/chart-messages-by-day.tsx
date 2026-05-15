'use client';

/**
 * ChartMessagesByDay — line chart showing inbound vs outbound messages by day.
 * Falls back to <EmptyState> when there is no data.
 */

import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { MessageSquare } from 'lucide-react';

import type { SabwaAnalyticsSeriesPoint } from '@/app/actions/sabwa.actions';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

export interface ChartMessagesByDayProps {
  data: SabwaAnalyticsSeriesPoint[];
}

export function ChartMessagesByDay({ data }: ChartMessagesByDayProps) {
  if (!data.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No messages yet"
        description="Inbound and outbound volume will appear here once your session starts moving traffic."
      />
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              fontSize: 12,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--popover))',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="in"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            name="Inbound"
          />
          <Line
            type="monotone"
            dataKey="out"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            name="Outbound"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
