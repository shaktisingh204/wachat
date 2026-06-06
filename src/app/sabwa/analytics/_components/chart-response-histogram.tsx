'use client';

import { ZORU_CHART_PALETTE, ZoruChart, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui/compat';
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
      <ZoruChart.BarChart
        data={data}
        margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
      >
        <ZoruChart.CartesianGrid
          strokeDasharray="3 3"
          className="stroke-[var(--st-border)]"
        />
        <ZoruChart.XAxis
          dataKey="bucket"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <ZoruChart.YAxis fontSize={11} tickLine={false} axisLine={false} />
        <ZoruChart.Tooltip content={<ChartTooltip />} />
        <ZoruChart.Bar
          dataKey="count"
          fill={ZORU_CHART_PALETTE[0]}
          radius={[4, 4, 0, 0]}
        />
      </ZoruChart.BarChart>
    </ChartContainer>
  );
}
