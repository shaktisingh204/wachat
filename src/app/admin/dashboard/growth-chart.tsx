"use client";

import React from "react";
import {
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
} from "@/components/zoruui";

const data = [
  { date: "Jan", users: 400, revenue: 2400 },
  { date: "Feb", users: 800, revenue: 4398 },
  { date: "Mar", users: 1200, revenue: 6800 },
  { date: "Apr", users: 1780, revenue: 9908 },
  { date: "May", users: 2190, revenue: 14800 },
  { date: "Jun", users: 2890, revenue: 18800 },
  { date: "Jul", users: 3490, revenue: 24300 },
];

export function GrowthChart() {
  return (
    <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--st-text)]">
          Platform Growth
        </h2>
        <p className="text-sm text-[var(--st-text-secondary)]">
          Users and Revenue over the last 7 months
        </p>
      </div>
      <ZoruChartContainer height={300}>
        <ZoruChart.LineChart
          data={data}
          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
        >
          <ZoruChart.CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--st-border)"
          />
          <ZoruChart.XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--st-text-secondary)" }}
            dy={10}
          />
          <ZoruChart.YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--st-text-secondary)" }}
          />
          <ZoruChart.YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--st-text-secondary)" }}
          />
          <ZoruChart.Tooltip
            content={<ZoruChartTooltip />}
            cursor={{ stroke: "var(--st-border-strong)" }}
          />
          <ZoruChart.Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
          />
          <ZoruChart.Line
            yAxisId="left"
            type="monotone"
            dataKey="users"
            name="Users"
            stroke={ZORU_CHART_PALETTE[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <ZoruChart.Line
            yAxisId="right"
            type="monotone"
            dataKey="revenue"
            name="Revenue ($)"
            stroke={ZORU_CHART_PALETTE[2]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ZoruChart.LineChart>
      </ZoruChartContainer>
    </div>
  );
}
