'use client';

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart,
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Filter,
  GripVertical,
  Mail,
  MoreHorizontal,
  Plus,
  Save,
  Share2,
  Sparkles,
  SplitSquareHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
  Activity
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
} from "@/components/zoruui";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
} from "@/components/sabsms/page-toolkit";

const INITIAL_STEPS = [
  { id: "s1", name: "Sent", count: 125000, value: 0, time: "—" },
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

export default function FunnelAnalyticsPage() {
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [activeVariant, setActiveVariant] = useState("control");

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
        <div className="flex w-full items-center justify-between gap-3">
          <SabsmsFilterBar
            filters={[
              {
                id: "date",
                label: "Last 30 Days",
                icon: Calendar,
                options: [
                  { label: "Today", value: "today" },
                  { label: "Last 7 Days", value: "7d" },
                  { label: "Last 30 Days", value: "30d" },
                  { label: "Custom Range...", value: "custom" },
                ],
              },
              {
                id: "audience",
                label: "All Audiences",
                icon: Users,
                options: [
                  { label: "All Audiences", value: "all" },
                  { label: "VIP Segment", value: "vip" },
                  { label: "Churn Risk", value: "churn" },
                  { label: "New Users", value: "new" },
                ],
              },
              {
                id: "saved_view",
                label: "Default View",
                icon: Save,
                options: [
                  { label: "Default View", value: "default" },
                  { label: "Q1 Campaign Funnel", value: "q1" },
                  { label: "Holiday Promo Funnel", value: "holiday" },
                ],
              },
            ]}
          />
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="size-4" />
              Compare Funnels
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <MoreHorizontal className="size-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2">
                  <Save className="size-4 text-zoru-ink-muted" /> Save View
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Share2 className="size-4 text-zoru-ink-muted" /> Export Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Mail className="size-4 text-zoru-ink-muted" /> Schedule Report
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Download className="size-4 text-zoru-ink-muted" /> Download CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      }
    >
      {/* Premium AI Insights Banner */}
      <div className="mb-6 overflow-hidden rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-blue-500/20 p-2.5">
              <Sparkles className="size-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                Datadog-grade Insight
                <Badge className="bg-blue-600 hover:bg-blue-700">AI Powered</Badge>
              </h3>
              <p className="mt-1 text-sm text-blue-800/80 dark:text-blue-300/80">
                Drop-off from <strong className="font-medium">Delivered</strong> to <strong className="font-medium">Clicked</strong> is 64%.
                We detected a 12% lower dropoff on cohorts receiving SMS at 10 AM. Adjusting send times could yield +2.4k conversions.
              </p>
            </div>
          </div>
          <Button size="sm" className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-md">
            Apply Optimal Timing
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="hover:border-zoru-line-strong transition-colors">
          <ZoruCardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zoru-ink-muted">Overall Conversion</p>
                <p className="text-3xl font-bold tracking-tight">6.8%</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <TrendingUp className="size-5 text-emerald-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp className="size-3" /> +1.2%
              </span>
              <span className="text-zoru-ink-muted ml-2">vs last 30d</span>
            </div>
          </ZoruCardContent>
        </Card>

        <Card className="hover:border-zoru-line-strong transition-colors">
          <ZoruCardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zoru-ink-muted">Total Drop-off</p>
                <p className="text-3xl font-bold tracking-tight">116.5k</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <TrendingDown className="size-5 text-red-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-red-600 font-medium flex items-center gap-1">
                <TrendingDown className="size-3" /> -0.4%
              </span>
              <span className="text-zoru-ink-muted ml-2">vs last 30d</span>
            </div>
          </ZoruCardContent>
        </Card>

        <Card className="hover:border-zoru-line-strong transition-colors">
          <ZoruCardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zoru-ink-muted">Avg Time to Convert</p>
                <p className="text-3xl font-bold tracking-tight">2h 15m</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Clock className="size-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-zoru-ink-muted">Across 4 steps</span>
            </div>
          </ZoruCardContent>
        </Card>

        <Card className="hover:border-zoru-line-strong transition-colors">
          <ZoruCardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zoru-ink-muted">Attributed Value</p>
                <p className="text-3xl font-bold tracking-tight">$125k</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg">
                <Activity className="size-5 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp className="size-3" /> +14%
              </span>
              <span className="text-zoru-ink-muted ml-2">vs last 30d</span>
            </div>
          </ZoruCardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Main Funnel Visualization */}
        <Card className="xl:col-span-2 flex flex-col shadow-sm">
          <ZoruCardHeader className="flex flex-row items-center justify-between pb-6 border-b border-zoru-line/50">
            <div>
              <ZoruCardTitle className="text-lg">Funnel Conversion Flow</ZoruCardTitle>
              <ZoruCardDescription>
                Visualizing user progression and drop-offs through defined steps.
              </ZoruCardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Tabs value={activeVariant} onValueChange={setActiveVariant}>
                <TabsList className="grid w-48 grid-cols-2 bg-zoru-surface-2 p-1 rounded-lg">
                  <TabsTrigger value="control" className="rounded-md">Control</TabsTrigger>
                  <TabsTrigger value="variant" className="rounded-md">Variant</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="icon" title="Toggle full screen">
                <BarChart2 className="size-4 text-zoru-ink-muted" />
              </Button>
            </div>
          </ZoruCardHeader>

          <ZoruCardContent className="p-6 flex-1 flex flex-col">
            <div className="h-[320px] w-full mb-8 relative">
              <ZoruChartContainer height="100%">
                <ZoruChart.ComposedChart
                  data={funnelChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-zoru-line/40" />
                  <ZoruChart.XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 13 }}
                    dy={10}
                  />
                  <ZoruChart.YAxis 
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000)}k`}
                  />
                  <ZoruChart.YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ZoruChart.Tooltip 
                    content={<ZoruChartTooltip />}
                    cursor={{ fill: 'hsl(var(--zoru-surface-2))', opacity: 0.4 }}
                  />
                  <ZoruChart.Bar 
                    yAxisId="left"
                    dataKey="users" 
                    fill="hsl(var(--zoru-brand))" 
                    radius={[4, 4, 0, 0]}
                    barSize={60}
                    name="Users Retained"
                  >
                    {funnelChartData.map((entry, index) => (
                      <ZoruChart.Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? "hsl(var(--zoru-brand))" : `hsl(var(--zoru-brand) / ${1 - (index * 0.2)})`} 
                      />
                    ))}
                  </ZoruChart.Bar>
                  <ZoruChart.Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="conversion" 
                    stroke="hsl(var(--zoru-ink))" 
                    strokeWidth={3}
                    dot={{ r: 6, fill: "hsl(var(--zoru-bg))", strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                    name="Conversion Rate"
                  />
                </ZoruChart.ComposedChart>
              </ZoruChartContainer>
            </div>

            <div className="mt-auto">
              <Table>
                <ZoruTableHeader className="bg-zoru-surface-1/50">
                  <ZoruTableRow>
                    <ZoruTableHead className="w-12 text-center"></ZoruTableHead>
                    <ZoruTableHead>Step Name</ZoruTableHead>
                    <ZoruTableHead className="text-right">Users</ZoruTableHead>
                    <ZoruTableHead className="text-right">Drop-off</ZoruTableHead>
                    <ZoruTableHead className="text-right">Conv. Value</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {steps.map((step, index) => {
                    const dropoff = getDropoff(index);
                    const isVariant = activeVariant === "variant";
                    const stepCount = isVariant ? Math.round(step.count * (1 + (index * 0.05))) : step.count;
                    const stepValue = isVariant ? Math.round(step.value * 1.1) : step.value;
                    const dropoffDisplay = index === 0 ? "—" : `${isVariant ? Math.max(0, dropoff - 2) : dropoff}%`;

                    return (
                      <ZoruTableRow key={step.id} className="group hover:bg-zoru-surface-1/30 transition-colors">
                        <ZoruTableCell className="flex items-center justify-center gap-1 py-3">
                          <div className="flex flex-col -space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              disabled={index === 0} 
                              onClick={() => moveStep(index, -1)}
                              className="text-zoru-ink-muted hover:text-zoru-ink disabled:opacity-30"
                            >
                              <ChevronUp className="size-3" />
                            </button>
                            <button 
                              disabled={index === steps.length - 1}
                              onClick={() => moveStep(index, 1)}
                              className="text-zoru-ink-muted hover:text-zoru-ink disabled:opacity-30"
                            >
                              <ChevronDown className="size-3" />
                            </button>
                          </div>
                          <GripVertical className="size-4 text-zoru-surface-3" />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-medium py-3">
                          {step.name}
                          {index > 0 && (
                            <div className="mt-1 text-xs font-normal text-zoru-ink-muted">
                              {getConversionRate(index)}% from start • avg {step.time}
                            </div>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right tabular-nums py-3 font-medium">
                          {stepCount.toLocaleString()}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right py-3">
                          {index > 0 ? (
                            <div className="flex justify-end items-center gap-2">
                              <div className="w-16 h-1.5 bg-zoru-surface-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${dropoff > 50 ? 'bg-red-400' : 'bg-emerald-400'}`} 
                                  style={{ width: `${isVariant ? Math.max(0, dropoff - 2) : dropoff}%` }} 
                                />
                              </div>
                              <span className={`text-xs font-medium w-10 text-right ${dropoff > 50 ? 'text-red-600' : 'text-zoru-ink-muted'}`}>
                                {dropoffDisplay}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zoru-ink-muted">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right font-mono text-sm tabular-nums text-emerald-600 py-3">
                          {stepValue > 0 ? `$${stepValue.toLocaleString()}` : "—"}
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })}
                </ZoruTableBody>
              </Table>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="w-full gap-2 text-zoru-ink-muted border-dashed hover:text-zoru-ink hover:border-zoru-line-strong transition-all">
                  <Plus className="size-4" /> Add Funnel Step
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-zoru-ink-muted border-dashed hover:text-zoru-ink transition-all">
                  <Filter className="size-4" /> Add Filter
                </Button>
              </div>
            </div>
          </ZoruCardContent>
        </Card>

        {/* Side Panels - Analytics & Cohorts */}
        <div className="flex flex-col gap-6">
          
          {/* Conversion Trend */}
          <Card className="shadow-sm">
            <ZoruCardHeader className="pb-2">
              <ZoruCardTitle className="text-base flex justify-between items-center">
                <span>Conversion Trend</span>
                <Badge variant="secondary" className="font-normal text-xs bg-zoru-surface-2">Last 7d</Badge>
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="h-[120px] w-full mt-2">
                <ZoruChartContainer height="100%">
                  <ZoruChart.AreaChart data={FUNNEL_TREND_DATA} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--zoru-brand))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--zoru-brand))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                    <ZoruChart.Area 
                      type="monotone" 
                      dataKey="conversion" 
                      stroke="hsl(var(--zoru-brand))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorConv)" 
                    />
                  </ZoruChart.AreaChart>
                </ZoruChartContainer>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-zoru-ink-muted">Avg. Conversion</span>
                <span className="font-semibold">6.64%</span>
              </div>
            </ZoruCardContent>
          </Card>

          {/* Test Lift Estimate */}
          {activeVariant === "variant" ? (
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-emerald-100/50 shadow-sm relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10">
                <Activity className="size-24 text-emerald-600" />
              </div>
              <ZoruCardHeader className="pb-2 relative z-10">
                <ZoruCardTitle className="text-base flex items-center gap-2 text-emerald-800">
                  <BarChart className="size-4" /> Experiment Results
                </ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent className="relative z-10">
                <div className="text-3xl font-bold text-emerald-700 tracking-tight">+14.5%</div>
                <p className="text-sm text-emerald-800/80 mt-2 leading-relaxed">
                  Variant B is outperforming Control with a <strong>98% statistical significance</strong>.
                  Consider rolling this out to 100% of traffic.
                </p>
                <Button size="sm" className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                  Rollout to 100%
                </Button>
              </ZoruCardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <ZoruCardHeader className="pb-2">
                <ZoruCardTitle className="text-base">Channel Performance</ZoruCardTitle>
                <ZoruCardDescription>Attribution across messaging channels</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <div className="space-y-5 mt-2">
                  {[
                    { name: 'SMS', value: 4.2, color: 'bg-blue-500' },
                    { name: 'MMS', value: 5.8, color: 'bg-purple-500' },
                    { name: 'RCS', value: 8.1, color: 'bg-emerald-500' },
                  ].map((channel) => (
                    <div key={channel.name}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2 font-medium">
                          <div className={`size-2.5 rounded-full ${channel.color}`} />
                          <span>{channel.name}</span>
                        </div>
                        <span className="font-semibold">{channel.value}%</span>
                      </div>
                      <div className="h-2 w-full bg-zoru-surface-2 rounded-full overflow-hidden">
                        <div className={`h-full ${channel.color}`} style={{ width: `${channel.value * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </ZoruCardContent>
            </Card>
          )}

          {/* Segments / Cohorts Drill */}
          <Card className="shadow-sm flex-1">
            <ZoruCardHeader className="pb-3 border-b border-zoru-line/30">
              <ZoruCardTitle className="text-base flex justify-between items-center">
                <span>Top Cohorts</span>
                <Link href="#" className="text-xs text-blue-600 hover:underline">View All</Link>
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="p-0">
              <Table>
                <ZoruTableBody>
                  {[
                    { name: "Active (30d)", rate: "12.1%", trend: "up", val: "+1.2%" },
                    { name: "New Users", rate: "8.4%", trend: "up", val: "+0.8%" },
                    { name: "Dormant", rate: "3.2%", trend: "down", val: "-0.4%" },
                    { name: "Churn Risk", rate: "2.1%", trend: "down", val: "-1.1%", alert: true },
                  ].map((cohort, i) => (
                    <ZoruTableRow key={i} className="border-b-0 hover:bg-zoru-surface-1/50 transition-colors">
                      <ZoruTableCell className="py-3 px-5 text-sm font-medium">
                        {cohort.name}
                      </ZoruTableCell>
                      <ZoruTableCell className="py-3 px-5 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-semibold ${cohort.alert ? 'text-orange-600' : ''}`}>{cohort.rate}</span>
                          <span className={`text-[10px] flex items-center gap-0.5 ${cohort.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {cohort.trend === 'up' ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                            {cohort.val}
                          </span>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </Table>
            </ZoruCardContent>
          </Card>

        </div>
      </div>
    </SabsmsPageShell>
  );
}
