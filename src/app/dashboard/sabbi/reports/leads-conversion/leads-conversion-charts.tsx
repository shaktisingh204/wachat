'use client';

import * as React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

export function LeadsBarChart({ chartData }: { chartData: any[] }) {
  if (chartData.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
        No leads in this range.
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          margin={{ left: 8, right: 16, top: 16, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="stage"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="count"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          >
            <LabelList
              dataKey="label"
              position="top"
              fill="hsl(var(--muted-foreground))"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
