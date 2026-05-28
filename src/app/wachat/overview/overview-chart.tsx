'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type ChartPoint = {
  date: string;
  sent: number;
  delivered: number;
  read: number;
};

export default function OverviewChart({ data }: { data: ChartPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-zoru-ink-muted">
        No chart data available
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full text-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--zoru-line))" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 12 }}
            tickFormatter={(val) => {
              const d = new Date(val);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--zoru-surface))', 
              borderColor: 'hsl(var(--zoru-line))',
              borderRadius: 'var(--zoru-radius-sm)',
              boxShadow: 'var(--zoru-shadow-sm)'
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="sent"
            name="Sent"
            stroke="hsl(var(--zoru-info))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="delivered"
            name="Delivered"
            stroke="hsl(var(--zoru-success))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="read"
            name="Read"
            stroke="hsl(var(--zoru-warning))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
