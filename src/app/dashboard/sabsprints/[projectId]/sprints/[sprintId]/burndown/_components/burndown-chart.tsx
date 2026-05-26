'use client';

/**
 * Burndown line chart. Two series:
 *  - Ideal: linear from `totalPoints` to 0 across the sprint's day window.
 *  - Actual: the recorded `agile_burndown` samples (per-day snapshot).
 */
import { useMemo } from 'react';

import {
  Card,
  EmptyState,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
} from '@/components/zoruui';
import type { AgileBurndownSampleDoc } from '@/lib/rust-client/agile-burndown';
import type { AgileSprintDoc } from '@/lib/rust-client/agile-sprints';

const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } =
  ZoruChart;

interface Props {
  sprint: AgileSprintDoc;
  samples: AgileBurndownSampleDoc[];
  totalPoints: number;
}

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

  if (totalPoints === 0 && samples.length === 0) {
    return (
      <EmptyState
        title="Nothing to burn down yet"
        description="Add stories with points to this sprint to see the burndown."
      />
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-zoru-ink">
          {sprint.name} burndown
        </h2>
        <p className="text-xs text-zoru-ink-muted">
          Ideal vs actual remaining story points across {days} days.
        </p>
      </div>
      <ZoruChartContainer height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
          <XAxis dataKey="day" stroke="hsl(var(--zoru-ink-muted))" />
          <YAxis stroke="hsl(var(--zoru-ink-muted))" />
          <Tooltip content={<ZoruChartTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="ideal"
            name="Ideal"
            stroke={ZORU_CHART_PALETTE[2]}
            strokeDasharray="5 4"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke={ZORU_CHART_PALETTE[0]}
            strokeWidth={2}
            connectNulls
          />
        </LineChart>
      </ZoruChartContainer>
    </Card>
  );
}
