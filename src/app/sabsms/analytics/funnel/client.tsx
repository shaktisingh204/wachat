'use client';

import React from "react";
import {
  Activity,
  BarChart2,
  Clock,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  IconButton,
  Recharts,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/sabcrm/20ui';

import { SabsmsPageShell, SabsmsEmpty } from "@/components/sabsms/page-toolkit";

export interface FunnelStep {
  id: string;
  name: string;
  count: number;
  /** Attributed value per step (cents). No per-step money source yet → 0. */
  value: number;
}

export interface FunnelTrendPoint {
  date: string;
  conversion: number;
}

const FUNNEL_CHART_CONFIG = {
  users: { label: "Users Retained", color: "var(--st-accent)" },
  conversion: { label: "Conversion Rate", color: "var(--st-text)" },
} as const;

const TREND_CHART_CONFIG = {
  conversion: { label: "Conversion", color: "var(--st-accent)" },
} as const;

interface FunnelAnalyticsPageProps {
  steps: FunnelStep[];
  trend: FunnelTrendPoint[];
}

export default function FunnelAnalyticsPage({ steps, trend }: FunnelAnalyticsPageProps) {
  const hasData = steps.length > 0 && steps[0].count > 0;

  const getDropoff = (index: number) => {
    if (index === 0) return 0;
    const prev = steps[index - 1].count;
    const curr = steps[index].count;
    return prev > 0 ? Math.round(((prev - curr) / prev) * 100) : 0;
  };

  const getConversionRate = (index: number) => {
    const start = steps[0]?.count ?? 0;
    const curr = steps[index]?.count ?? 0;
    return start > 0 ? ((curr / start) * 100).toFixed(1) : "0.0";
  };

  const funnelChartData = steps.map((step) => {
    const start = steps[0]?.count ?? 0;
    const conversion = start > 0 ? Number(((step.count / start) * 100).toFixed(1)) : 0;
    return { name: step.name, users: step.count, conversion };
  });

  const overallConversion =
    steps.length > 1 && steps[0].count > 0
      ? ((steps[steps.length - 1].count / steps[0].count) * 100).toFixed(1)
      : "0.0";
  const totalDropoff = steps.length > 1 ? steps[0].count - steps[steps.length - 1].count : 0;
  const avgTrend =
    trend.length > 0
      ? (trend.reduce((acc, t) => acc + t.conversion, 0) / trend.length).toFixed(2)
      : "0.00";

  return (
    <SabsmsPageShell
      title="Funnel Analytics"
      description="Sent → Delivered → Clicked → Replied conversion over the last 30 days, computed from the analytics rollups."
      breadcrumbs={[
        { label: "Analytics", href: "/sabsms/analytics" },
        { label: "Funnels" },
      ]}
      secondaryActions={[
        { label: "Cohorts", onSelectHref: "/sabsms/analytics/cohorts" },
        { label: "Raw logs", onSelectHref: "/sabsms/logs" },
      ]}
    >
      {!hasData ? (
        <SabsmsEmpty
          icon={<Activity />}
          title="No funnel data yet"
          description="The funnel is built from your message rollups. Once you have sends, deliveries and clicks in the last 30 days, the conversion flow will appear here."
        />
      ) : (
        <>
          {/* KPI Row — real values from the rollup funnel. */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--st-text-secondary)]">Overall Conversion</p>
                    <p className="text-3xl font-bold tracking-tight text-[var(--st-text)]">{overallConversion}%</p>
                  </div>
                  <div className="rounded-lg bg-[var(--st-bg-muted)] p-2">
                    <TrendingUp className="size-5 text-[var(--st-text)]" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-[var(--st-text-secondary)]">
                  {steps[0]?.name} → {steps[steps.length - 1]?.name}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--st-text-secondary)]">Total Drop-off</p>
                    <p className="text-3xl font-bold tracking-tight text-[var(--st-text)]">{totalDropoff.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--st-bg-muted)] p-2">
                    <TrendingDown className="size-5 text-[var(--st-text)]" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-[var(--st-text-secondary)]">contacts lost across the funnel</div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--st-text-secondary)]">Avg Daily Conversion</p>
                    <p className="text-3xl font-bold tracking-tight text-[var(--st-text)]">{avgTrend}%</p>
                  </div>
                  <div className="rounded-lg bg-[var(--st-bg-muted)] p-2">
                    <Clock className="size-5 text-[var(--st-text)]" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-[var(--st-text-secondary)]">clicked / sent per day</div>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Main Funnel Visualization */}
            <Card padding="none" className="flex flex-col xl:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--st-border)] p-6">
                <div>
                  <CardTitle className="text-lg">Funnel Conversion Flow</CardTitle>
                  <CardDescription>
                    Contact progression and drop-offs through the messaging funnel.
                  </CardDescription>
                </div>
                <IconButton label="Toggle full screen" icon={BarChart2} variant="outline" />
              </CardHeader>

              <CardBody className="flex flex-1 flex-col p-6">
                <div className="relative mb-8 h-[320px] w-full">
                  <ChartContainer config={FUNNEL_CHART_CONFIG} className="h-full">
                    <Recharts.ComposedChart
                      data={funnelChartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
                      <Recharts.XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--st-text-secondary)', fontSize: 13 }}
                        dy={10}
                      />
                      <Recharts.YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
                        tickFormatter={(value: number) => `${value / 1000}k`}
                      />
                      <Recharts.YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
                        tickFormatter={(value: number) => `${value}%`}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        cursor={{ fill: 'var(--st-bg-muted)', opacity: 0.4 }}
                      />
                      <Recharts.Bar
                        yAxisId="left"
                        dataKey="users"
                        fill="var(--st-accent)"
                        radius={[4, 4, 0, 0]}
                        barSize={60}
                        name="Users Retained"
                      >
                        {funnelChartData.map((entry, index: number) => (
                          <Recharts.Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? "var(--st-accent)" : `color-mix(in srgb, var(--st-accent) calc(${1 - index * 0.2} * 100%), transparent)`}
                          />
                        ))}
                      </Recharts.Bar>
                      <Recharts.Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="conversion"
                        stroke="var(--st-text)"
                        strokeWidth={3}
                        dot={{ r: 6, fill: "var(--st-bg)", strokeWidth: 2 }}
                        activeDot={{ r: 8 }}
                        name="Conversion Rate"
                      />
                    </Recharts.ComposedChart>
                  </ChartContainer>
                </div>

                <div className="mt-auto">
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Step Name</Th>
                        <Th align="right">Contacts</Th>
                        <Th align="right">Drop-off</Th>
                        <Th align="right">% of start</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {steps.map((step, index) => {
                        const dropoffPct = getDropoff(index);
                        const dropoffDisplay = index === 0 ? "-" : `${dropoffPct}%`;
                        return (
                          <Tr key={step.id} className="group">
                            <Td className="py-3 font-medium text-[var(--st-text)]">{step.name}</Td>
                            <Td align="right" className="py-3 font-medium tabular-nums text-[var(--st-text)]">
                              {step.count.toLocaleString()}
                            </Td>
                            <Td align="right" className="py-3">
                              {index > 0 ? (
                                <div className="flex items-center justify-end gap-2">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
                                    <div
                                      className="h-full rounded-full bg-[var(--st-accent)]"
                                      style={{ width: `${dropoffPct}%` }}
                                    />
                                  </div>
                                  <span className="w-10 text-right text-xs font-medium text-[var(--st-text-secondary)]">
                                    {dropoffDisplay}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[var(--st-text-secondary)]">-</span>
                              )}
                            </Td>
                            <Td align="right" className="py-3 font-mono text-sm tabular-nums text-[var(--st-text)]">
                              {getConversionRate(index)}%
                            </Td>
                          </Tr>
                        );
                      })}
                    </TBody>
                  </Table>
                </div>
              </CardBody>
            </Card>

            {/* Side Panel */}
            <div className="flex flex-col gap-6">
              {/* Conversion Trend */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Conversion Trend</span>
                    <Badge tone="neutral">Last 30d</Badge>
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="mt-2 h-[120px] w-full">
                    <ChartContainer config={TREND_CHART_CONFIG} className="h-full">
                      <Recharts.AreaChart data={trend} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--st-accent)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--st-accent)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Recharts.Area
                          type="monotone"
                          dataKey="conversion"
                          stroke="var(--st-accent)"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorConv)"
                        />
                      </Recharts.AreaChart>
                    </ChartContainer>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-[var(--st-text-secondary)]">Avg. Conversion</span>
                    <span className="font-semibold text-[var(--st-text)]">{avgTrend}%</span>
                  </div>
                </CardBody>
              </Card>

              {/* Step breakdown */}
              <Card padding="none" className="flex-1">
                <CardHeader className="border-b border-[var(--st-border)] p-5">
                  <CardTitle className="text-base">Step Breakdown</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <Table>
                    <TBody>
                      {steps.map((step, index) => (
                        <Tr key={step.id}>
                          <Td className="px-5 py-3 text-sm font-medium text-[var(--st-text)]">{step.name}</Td>
                          <Td align="right" className="px-5 py-3">
                            <div className="flex flex-col items-end">
                              <span className="font-semibold text-[var(--st-text)]">{getConversionRate(index)}%</span>
                              <span className="text-[10px] text-[var(--st-text-secondary)]">
                                {step.count.toLocaleString()} contacts
                              </span>
                            </div>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </CardBody>
              </Card>
            </div>
          </div>
        </>
      )}
    </SabsmsPageShell>
  );
}
