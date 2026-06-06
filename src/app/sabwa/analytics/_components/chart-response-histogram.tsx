'use client';

import { CHART_PALETTE, Recharts, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui';
import {
  Timer } from 'lucide-react';

import type { SabwaAnalyticsHistogramBin } from '@/app/actions/sabwa.actions.types';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

/**
 * ChartResponseHistogram — bar chart of response-time buckets. Greyscale.
 */

import * as React from 'react';

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
    <ChartContainer height={288}>
      <Recharts.BarChart
        data={data}
        margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
      >
        <Recharts.CartesianGrid
          strokeDasharray="3 3"
          className="stroke-[var(--st-border)]"
        />
        <Recharts.XAxis
          dataKey="bucket"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Recharts.YAxis fontSize={11} tickLine={false} axisLine={false} />
        <Recharts.Tooltip content={<ChartTooltip />} />
        <Recharts.Bar
          dataKey="count"
          fill={CHART_PALETTE[0]}
          radius={[4, 4, 0, 0]}
        />
      </Recharts.BarChart>
    </ChartContainer>
  );
}
