'use client';

/**
 * Velocity bar chart — planned vs completed points per completed sprint.
 * Uses the ZoruChart wrapper (Recharts) and the neutral Zoru palette.
 */
import {
  Card,
  EmptyState,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
} from '@/components/sabcrm/20ui/compat';
import type { AgileVelocityDoc } from '@/lib/rust-client/agile-velocity';

const {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} = ZoruChart;

interface Props {
  items: AgileVelocityDoc[];
}

export function VelocityChart({ items }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No completed sprints yet"
        description="Velocity is recorded when you finish a sprint. Complete one to see this chart."
      />
    );
  }
  const data = items.map((v) => ({
    name: v.sprintName,
    planned: v.plannedPoints,
    completed: v.completedPoints,
  }));
  const avg =
    items.reduce((acc, v) => acc + v.completedPoints, 0) / items.length;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-end justify-between">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">Velocity</h2>
        <p className="text-xs text-[var(--st-text-secondary)]">
          Avg completed: <span className="font-medium text-[var(--st-text)]">{avg.toFixed(1)}</span> pts
        </p>
      </div>
      <ZoruChartContainer height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
          <XAxis dataKey="name" stroke="hsl(var(--zoru-ink-muted))" />
          <YAxis stroke="hsl(var(--zoru-ink-muted))" />
          <Tooltip content={<ZoruChartTooltip />} />
          <Legend />
          <Bar dataKey="planned" name="Planned" fill={ZORU_CHART_PALETTE[2]} />
          <Bar dataKey="completed" name="Completed" fill={ZORU_CHART_PALETTE[0]} />
        </BarChart>
      </ZoruChartContainer>
    </Card>
  );
}
