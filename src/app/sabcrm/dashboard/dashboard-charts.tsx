'use client';

/**
 * SabCRM Dashboard — client-side chart panels.
 *
 * Receives pre-fetched analytics data from the parent RSC and renders it with
 * the ZoruUI chart primitives (Recharts under the hood). Because Recharts uses
 * browser APIs, this module MUST be a client component.
 *
 * Three panels are rendered in order:
 *   1. Opportunities by stage (bar chart — count distribution)
 *   2. Pipeline value by stage (bar chart — amount sum)
 *   3. Task status summary (simple stat cards — no chart library needed)
 *
 * All data is optional: when a panel's data is missing (e.g. no opportunities
 * yet, or the analytics action failed) a compact empty state replaces the chart
 * so the dashboard always renders cleanly.
 */

import * as React from 'react';
import * as Recharts from 'recharts';

import type {
  CountByFieldResult,
  SumByFieldResult,
  TaskKpi,
} from '@/app/actions/sabcrm.actions.types';
import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
  EmptyState,
  Separator,
  type ZoruChartTooltipProps,
} from '@/components/sabcrm/20ui/compat';

// Local bucket shapes that match CountByFieldResult.buckets / SumByFieldResult.buckets
// (re-declared here to avoid importing the server-only analytics lib in a client component)
interface CountBucket { value: string; label: string; color?: string; count: number }
interface SumBucket { value: string; label: string; color?: string; sum: number; count: number }

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatCurrencyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/* -------------------------------------------------------------------------- */
/* Opportunities by stage — bar chart                                          */
/* -------------------------------------------------------------------------- */

interface StageCountChartProps {
  data: CountByFieldResult;
}

function StageCountChart({ data }: StageCountChartProps) {
  const chartData = (data.buckets as CountBucket[])
    .filter((b: CountBucket) => b.value !== '')
    .map((b: CountBucket) => ({ label: b.label, count: b.count }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <EmptyState
          title="No opportunities yet"
          description="Stage distribution will appear once opportunities are created."
        />
      </div>
    );
  }

  return (
    <ZoruChartContainer height={200}>
      <Recharts.BarChart
        data={chartData}
        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
      >
        <Recharts.CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--zoru-line))"
          vertical={false}
        />
        <Recharts.XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
          axisLine={false}
          tickLine={false}
        />
        <Recharts.YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
          axisLine={false}
          tickLine={false}
        />
        <Recharts.Tooltip
          content={<ZoruChartTooltip />}
          cursor={{ fill: 'hsl(var(--zoru-surface-2))' }}
        />
        <Recharts.Bar
          dataKey="count"
          name="Opportunities"
          fill={ZORU_CHART_PALETTE[0]}
          radius={[3, 3, 0, 0]}
          maxBarSize={48}
        />
      </Recharts.BarChart>
    </ZoruChartContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* Pipeline value by stage — bar chart                                        */
/* -------------------------------------------------------------------------- */

interface PipelineValueChartProps {
  data: SumByFieldResult;
}

function PipelineValueChart({ data }: PipelineValueChartProps) {
  const chartData = (data.buckets as SumBucket[])
    .filter((b: SumBucket) => b.value !== '' && b.sum > 0)
    .map((b: SumBucket) => ({ label: b.label, value: b.sum }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <EmptyState
          title="No pipeline value"
          description="Set amounts on opportunities to see pipeline by stage."
        />
      </div>
    );
  }

  return (
    <ZoruChartContainer height={200}>
      <Recharts.BarChart
        data={chartData}
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
      >
        <Recharts.CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--zoru-line))"
          vertical={false}
        />
        <Recharts.XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
          axisLine={false}
          tickLine={false}
        />
        <Recharts.YAxis
          tickFormatter={formatCurrencyShort}
          tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Recharts.Tooltip
          content={(props: ZoruChartTooltipProps) => {
            if (!props.active || !props.payload?.length) return null;
            const entry = props.payload[0];
            const raw = entry?.value;
            const formatted = typeof raw === 'number' ? formatCurrencyShort(raw) : String(raw ?? '');
            return (
              <ZoruChartTooltip
                active={props.active}
                payload={[{ ...entry, value: formatted }]}
                label={props.label}
              />
            );
          }}
          cursor={{ fill: 'hsl(var(--zoru-surface-2))' }}
        />
        <Recharts.Bar
          dataKey="value"
          name="Pipeline Value"
          fill={ZORU_CHART_PALETTE[1]}
          radius={[3, 3, 0, 0]}
          maxBarSize={48}
        />
      </Recharts.BarChart>
    </ZoruChartContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* Task status summary — simple stat row                                       */
/* -------------------------------------------------------------------------- */

interface TaskSummaryProps {
  tasks: TaskKpi;
}

function TaskSummary({ tasks }: TaskSummaryProps) {
  const items: Array<{ label: string; value: number; warn?: boolean }> = [
    { label: 'Total open', value: tasks.totalOpen },
    { label: 'Due today', value: tasks.dueToday, warn: tasks.dueToday > 0 },
    { label: 'Overdue', value: tasks.overdue, warn: tasks.overdue > 0 },
  ];

  return (
    <div className="grid grid-cols-3 divide-x divide-zoru-line">
      {items.map(({ label, value, warn }) => (
        <div key={label} className="flex flex-col items-center gap-1 px-4 py-6">
          <span
            className={
              warn && value > 0
                ? 'text-2xl font-semibold text-zoru-danger'
                : 'text-2xl font-semibold text-zoru-ink'
            }
          >
            {value}
          </span>
          <span className="text-xs text-zoru-ink-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Public component                                                            */
/* -------------------------------------------------------------------------- */

export interface DashboardChartsProps {
  stageCount: CountByFieldResult | null;
  pipelineByStage: SumByFieldResult | null;
  tasks: TaskKpi;
}

export function DashboardCharts({
  stageCount,
  pipelineByStage,
  tasks,
}: DashboardChartsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Opportunities by stage */}
      <Card>
        <ZoruCardHeader className="pb-3">
          <ZoruCardTitle className="text-sm font-semibold text-zoru-ink">
            Opportunities by Stage
          </ZoruCardTitle>
          <ZoruCardDescription className="text-xs text-zoru-ink-muted">
            Count of open opportunities in each pipeline stage
          </ZoruCardDescription>
        </ZoruCardHeader>
        <Separator />
        <ZoruCardContent className="pt-4">
          {stageCount ? (
            <StageCountChart data={stageCount} />
          ) : (
            <div className="flex h-48 items-center justify-center">
              <EmptyState
                title="Chart unavailable"
                description="Could not load opportunity stage data."
              />
            </div>
          )}
        </ZoruCardContent>
      </Card>

      {/* Pipeline value by stage */}
      <Card>
        <ZoruCardHeader className="pb-3">
          <ZoruCardTitle className="text-sm font-semibold text-zoru-ink">
            Pipeline Value by Stage
          </ZoruCardTitle>
          <ZoruCardDescription className="text-xs text-zoru-ink-muted">
            Sum of opportunity amounts in each stage
          </ZoruCardDescription>
        </ZoruCardHeader>
        <Separator />
        <ZoruCardContent className="pt-4">
          {pipelineByStage ? (
            <PipelineValueChart data={pipelineByStage} />
          ) : (
            <div className="flex h-48 items-center justify-center">
              <EmptyState
                title="Chart unavailable"
                description="Could not load pipeline value data."
              />
            </div>
          )}
        </ZoruCardContent>
      </Card>

      {/* Task status summary */}
      <Card>
        <ZoruCardHeader className="pb-3">
          <ZoruCardTitle className="text-sm font-semibold text-zoru-ink">
            Task Status
          </ZoruCardTitle>
          <ZoruCardDescription className="text-xs text-zoru-ink-muted">
            Open tasks across the project
          </ZoruCardDescription>
        </ZoruCardHeader>
        <Separator />
        <TaskSummary tasks={tasks} />
      </Card>
    </div>
  );
}
