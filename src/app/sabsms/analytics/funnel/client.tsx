'use client';

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart,
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Filter,
  GripVertical,
  Mail,
  MoreHorizontal,
  Plus,
  Save,
  Share2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Recharts,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/sabcrm/20ui';

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

const INITIAL_STEPS = [
  { id: "s1", name: "Sent", count: 125000, value: 0, time: "-" },
  { id: "s2", name: "Delivered", count: 118000, value: 0, time: "1s" },
  { id: "s3", name: "Clicked", count: 42000, value: 0, time: "45m" },
  { id: "s4", name: "Converted", count: 8500, value: 125000, time: "2h 15m" },
];

const FUNNEL_TREND_DATA = [
  { date: "May 1", conversion: 6.2, dropoff: 93.8 },
  { date: "May 2", conversion: 6.4, dropoff: 93.6 },
  { date: "May 3", conversion: 6.1, dropoff: 93.9 },
  { date: "May 4", conversion: 6.8, dropoff: 93.2 },
  { date: "May 5", conversion: 7.2, dropoff: 92.8 },
  { date: "May 6", conversion: 7.0, dropoff: 93.0 },
  { date: "May 7", conversion: 6.8, dropoff: 93.2 },
];

const FUNNEL_CHART_CONFIG = {
  users: { label: "Users Retained", color: "var(--st-accent)" },
  conversion: { label: "Conversion Rate", color: "var(--st-text)" },
} as const;

const TREND_CHART_CONFIG = {
  conversion: { label: "Conversion", color: "var(--st-accent)" },
} as const;

const VARIANT_OPTIONS = [
  { value: "control", label: "Control" },
  { value: "variant", label: "Variant" },
];

const CHANNEL_PERFORMANCE = [
  { name: "SMS", value: 4.2 },
  { name: "MMS", value: 5.8 },
  { name: "RCS", value: 8.1 },
];

const TOP_COHORTS = [
  { name: "Active (30d)", rate: "12.1%", trend: "up" as const, val: "+1.2%", alert: false },
  { name: "New Users", rate: "8.4%", trend: "up" as const, val: "+0.8%", alert: false },
  { name: "Dormant", rate: "3.2%", trend: "down" as const, val: "-0.4%", alert: false },
  { name: "Churn Risk", rate: "2.1%", trend: "down" as const, val: "-1.1%", alert: true },
];

export default function FunnelAnalyticsPage() {
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [activeVariant, setActiveVariant] = useState("control");
  const [dateRange, setDateRange] = useState("30d");
  const [audience, setAudience] = useState("all");
  const [savedView, setSavedView] = useState("default");

  const moveStep = (index: number, direction: -1 | 1) => {
    const newSteps = [...steps];
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;

    const temp = newSteps[index];
    newSteps[index] = newSteps[target];
    newSteps[target] = temp;
    setSteps(newSteps);
  };

  const getDropoff = (index: number) => {
    if (index === 0) return 0;
    const prev = steps[index - 1].count;
    const curr = steps[index].count;
    return prev > 0 ? Math.round(((prev - curr) / prev) * 100) : 0;
  };

  const getConversionRate = (index: number) => {
    const start = steps[0].count;
    const curr = steps[index].count;
    return start > 0 ? ((curr / start) * 100).toFixed(1) : "0.0";
  };

  const funnelChartData = steps.map((step, index) => {
    const isVariant = activeVariant === "variant";
    const stepCount = isVariant ? Math.round(step.count * (1 + (index * 0.05))) : step.count;
    const start = isVariant ? Math.round(steps[0].count * 1) : steps[0].count;
    const conversion = start > 0 ? ((stepCount / start) * 100).toFixed(1) : 0;
    return {
      name: step.name,
      users: stepCount,
      conversion: parseFloat(conversion as string),
    };
  });

  return (
    <SabsmsPageShell
      title="Funnel Analytics"
      description="Deep-dive into conversion paths, measure drop-offs, and run statistical A/B tests across multiple audience cohorts."
      breadcrumbs={[
        { label: "Analytics", href: "/sabsms/analytics" },
        { label: "Funnels" },
      ]}
      toolbar={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-44" aria-label="Date range">
                <Calendar className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className="w-44" aria-label="Audience">
                <Users className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Audiences</SelectItem>
                <SelectItem value="vip">VIP Segment</SelectItem>
                <SelectItem value="churn">Churn Risk</SelectItem>
                <SelectItem value="new">New Users</SelectItem>
              </SelectContent>
            </Select>

            <Select value={savedView} onValueChange={setSavedView}>
              <SelectTrigger className="w-44" aria-label="Saved view">
                <Save className="size-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <SelectValue placeholder="Saved view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default View</SelectItem>
                <SelectItem value="q1">Q1 Campaign Funnel</SelectItem>
                <SelectItem value="holiday">Holiday Promo Funnel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" iconLeft={Plus}>
              Compare Funnels
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" iconLeft={MoreHorizontal}>
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem iconLeft={Save}>Save View</DropdownMenuItem>
                <DropdownMenuItem iconLeft={Share2}>Export Dashboard</DropdownMenuItem>
                <DropdownMenuItem iconLeft={Mail}>Schedule Report</DropdownMenuItem>
                <DropdownMenuItem iconLeft={Download}>Download CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      }
    >
      {/* AI Insights Banner */}
      <Card padding="none" className="mb-6 overflow-hidden bg-[var(--st-bg-secondary)]">
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-[var(--st-bg-muted)] p-2.5">
              <Sparkles className="size-5 text-[var(--st-text)]" aria-hidden="true" />
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-[var(--st-text)]">
                Datadog-grade Insight
                <Badge tone="accent">AI Powered</Badge>
              </h3>
              <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
                Drop-off from <strong className="font-medium text-[var(--st-text)]">Delivered</strong> to{" "}
                <strong className="font-medium text-[var(--st-text)]">Clicked</strong> is 64%.
                We detected a 12% lower dropoff on cohorts receiving SMS at 10 AM. Adjusting send times could yield +2.4k conversions.
              </p>
            </div>
          </div>
          <Button size="sm" variant="primary" className="shrink-0">
            Apply Optimal Timing
          </Button>
        </div>
      </Card>

      {/* KPI Row */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Overall Conversion</p>
                <p className="text-3xl font-bold tracking-tight text-[var(--st-text)]">6.8%</p>
              </div>
              <div className="rounded-lg bg-[var(--st-bg-muted)] p-2">
                <TrendingUp className="size-5 text-[var(--st-text)]" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="flex items-center gap-1 font-medium text-[var(--st-status-ok)]">
                <TrendingUp className="size-3" aria-hidden="true" /> +1.2%
              </span>
              <span className="ml-2 text-[var(--st-text-secondary)]">vs last 30d</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Total Drop-off</p>
                <p className="text-3xl font-bold tracking-tight text-[var(--st-text)]">116.5k</p>
              </div>
              <div className="rounded-lg bg-[var(--st-bg-muted)] p-2">
                <TrendingDown className="size-5 text-[var(--st-text)]" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="flex items-center gap-1 font-medium text-[var(--st-status-ok)]">
                <TrendingDown className="size-3" aria-hidden="true" /> -0.4%
              </span>
              <span className="ml-2 text-[var(--st-text-secondary)]">vs last 30d</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Avg Time to Convert</p>
                <p className="text-3xl font-bold tracking-tight text-[var(--st-text)]">2h 15m</p>
              </div>
              <div className="rounded-lg bg-[var(--st-bg-muted)] p-2">
                <Clock className="size-5 text-[var(--st-text)]" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-[var(--st-text-secondary)]">Across 4 steps</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Attributed Value</p>
                <p className="text-3xl font-bold tracking-tight text-[var(--st-text)]">$125k</p>
              </div>
              <div className="rounded-lg bg-[var(--st-bg-muted)] p-2">
                <Activity className="size-5 text-[var(--st-text)]" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="flex items-center gap-1 font-medium text-[var(--st-status-ok)]">
                <TrendingUp className="size-3" aria-hidden="true" /> +14%
              </span>
              <span className="ml-2 text-[var(--st-text-secondary)]">vs last 30d</span>
            </div>
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
                Visualizing user progression and drop-offs through defined steps.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <SegmentedControl
                items={VARIANT_OPTIONS}
                value={activeVariant}
                onChange={setActiveVariant}
                aria-label="Funnel variant"
              />
              <IconButton
                label="Toggle full screen"
                icon={BarChart2}
                variant="outline"
              />
            </div>
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
                    tickFormatter={(value) => `${(value / 1000)}k`}
                  />
                  <Recharts.YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
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
                    {funnelChartData.map((entry, index) => (
                      <Recharts.Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? "var(--st-accent)" : `color-mix(in srgb, var(--st-accent) calc(${1 - (index * 0.2)} * 100%), transparent)`}
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
                    <Th className="w-12" align="center"></Th>
                    <Th>Step Name</Th>
                    <Th align="right">Users</Th>
                    <Th align="right">Drop-off</Th>
                    <Th align="right">Conv. Value</Th>
                  </Tr>
                </THead>
                <TBody>
                  {steps.map((step, index) => {
                    const dropoff = getDropoff(index);
                    const isVariant = activeVariant === "variant";
                    const stepCount = isVariant ? Math.round(step.count * (1 + (index * 0.05))) : step.count;
                    const stepValue = isVariant ? Math.round(step.value * 1.1) : step.value;
                    const dropoffPct = isVariant ? Math.max(0, dropoff - 2) : dropoff;
                    const dropoffDisplay = index === 0 ? "-" : `${dropoffPct}%`;

                    return (
                      <Tr key={step.id} className="group">
                        <Td align="center" className="py-3">
                          <div className="flex items-center justify-center gap-1">
                            <div className="flex flex-col -space-y-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <IconButton
                                label="Move step up"
                                icon={ChevronUp}
                                size="sm"
                                disabled={index === 0}
                                onClick={() => moveStep(index, -1)}
                              />
                              <IconButton
                                label="Move step down"
                                icon={ChevronDown}
                                size="sm"
                                disabled={index === steps.length - 1}
                                onClick={() => moveStep(index, 1)}
                              />
                            </div>
                            <GripVertical className="size-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                          </div>
                        </Td>
                        <Td className="py-3 font-medium text-[var(--st-text)]">
                          {step.name}
                          {index > 0 && (
                            <div className="mt-1 text-xs font-normal text-[var(--st-text-secondary)]">
                              {getConversionRate(index)}% from start, avg {step.time}
                            </div>
                          )}
                        </Td>
                        <Td align="right" className="py-3 font-medium tabular-nums text-[var(--st-text)]">
                          {stepCount.toLocaleString()}
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
                          {stepValue > 0 ? `$${stepValue.toLocaleString()}` : "-"}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" iconLeft={Plus} block>
                  Add Funnel Step
                </Button>
                <Button variant="outline" size="sm" iconLeft={Filter}>
                  Add Filter
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Side Panels - Analytics & Cohorts */}
        <div className="flex flex-col gap-6">

          {/* Conversion Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Conversion Trend</span>
                <Badge tone="neutral">Last 7d</Badge>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="mt-2 h-[120px] w-full">
                <ChartContainer config={TREND_CHART_CONFIG} className="h-full">
                  <Recharts.AreaChart data={FUNNEL_TREND_DATA} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
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
                <span className="font-semibold text-[var(--st-text)]">6.64%</span>
              </div>
            </CardBody>
          </Card>

          {/* Test Lift Estimate / Channel Performance */}
          {activeVariant === "variant" ? (
            <Card className="relative overflow-hidden bg-[var(--st-bg-secondary)]">
              <div className="absolute -right-4 -top-4 opacity-10">
                <Activity className="size-24 text-[var(--st-text)]" aria-hidden="true" />
              </div>
              <CardHeader className="relative z-10 pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-[var(--st-text)]">
                  <BarChart className="size-4" aria-hidden="true" /> Experiment Results
                </CardTitle>
              </CardHeader>
              <CardBody className="relative z-10">
                <div className="text-3xl font-bold tracking-tight text-[var(--st-status-ok)]">+14.5%</div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--st-text-secondary)]">
                  Variant B is outperforming Control with a <strong className="text-[var(--st-text)]">98% statistical significance</strong>.
                  Consider rolling this out to 100% of traffic.
                </p>
                <Button size="sm" variant="primary" block className="mt-4">
                  Rollout to 100%
                </Button>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Channel Performance</CardTitle>
                <CardDescription>Attribution across messaging channels</CardDescription>
              </CardHeader>
              <CardBody>
                <div className="mt-2 space-y-5">
                  {CHANNEL_PERFORMANCE.map((channel) => (
                    <div key={channel.name}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                          <span className="size-2.5 rounded-full bg-[var(--st-accent)]" aria-hidden="true" />
                          <span>{channel.name}</span>
                        </div>
                        <span className="font-semibold text-[var(--st-text)]">{channel.value}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
                        <div
                          className="h-full bg-[var(--st-accent)]"
                          style={{ width: `${channel.value * 10}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Segments / Cohorts Drill */}
          <Card padding="none" className="flex-1">
            <CardHeader className="border-b border-[var(--st-border)] p-5">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Top Cohorts</span>
                <Link href="#" className="text-xs text-[var(--st-accent)] hover:underline">View All</Link>
              </CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <Table>
                <TBody>
                  {TOP_COHORTS.map((cohort) => (
                    <Tr key={cohort.name}>
                      <Td className="px-5 py-3 text-sm font-medium text-[var(--st-text)]">
                        {cohort.name}
                      </Td>
                      <Td align="right" className="px-5 py-3">
                        <div className="flex flex-col items-end">
                          <span className={`font-semibold ${cohort.alert ? 'text-[var(--st-danger)]' : 'text-[var(--st-text)]'}`}>{cohort.rate}</span>
                          <span className={`flex items-center gap-0.5 text-[10px] ${cohort.trend === 'up' ? 'text-[var(--st-status-ok)]' : 'text-[var(--st-text-secondary)]'}`}>
                            {cohort.trend === 'up' ? <TrendingUp className="size-3" aria-hidden="true" /> : <TrendingDown className="size-3" aria-hidden="true" />}
                            {cohort.val}
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
    </SabsmsPageShell>
  );
}
