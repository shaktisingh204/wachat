'use client';

import { ZORU_CHART_PALETTE, ZoruChart, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui/compat';
import {
  Sparkles } from 'lucide-react';

import type { SabwaAnalyticsAiDay } from '@/app/actions/sabwa.actions.types';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

/**
 * ChartAiUsage — stacked bar chart for daily AI calls broken down by kind
 * (suggest, summarise, translate). Greyscale palette via ZoruChart.
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
      <ZoruChart.BarChart
        data={data}
        margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
      >
        <ZoruChart.CartesianGrid
          strokeDasharray="3 3"
          className="stroke-[var(--st-border)]"
        />
        <ZoruChart.XAxis
          dataKey="date"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <ZoruChart.YAxis fontSize={11} tickLine={false} axisLine={false} />
        <ZoruChart.Tooltip content={<ChartTooltip />} />
        <ZoruChart.Legend wrapperStyle={{ fontSize: 12 }} />
        <ZoruChart.Bar
          dataKey="suggest"
          stackId="ai"
          name="Suggest"
          fill={ZORU_CHART_PALETTE[0]}
        />
        <ZoruChart.Bar
          dataKey="summarise"
          stackId="ai"
          name="Summarise"
          fill={ZORU_CHART_PALETTE[1]}
        />
        <ZoruChart.Bar
          dataKey="translate"
          stackId="ai"
          name="Translate"
          fill={ZORU_CHART_PALETTE[2]}
          radius={[3, 3, 0, 0]}
        />
      </ZoruChart.BarChart>
    </ChartContainer>
  );
}
