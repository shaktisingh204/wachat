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
      <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500">
        No chart data available
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full text-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717a', fontSize: 11 }}
            tickFormatter={(val) => {
              const d = new Date(val);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717a', fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderColor: '#e4e4e7',
              borderRadius: '12px',
              boxShadow: '0 10px 30px -12px rgba(0,0,0,0.12)',
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="sent" name="Sent" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="delivered" name="Delivered" stroke="#0ea5e9" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="read" name="Read" stroke="#a16207" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
