'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartTooltipContent, ChartTooltip, ChartContainer, ChartConfig } from '@/components/ui/chart';

const chartData = [
  { month: 'January', sent: 186, delivered: 180, read: 150 },
  { month: 'February', sent: 305, delivered: 295, read: 220 },
  { month: 'March', sent: 237, delivered: 230, read: 200 },
  { month: 'April', sent: 273, delivered: 265, read: 230 },
  { month: 'May', sent: 209, delivered: 200, read: 180 },
  { month: 'June', sent: 214, delivered: 210, read: 195 },
];

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

export function AnalyticsChart() {
  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => value.slice(0, 3)}
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
