'use client';

/**
 * SabBigin dashboards — chart panels (client).
 *
 * Receives the server-computed aggregates and renders three token-styled
 * recharts views: a pipeline funnel (open deals by stage), a bar of deals
 * created per month over the trailing 6 months, and a pie of deals by
 * pipeline. Each panel lives in its own Card with a drill-down link into the
 * deals board.
 */

import Link from 'next/link';
import { ArrowUpRight, BarChart3, Filter, PieChart as PieIcon } from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  EmptyState,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Recharts,
  type ChartConfig,
} from '@/components/sabcrm/20ui';

import { formatCurrency } from '@/components/sabbigin/lib/format';
import type {
  StageDatum,
  MonthDatum,
  PipelineDatum,
} from '../_data';

/** Quiet, on-system slice palette (20ui tokens). */
const SLICE_COLORS = [
  'var(--st-accent)',
  '#1f9d55',
  '#7c3aed',
  '#0891b2',
  '#f59e0b',
  '#e11d48',
];

const funnelConfig: ChartConfig = {
  count: { label: 'Open deals', color: 'var(--st-accent)' },
};

const monthsConfig: ChartConfig = {
  deals: { label: 'Deals created', color: 'var(--st-accent)' },
};

export interface DashboardChartsProps {
  stages: StageDatum[];
  months: MonthDatum[];
  pipelines: PipelineDatum[];
  currency: string;
}

export function DashboardCharts({
  stages,
  months,
  pipelines,
  currency,
}: DashboardChartsProps) {
  const pieConfig: ChartConfig = Object.fromEntries(
    pipelines.map((p, i) => [
      p.name,
      { label: p.name, color: SLICE_COLORS[i % SLICE_COLORS.length] },
    ]),
  );

  const monthsHaveData = months.some((m) => m.deals > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Pipeline funnel — open deals by stage */}
      <Card padding="none">
        <ChartCardHeader
          icon={Filter}
          title="Pipeline funnel"
          href="/dashboard/sabbigin/deals?view=board"
          linkLabel="Open board"
        />
        <CardBody className="pt-0">
          {stages.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Filter}
              title="No open deals to chart"
              description="Once deals are sitting in your pipeline stages, the funnel fills in here."
            />
          ) : (
            <ChartContainer config={funnelConfig} className="h-72">
              <Recharts.FunnelChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelKey="stage"
                      formatter={(value, _name, item) => {
                        const datum = item.payload as unknown as StageDatum;
                        return (
                          <div className="flex w-full flex-col gap-0.5">
                            <span className="font-medium text-[var(--st-text)]">
                              {datum.stage}
                            </span>
                            <span className="text-[var(--st-text-secondary)]">
                              {datum.count} deal{datum.count === 1 ? '' : 's'} ·{' '}
                              {formatCurrency(datum.value, currency)}
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Recharts.Funnel
                  dataKey="count"
                  data={stages}
                  isAnimationActive={false}
                  fill="var(--st-accent)"
                >
                  <Recharts.LabelList
                    position="right"
                    dataKey="stage"
                    fill="var(--st-text-secondary)"
                    stroke="none"
                    fontSize={11}
                  />
                  {stages.map((_, i) => (
                    <Recharts.Cell
                      key={i}
                      fill={SLICE_COLORS[i % SLICE_COLORS.length]}
                    />
                  ))}
                </Recharts.Funnel>
              </Recharts.FunnelChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>

      {/* Deals created per month */}
      <Card padding="none">
        <ChartCardHeader
          icon={BarChart3}
          title="Deals created (last 6 months)"
          href="/dashboard/sabbigin/deals?view=list"
          linkLabel="View deals"
        />
        <CardBody className="pt-0">
          {!monthsHaveData ? (
            <EmptyState
              size="sm"
              icon={BarChart3}
              title="No deals created recently"
              description="Create deals and they will trend month over month here."
            />
          ) : (
            <ChartContainer config={monthsConfig} className="h-72">
              <Recharts.BarChart data={months}>
                <Recharts.CartesianGrid vertical={false} stroke="var(--st-border)" />
                <Recharts.XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--st-text-tertiary)"
                />
                <Recharts.YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  fontSize={11}
                  stroke="var(--st-text-tertiary)"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Recharts.Bar
                  dataKey="deals"
                  fill="var(--color-deals)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </Recharts.BarChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>

      {/* Deals by pipeline */}
      <Card padding="none" className="lg:col-span-2">
        <ChartCardHeader
          icon={PieIcon}
          title="Deals by pipeline"
          href="/dashboard/sabbigin/deals"
          linkLabel="Browse pipelines"
        />
        <CardBody className="pt-0">
          {pipelines.length === 0 ? (
            <EmptyState
              size="sm"
              icon={PieIcon}
              title="No pipeline data yet"
              description="Attach deals to pipelines to see how your work is distributed."
            />
          ) : (
            <ChartContainer config={pieConfig} className="h-72">
              <Recharts.PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Recharts.Pie
                  data={pipelines}
                  dataKey="deals"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {pipelines.map((_, i) => (
                    <Recharts.Cell
                      key={i}
                      fill={SLICE_COLORS[i % SLICE_COLORS.length]}
                    />
                  ))}
                </Recharts.Pie>
                <Recharts.Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      {value}
                    </span>
                  )}
                />
              </Recharts.PieChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ChartCardHeader({
  icon: Icon,
  title,
  href,
  linkLabel,
}: {
  icon: typeof Filter;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <CardHeader>
      <CardTitle className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={2} aria-hidden="true" />
        {title}
      </CardTitle>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
      >
        {linkLabel}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </CardHeader>
  );
}
