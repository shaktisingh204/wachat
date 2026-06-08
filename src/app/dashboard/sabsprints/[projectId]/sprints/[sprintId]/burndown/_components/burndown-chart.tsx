'use client';

/**
 * Burndown line chart. Two series:
 *  - Ideal: linear from `totalPoints` to 0 across the sprint's day window.
 *  - Actual: the recorded `agile_burndown` samples (per-day snapshot).
 * A KPI strip frames scope, latest remaining, and the day window.
 */
import { useMemo } from 'react';

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
import { Target, TrendingDown, CalendarRange, LineChart as LineChartIcon } from 'lucide-react';
import type { AgileBurndownSampleDoc } from '@/lib/rust-client/agile-burndown';
import type { AgileSprintDoc } from '@/lib/rust-client/agile-sprints';

const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } =
  Recharts;

interface Props {
  sprint: AgileSprintDoc;
  samples: AgileBurndownSampleDoc[];
  totalPoints: number;
}

const CHART_CONFIG: ChartConfig = {
  ideal: { label: 'Ideal', color: CHART_PALETTE[2] },
  actual: { label: 'Actual', color: CHART_PALETTE[0] },
};

function diffDays(start?: string, end?: string): number {
  if (!start || !end) return 10;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 10;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

export function BurndownChart({ sprint, samples, totalPoints }: Props) {
  const days = useMemo(
    () => diffDays(sprint.startDate, sprint.endDate),
    [sprint.startDate, sprint.endDate],
  );

  const data = useMemo(() => {
    const sampleByDay = new Map(samples.map((s) => [s.day, s.remainingPoints]));
    return Array.from({ length: days + 1 }, (_, i) => ({
      day: `Day ${i}`,
      ideal: Math.max(0, totalPoints - (totalPoints * i) / days),
      actual: sampleByDay.has(i) ? sampleByDay.get(i) : null,
    }));
  }, [days, totalPoints, samples]);

  const remaining = useMemo(() => {
    if (samples.length === 0) return totalPoints;
    const latest = samples.reduce((a, b) => (b.day > a.day ? b : a));
    return latest.remainingPoints;
  }, [samples, totalPoints]);

  if (totalPoints === 0 && samples.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={TrendingDown}
          title="Nothing to burn down yet"
          description="Add stories with points to this sprint to start tracking remaining work."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Burndown summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        <StatCard label="Total scope" value={`${totalPoints} pts`} icon={Target} />
        <StatCard label="Remaining" value={`${remaining} pts`} icon={TrendingDown} />
        <StatCard label="Sprint window" value={`${days} days`} icon={CalendarRange} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LineChartIcon
              size={16}
              aria-hidden="true"
              className="text-[var(--st-accent)]"
            />
            <CardTitle>{sprint.name} burndown</CardTitle>
          </div>
          <CardDescription>
            Ideal versus actual remaining story points across {days} days.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ChartContainer config={CHART_CONFIG} style={{ height: 320 }}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
              <XAxis dataKey="day" stroke="var(--st-text-secondary)" />
              <YAxis stroke="var(--st-text-secondary)" />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="ideal"
                name="Ideal"
                stroke={CHART_PALETTE[2]}
                strokeDasharray="5 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke={CHART_PALETTE[0]}
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ChartContainer>
        </CardBody>
      </Card>
    </div>
  );
}
