'use client';

/**
 * Velocity surface — planned vs completed points per completed sprint. A KPI
 * strip summarises throughput and predictability; the bar chart (Recharts)
 * plots the trend using the neutral 20ui palette.
 */
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  StatCard,
  EmptyState,
  Recharts,
  ChartContainer,
  ChartTooltip,
  CHART_PALETTE,
  type ChartConfig,
} from '@/components/sabcrm/20ui';
import { Gauge, CheckCircle2, Target, BarChart3 } from 'lucide-react';
import type { AgileVelocityDoc } from '@/lib/rust-client/agile-velocity';

const {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} = Recharts;

interface Props {
  items: AgileVelocityDoc[];
}

const CHART_CONFIG: ChartConfig = {
  planned: { label: 'Planned', color: CHART_PALETTE[2] },
  completed: { label: 'Completed', color: CHART_PALETTE[0] },
};

export function VelocityChart({ items }: Props) {
  if (items.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={Gauge}
          title="No completed sprints yet"
          description="Velocity is recorded when you finish a sprint. Complete one to see throughput trends here."
        />
      </Card>
    );
  }

  const data = items.map((v) => ({
    name: v.sprintName,
    planned: v.plannedPoints,
    completed: v.completedPoints,
  }));

  const avg =
    items.reduce((acc, v) => acc + v.completedPoints, 0) / items.length;
  const last = items[items.length - 1];
  const totalCommitted = items.reduce((acc, v) => acc + v.plannedPoints, 0);
  const totalCompleted = items.reduce((acc, v) => acc + v.completedPoints, 0);
  const predictability =
    totalCommitted > 0
      ? Math.round((totalCompleted / totalCommitted) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Velocity summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="Average velocity"
          value={`${avg.toFixed(1)} pts`}
          icon={Gauge}
        />
        <StatCard
          label="Last sprint"
          value={`${last.completedPoints} pts`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Predictability"
          value={`${predictability}%`}
          icon={Target}
        />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3
              size={16}
              aria-hidden="true"
              className="text-[var(--st-accent)]"
            />
            <CardTitle>Velocity</CardTitle>
          </div>
          <CardDescription>
            Completed versus committed points across the last {items.length}{' '}
            sprints.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ChartContainer config={CHART_CONFIG} style={{ height: 320 }}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
              <XAxis dataKey="name" stroke="var(--st-text-secondary)" />
              <YAxis stroke="var(--st-text-secondary)" />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar dataKey="planned" name="Planned" fill={CHART_PALETTE[2]} />
              <Bar dataKey="completed" name="Completed" fill={CHART_PALETTE[0]} />
            </BarChart>
          </ChartContainer>
        </CardBody>
      </Card>
    </div>
  );
}
