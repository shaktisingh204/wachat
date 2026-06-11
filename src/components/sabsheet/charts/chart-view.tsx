"use client";

/**
 * SabSheet charts — renderer.
 *
 * Draws a `ChartData` (categories + numeric series) as a bar / line / area / pie
 * chart using recharts via the 20ui chart primitives. The recharts namespace and
 * `ChartContainer` / `CHART_PALETTE` come from `@/components/sabcrm/20ui/chart`, so
 * charts stay on-system (token-styled tooltip + legend).
 */
import * as React from "react";

import {
  Recharts,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  CHART_PALETTE,
  type ChartConfig,
} from "@/components/sabcrm/20ui/chart";

import type { ChartSpec } from "@/lib/sabsheet/charts/types";
import { toRechartsRows, type ChartData } from "./chart-data.ts";

export interface ChartViewProps {
  spec: ChartSpec;
  data: ChartData;
  /** Optional explicit height (px). Defaults to 280. */
  height?: number;
}

function paletteColor(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length];
}

export function ChartView({ spec, data, height = 280 }: ChartViewProps) {
  const rows = React.useMemo(() => toRechartsRows(data), [data]);

  const config = React.useMemo<ChartConfig>(() => {
    const c: ChartConfig = {};
    data.series.forEach((s, i) => {
      c[s.name] = { label: s.name, color: paletteColor(i) };
    });
    return c;
  }, [data.series]);

  if (data.series.length === 0 || data.categories.length === 0) {
    return (
      <div style={emptyStyle} role="status">
        No chartable data in the selected range.
      </div>
    );
  }

  const {
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    CartesianGrid,
    XAxis,
    YAxis,
  } = Recharts;

  let chart: React.ReactElement;

  if (spec.type === "pie") {
    // Pie charts use the first series only — value-per-category.
    const first = data.series[0];
    const pieData = data.categories.map((category, i) => ({
      name: category,
      value: first?.values[i] ?? 0,
    }));
    chart = (
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="80%">
          {pieData.map((_, i) => (
            <Cell key={i} fill={paletteColor(i)} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
      </PieChart>
    );
  } else if (spec.type === "line") {
    chart = (
      <LineChart data={rows}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="__category" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {data.series.map((s) => (
          <Line
            key={s.name}
            type="monotone"
            dataKey={s.name}
            stroke={`var(--color-${s.name})`}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    );
  } else if (spec.type === "area") {
    chart = (
      <AreaChart data={rows}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="__category" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {data.series.map((s) => (
          <Area
            key={s.name}
            type="monotone"
            dataKey={s.name}
            stroke={`var(--color-${s.name})`}
            fill={`var(--color-${s.name})`}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    );
  } else {
    // bar (default)
    chart = (
      <BarChart data={rows}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="__category" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {data.series.map((s) => (
          <Bar key={s.name} dataKey={s.name} fill={`var(--color-${s.name})`} radius={2} />
        ))}
      </BarChart>
    );
  }

  return (
    <div>
      {spec.title ? <div style={titleStyle}>{spec.title}</div> : null}
      <ChartContainer config={config} style={{ height }}>
        {chart}
      </ChartContainer>
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  font: "600 13px -apple-system, system-ui, sans-serif",
  color: "#202124",
  marginBottom: 8,
  textAlign: "center",
};

const emptyStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: 120,
  font: "13px -apple-system, system-ui, sans-serif",
  color: "#9aa0a6",
};

export default ChartView;
