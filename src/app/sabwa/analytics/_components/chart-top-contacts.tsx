'use client';

import { CHART_PALETTE, Recharts, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui';
import {
  Users } from 'lucide-react';

import type { SabwaAnalyticsTopContact } from '@/app/actions/sabwa.actions.types';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

/**
 * ChartTopContacts — horizontal-style bar chart for top contacts by volume.
 * Greyscale palette via Recharts.
 */

import * as React from 'react';

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
    <ChartContainer height={288}>
      <Recharts.BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
      >
        <Recharts.CartesianGrid
          strokeDasharray="3 3"
          className="stroke-[var(--st-border)]"
        />
        <Recharts.XAxis
          type="number"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Recharts.YAxis
          type="category"
          dataKey="label"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Recharts.Tooltip content={<ChartTooltip />} />
        <Recharts.Bar
          dataKey="count"
          fill={CHART_PALETTE[0]}
          radius={[0, 4, 4, 0]}
        />
      </Recharts.BarChart>
    </ChartContainer>
  );
}
