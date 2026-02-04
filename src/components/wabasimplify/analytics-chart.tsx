'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartTooltipContent, ChartTooltip, ChartContainer, ChartConfig } from '@/components/ui/chart';

export interface AnalyticsChartProps {
  data: {
    date: string;
    sent: number;
    delivered: number;
    read: number;
  }[];
}

const chartConfig = {
  sent: {
    label: 'Sent',
    color: 'hsl(var(--chart-1))',
  },
  delivered: {
    label: 'Delivered',
    color: 'hsl(var(--chart-2))',
  },
  read: {
    label: 'Read',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

export function AnalyticsChart({ data }: AnalyticsChartProps) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => value}
          />
          <YAxis />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="sent" fill="var(--color-sent)" radius={4} />
          <Bar dataKey="delivered" fill="var(--color-delivered)" radius={4} />
          <Bar dataKey="read" fill="var(--color-read)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
