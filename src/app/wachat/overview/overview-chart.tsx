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
      <div
        className="flex h-[300px] items-center justify-center text-sm"
        style={{ color: 'var(--st-text-secondary)' }}
      >
        No chart data available
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full text-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
            tickFormatter={(val) => {
              const d = new Date(val);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'var(--st-bg)',
              borderColor: 'var(--st-border)',
              borderRadius: 'var(--st-radius-sm)',
              boxShadow: 'var(--st-shadow-sm)',
              color: 'var(--st-text)',
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="sent"
            name="Sent"
            stroke="var(--st-accent)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="delivered"
            name="Delivered"
            stroke="var(--st-status-ok)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="read"
            name="Read"
            stroke="var(--st-warn)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
