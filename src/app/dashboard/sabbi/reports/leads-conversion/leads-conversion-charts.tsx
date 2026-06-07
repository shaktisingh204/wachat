'use client';

import * as React from 'react';
import { BarChart3 } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  EmptyState,
  Recharts,
  type ChartConfig,
} from '@/components/sabcrm/20ui';

const { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } = Recharts;

const chartConfig: ChartConfig = {
  count: {
    label: 'Leads',
    color: 'var(--st-accent)',
  },
};

export function LeadsBarChart({ chartData }: { chartData: any[] }) {
  if (chartData.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No leads in this range"
        description="Adjust the date range or filters to see conversion stages here."
        size="sm"
      />
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-80 w-full">
      <BarChart data={chartData} margin={{ left: 8, right: 16, top: 16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
        <XAxis dataKey="stage" stroke="var(--st-text-secondary)" fontSize={11} />
        <YAxis stroke="var(--st-text-secondary)" fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey="label"
            position="top"
            fill="var(--st-text-secondary)"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
