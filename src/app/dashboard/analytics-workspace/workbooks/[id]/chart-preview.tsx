'use client';

/**
 * Generic chart preview. Maps `BiChartRunResponse.rows` onto the 20ui
 * recharts wrappers for bar / line / pie. Table renders rows directly;
 * KPI renders the first measure as a big number. map / heatmap show a
 * raw-rows table with a "renderer pending" badge.
 */
import { Database } from 'lucide-react';

import {
  Badge,
  CHART_PALETTE,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  EmptyState,
  Recharts,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type ChartConfig,
} from '@/components/sabcrm/20ui';
import type { BiChartColumn, BiChartType } from '@/lib/rust-client/bi-charts';

interface Props {
  chartType: BiChartType;
  rows: Record<string, unknown>[];
  columns: BiChartColumn[];
}

const CHART_HEIGHT = 280;

export function ChartPreview({ chartType, rows, columns }: Props) {
  const dimKey = columns.find((c) => c.role === 'dimension')?.key;
  const measureKey = columns.find((c) => c.role === 'measure')?.key;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Database}
        size="sm"
        title="No rows returned"
        description="This query produced no rows. Adjust the dimensions, measure, or filters and run again."
      />
    );
  }

  if (chartType === 'kpi') {
    const total = rows.reduce(
      (acc, r) => acc + Number((r as Record<string, unknown>)[measureKey ?? ''] ?? 0),
      0,
    );
    return (
      <StatCard
        label={measureKey ?? 'value'}
        value={total.toLocaleString()}
      />
    );
  }

  if (chartType === 'table' || chartType === 'map' || chartType === 'heatmap') {
    const keys = Object.keys(rows[0] ?? {});
    return (
      <div className="flex flex-col gap-2">
        {chartType !== 'table' && (
          <div>
            <Badge tone="warning">
              {chartType} renderer pending — showing raw rows
            </Badge>
          </div>
        )}
        <Table>
          <THead>
            <Tr>
              {keys.map((k) => (
                <Th key={k} align="left">
                  {k}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {rows.slice(0, 100).map((r, i) => (
              <Tr key={i}>
                {keys.map((k) => (
                  <Td key={k}>
                    {String((r as Record<string, unknown>)[k] ?? '')}
                  </Td>
                ))}
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    );
  }

  if (!dimKey || !measureKey) {
    return (
      <EmptyState
        icon={Database}
        size="sm"
        title="Not enough fields to chart"
        description="Add at least one dimension and one measure to render this chart type."
      />
    );
  }

  const config: ChartConfig = {
    [measureKey]: { label: measureKey, color: CHART_PALETTE[0] },
  };

  if (chartType === 'pie') {
    return (
      <ChartContainer config={config} style={{ height: CHART_HEIGHT }}>
        <Recharts.PieChart>
          <Recharts.Pie
            data={rows}
            dataKey={measureKey}
            nameKey={dimKey}
            outerRadius={100}
          >
            {rows.map((_, i) => (
              <Recharts.Cell
                key={i}
                fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              />
            ))}
          </Recharts.Pie>
          <ChartTooltip content={<ChartTooltipContent nameKey={dimKey} />} />
          <Recharts.Legend />
        </Recharts.PieChart>
      </ChartContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ChartContainer config={config} style={{ height: CHART_HEIGHT }}>
        <Recharts.LineChart data={rows}>
          <Recharts.CartesianGrid stroke="var(--st-border)" strokeDasharray="3 3" />
          <Recharts.XAxis dataKey={dimKey} tickLine={false} axisLine={false} />
          <Recharts.YAxis tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <Recharts.Line
            type="monotone"
            dataKey={measureKey}
            stroke={`var(--color-${measureKey})`}
            dot={false}
          />
        </Recharts.LineChart>
      </ChartContainer>
    );
  }

  // bar (default)
  return (
    <ChartContainer config={config} style={{ height: CHART_HEIGHT }}>
      <Recharts.BarChart data={rows}>
        <Recharts.CartesianGrid vertical={false} stroke="var(--st-border)" strokeDasharray="3 3" />
        <Recharts.XAxis dataKey={dimKey} tickLine={false} axisLine={false} />
        <Recharts.YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Recharts.Bar dataKey={measureKey} fill={`var(--color-${measureKey})`} radius={4} />
      </Recharts.BarChart>
    </ChartContainer>
  );
}
