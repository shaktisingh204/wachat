'use client';

/**
 * ChartAiUsage — stacked bar chart for daily AI calls broken down by kind
 * (suggest, summarise, translate).
 */

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Sparkles } from 'lucide-react';

import type { SabwaAnalyticsAiDay } from '@/app/actions/sabwa.actions';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

export interface ChartAiUsageProps {
  data: SabwaAnalyticsAiDay[];
}

export function ChartAiUsage({ data }: ChartAiUsageProps) {
  if (!data.length) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No AI calls yet"
        description="AI usage by day will appear here once you start using suggest, summarise, or translate."
      />
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
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
          <Bar
            dataKey="suggest"
            stackId="ai"
            name="Suggest"
            fill="#8b5cf6"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="summarise"
            stackId="ai"
            name="Summarise"
            fill="#06b6d4"
          />
          <Bar
            dataKey="translate"
            stackId="ai"
            name="Translate"
            fill="#f97316"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
