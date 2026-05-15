'use client';

/**
 * ChartResponseHistogram — bar chart of response-time buckets.
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
import { Timer } from 'lucide-react';

import type { SabwaAnalyticsHistogramBin } from '@/app/actions/sabwa.actions';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

export interface ChartResponseHistogramProps {
  data: SabwaAnalyticsHistogramBin[];
}

export function ChartResponseHistogram({ data }: ChartResponseHistogramProps) {
  if (!data.length) {
    return (
      <EmptyState
        icon={Timer}
        title="No response-time data"
        description="We'll plot how quickly you reply once enough conversations have completed a round-trip."
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
            dataKey="bucket"
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
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
