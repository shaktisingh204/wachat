'use client';

import { CHART_PALETTE, Recharts, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui';
import {
  Sparkles } from 'lucide-react';

import type { SabwaAnalyticsAiDay } from '@/app/actions/sabwa.actions.types';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

/**
 * ChartAiUsage — stacked bar chart for daily AI calls broken down by kind
 * (suggest, summarise, translate). Greyscale palette via Recharts.
 */

import * as React from 'react';

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
          dataKey="date"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Recharts.YAxis fontSize={11} tickLine={false} axisLine={false} />
        <Recharts.Tooltip content={<ChartTooltip />} />
        <Recharts.Legend wrapperStyle={{ fontSize: 12 }} />
        <Recharts.Bar
          dataKey="suggest"
          stackId="ai"
          name="Suggest"
          fill={CHART_PALETTE[0]}
        />
        <Recharts.Bar
          dataKey="summarise"
          stackId="ai"
          name="Summarise"
          fill={CHART_PALETTE[1]}
        />
        <Recharts.Bar
          dataKey="translate"
          stackId="ai"
          name="Translate"
          fill={CHART_PALETTE[2]}
          radius={[3, 3, 0, 0]}
        />
      </Recharts.BarChart>
    </ChartContainer>
  );
}
