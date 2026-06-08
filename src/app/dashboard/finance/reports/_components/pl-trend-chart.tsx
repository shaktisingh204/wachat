'use client';

import * as React from 'react';
import {
  Recharts,
  ChartContainer,
  ChartTooltipContent,
  CHART_PALETTE,
  type ChartConfig,
} from '@/components/sabcrm/20ui';

/** Monthly revenue vs expenses for the current financial year (₹ thousands). */
const SERIES = [
  { month: 'Apr', revenue: 286, expenses: 198 },
  { month: 'May', revenue: 312, expenses: 207 },
  { month: 'Jun', revenue: 298, expenses: 241 },
  { month: 'Jul', revenue: 341, expenses: 233 },
  { month: 'Aug', revenue: 372, expenses: 256 },
  { month: 'Sep', revenue: 405, expenses: 268 },
];

const CONFIG: ChartConfig = {
  revenue: { label: 'Revenue', color: CHART_PALETTE[0] },
  expenses: { label: 'Expenses', color: CHART_PALETTE[2] },
};

export function PlTrendChart(): React.JSX.Element {
  return (
    <ChartContainer config={CONFIG} className="h-[300px] w-full">
      <Recharts.BarChart data={SERIES} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <Recharts.CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-[var(--st-border)]" />
        <Recharts.XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
        <Recharts.YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => `₹${v}k`}
        />
        <Recharts.Tooltip cursor={{ fill: 'var(--st-bg-muted)' }} content={<ChartTooltipContent />} />
        <Recharts.Legend />
        <Recharts.Bar dataKey="revenue" fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
        <Recharts.Bar dataKey="expenses" fill={CHART_PALETTE[2]} radius={[4, 4, 0, 0]} />
      </Recharts.BarChart>
    </ChartContainer>
  );
}
