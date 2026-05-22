"use client";

import React, { useMemo } from "react";
import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsExportMenu,
  SabsmsSavedViews,
  SabsmsRefreshButton,
} from "@/components/sabsms/page-toolkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ReferenceLine, Scatter,
} from "recharts";

import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Settings,
  Share2,
  Mail,
  Download,
  Sparkles,
  PauseCircle,
  FileText,
  Target,
  Percent,
  UploadCloud,
  Edit3,
  Globe,
  Activity,
  Layers,
  BarChart3,
  PieChart as PieChartIcon,
  MessageSquare
} from "lucide-react";

// ==========================================
// MOCK DATA (Expanded for Bulky UI)
// ==========================================
const spendTrendsData = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const baseSpend = 300 + Math.random() * 200;
  const isWeekend = day % 7 === 0 || day % 7 === 6;
  const spend = isWeekend ? baseSpend * 0.6 : baseSpend;
  const revenue = spend * (1.5 + Math.random() * 0.5);
  const margin = revenue - spend;
  const messages = Math.floor(spend / 0.035);
  const cpc = spend / messages;
  return {
    date: `May ${day.toString().padStart(2, "0")}`,
    spend: Math.round(spend),
    revenue: Math.round(revenue),
    margin: Math.round(margin),
    messages,
    cpc: Number(cpc.toFixed(4))
  };
});

const providerPerformance = [
  { provider: "Twilio", spend: 4500, delivery: 98, latency: 85, support: 90, features: 95, cost: 60 },
  { provider: "Vonage", spend: 2100, delivery: 95, latency: 75, support: 80, features: 85, cost: 75 },
  { provider: "Sinch", spend: 1200, delivery: 97, latency: 80, support: 85, features: 80, cost: 85 },
  { provider: "Telnyx", spend: 800, delivery: 99, latency: 95, support: 75, features: 70, cost: 95 },
];

const providerSpendPie = [
  { name: "Twilio", value: 4500, fill: "hsl(var(--chart-1))" },
  { name: "Vonage", value: 2100, fill: "hsl(var(--chart-2))" },
  { name: "Sinch", value: 1200, fill: "hsl(var(--chart-3))" },
  { name: "Telnyx", value: 800, fill: "hsl(var(--chart-4))" },
];

const countrySpend = [
  { name: "United States", spend: 3500, messages: 100000 },
  { name: "United Kingdom", spend: 1800, messages: 51000 },
  { name: "Canada", spend: 1200, messages: 34000 },
  { name: "India", spend: 900, messages: 25000 },
  { name: "Australia", spend: 600, messages: 17000 },
];

const campaignSpend = [
  { name: "Summer Promo", sms: 800, mms: 400, conversions: 150, cpc: 8.0 },
  { name: "Welcome Drip", sms: 600, mms: 250, conversions: 340, cpc: 2.5 },
  { name: "Cart Abandonment", sms: 400, mms: 200, conversions: 120, cpc: 5.0 },
  { name: "Win-back", sms: 300, mms: 150, conversions: 45, cpc: 10.0 },
];

// ==========================================
// CHART CONFIGS
// ==========================================
const trendsChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--chart-2))" },
  spend: { label: "Spend", color: "hsl(var(--chart-1))" },
  margin: { label: "Net Margin", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const campaignChartConfig = {
  sms: { label: "SMS Spend", color: "hsl(var(--chart-4))" },
  mms: { label: "MMS Spend", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

export default function CostAnalyticsPage() {
  const totalSpend = useMemo(() => spendTrendsData.reduce((acc, curr) => acc + curr.spend, 0), []);
  const totalRevenue = useMemo(() => spendTrendsData.reduce((acc, curr) => acc + curr.revenue, 0), []);
  const totalMargin = totalRevenue - totalSpend;
  const totalMessages = useMemo(() => spendTrendsData.reduce((acc, curr) => acc + curr.messages, 0), []);
  const avgCpc = totalSpend / totalMessages;
  const marginPercent = ((totalMargin / totalRevenue) * 100).toFixed(1);

  return (
    <SabsmsPageShell
      title="Cost & Margin Analytics"
      description="Holistic tracking of your SMS spend, provider margins, and budget allocations."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Mail className="w-4 h-4 mr-2" />
            Schedule Report
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Share2 className="w-4 h-4 mr-2" />
            Share Dashboard
          </Button>
          <SabsmsExportMenu
            onExport={(format) => console.log(`Exporting ${format}...`)}
            options={[
              { id: "csv", label: "Export as CSV", icon: <Download className="w-4 h-4" /> },
              { id: "excel", label: "Export as Excel", icon: <FileText className="w-4 h-4" /> },
              { id: "pdf", label: "Download PDF", icon: <FileText className="w-4 h-4" /> }
            ]}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
          <SabsmsFilterBar
            filters={[
              {
                id: "dateRange",
                label: "Date Range",
                type: "select",
                options: [
                  { label: "Last 7 Days", value: "7d" },
                  { label: "Last 30 Days", value: "30d" },
                  { label: "This Quarter", value: "this_quarter" },
                  { label: "Year to Date", value: "ytd" },
                ],
              },
              {
                id: "provider",
                label: "Provider",
                type: "select",
                options: [
                  { label: "All Providers", value: "all" },
                  { label: "Twilio", value: "twilio" },
                  { label: "Vonage", value: "vonage" },
                  { label: "Sinch", value: "sinch" },
                ],
              },
              {
                id: "region",
                label: "Region",
                type: "select",
                options: [
                  { label: "Global", value: "global" },
                  { label: "North America", value: "na" },
                  { label: "Europe", value: "eu" },
                  { label: "Asia Pacific", value: "apac" },
                ],
              },
            ]}
            onFilterChange={() => {}}
          />
          <div className="flex items-center gap-3">
            <SabsmsSavedViews
              views={[
                { id: "v1", name: "Executive Summary", filters: {} },
                { id: "v2", name: "Provider Breakdown", filters: {} },
                { id: "v3", name: "High Cost Routes", filters: {} },
              ]}
              currentViewId="v1"
              onSelectView={() => {}}
              onSaveView={() => {}}
            />
            <SabsmsRefreshButton onRefresh={async () => {}} lastRefreshed={new Date()} />
          </div>
        </div>

        {/* AI Recommendations */}
        <Card className="border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-transparent shadow-sm dark:from-emerald-950/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-32 h-32 text-emerald-500" />
          </div>
          <div className="flex flex-col sm:flex-row items-start gap-4 p-5">
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-base font-semibold text-emerald-950 dark:text-emerald-50 flex items-center gap-3">
                AI Optimization Discovered
                <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium">
                  Est. Savings: $450/mo
                </Badge>
              </h4>
              <p className="text-sm text-emerald-800 dark:text-emerald-200/80 leading-relaxed max-w-4xl">
                We've analyzed your traffic over the past 30 days. Shifting 15% of your UK traffic from <strong>Provider A</strong> to <strong>Provider B</strong> could reduce operational costs by 12% while maintaining a 98.9% deliverability rate.
              </p>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm mt-2 sm:mt-0">
              Apply Routing Rules
            </Button>
          </div>
        </Card>

        {/* Massive KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="Total Spend"
            value={`$${totalSpend.toLocaleString()}`}
            delta={12.5}
            deltaLabel="vs last mo"
            icon={DollarSign}
            tone="coral"
            className="shadow-sm"
            sparkline={
              <div className="h-12 w-full mt-3 -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spendTrendsData}>
                    <Area type="monotone" dataKey="spend" stroke="currentColor" fill="currentColor" fillOpacity={0.15} strokeWidth={2} className="text-coral-500 dark:text-coral-400" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            }
          />
          <StatCard
            label="Total Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            delta={18.2}
            deltaLabel="vs last mo"
            icon={Activity}
            tone="emerald"
            className="shadow-sm"
            sparkline={
              <div className="h-12 w-full mt-3 -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spendTrendsData}>
                    <Area type="monotone" dataKey="revenue" stroke="currentColor" fill="currentColor" fillOpacity={0.15} strokeWidth={2} className="text-emerald-500 dark:text-emerald-400" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            }
          />
          <StatCard
            label="Net Margin"
            value={`${marginPercent}%`}
            delta={4.2}
            deltaLabel="vs last mo"
            icon={TrendingUp}
            tone="indigo"
            className="shadow-sm"
            sparkline={
              <div className="h-12 w-full mt-3 -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spendTrendsData}>
                    <Area type="step" dataKey="margin" stroke="currentColor" fill="currentColor" fillOpacity={0.15} strokeWidth={2} className="text-indigo-500 dark:text-indigo-400" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            }
          />
          <StatCard
            label="Total Messages"
            value={totalMessages.toLocaleString()}
            delta={8.1}
            deltaLabel="vs last mo"
            icon={MessageSquare}
            tone="cyan"
            className="shadow-sm"
            sparkline={
              <div className="h-12 w-full mt-3 -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendTrendsData}>
                    <Bar dataKey="messages" fill="currentColor" radius={[2, 2, 0, 0]} className="fill-cyan-500 dark:fill-cyan-400" opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            }
          />
          <StatCard
            label="Avg Cost/Msg"
            value={`$${avgCpc.toFixed(4)}`}
            delta={-2.3}
            deltaLabel="vs last mo"
            icon={Target}
            tone="violet"
            className="shadow-sm"
            sparkline={
              <div className="h-12 w-full mt-3 -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spendTrendsData}>
                    <Line type="monotone" dataKey="cpc" stroke="currentColor" strokeWidth={2} dot={false} className="text-violet-500 dark:text-violet-400" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            }
          />
          <StatCard
            label="Reseller Markup"
            value="2.5x"
            delta={0}
            deltaLabel="Active Multiplier"
            icon={Layers}
            tone="pink"
            className="shadow-sm"
            sparkline={
              <div className="h-12 w-full mt-3 -mb-2 flex items-end">
                 <div className="w-full text-xs text-muted-foreground pb-2">Applied to 14 sub-workspaces</div>
              </div>
            }
          />
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="h-11 bg-muted/50 p-1">
              <TabsTrigger value="overview" className="h-9 px-4 text-sm"><BarChart3 className="w-4 h-4 mr-2" /> Overview</TabsTrigger>
              <TabsTrigger value="providers" className="h-9 px-4 text-sm"><Layers className="w-4 h-4 mr-2" /> Providers</TabsTrigger>
              <TabsTrigger value="campaigns" className="h-9 px-4 text-sm"><Target className="w-4 h-4 mr-2" /> Campaigns</TabsTrigger>
              <TabsTrigger value="security" className="h-9 px-4 text-sm"><AlertTriangle className="w-4 h-4 mr-2" /> Caps & Alerts</TabsTrigger>
            </TabsList>
            <div className="text-sm text-muted-foreground hidden md:block">
              Data syncs every 15 minutes. Last sync: <strong className="text-foreground">2 mins ago</strong>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Massive Main Chart */}
            <Card className="shadow-sm border-muted">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-xl">Financial Velocity</CardTitle>
                  <CardDescription>Daily revenue vs spend vs net margin over the last 30 days.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <ChartContainer config={trendsChartConfig} className="h-[450px] w-full">
                  <ComposedChart data={spendTrendsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-spend)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-spend)" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={12}
                      minTickGap={20}
                      className="text-xs text-muted-foreground" 
                    />
                    <YAxis 
                      yAxisId="left"
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `$${val}`}
                      className="text-xs text-muted-foreground"
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `$${val}`}
                      className="text-xs text-muted-foreground"
                    />
                    <ChartTooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.4)' }} 
                      content={<ChartTooltipContent indicator="dot" />} 
                    />
                    <ChartLegend content={<ChartLegendContent />} verticalAlign="top" />
                    
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="var(--color-revenue)" 
                      fill="url(#fillRevenue)" 
                      strokeWidth={2}
                      activeDot={{ r: 6 }}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="spend" 
                      fill="url(#fillSpend)" 
                      radius={[4, 4, 0, 0]} 
                      barSize={20}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="margin" 
                      stroke="var(--color-margin)" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: "var(--color-margin)" }}
                    />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Country Breakdown */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" /> Spend by Region</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={countrySpend} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} className="text-xs text-muted-foreground" />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} className="text-xs font-medium text-foreground" />
                        <Tooltip 
                          cursor={{fill: 'hsl(var(--muted)/0.5)'}} 
                          contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                          formatter={(value: any, name: any) => [`$${value.toLocaleString()}`, 'Total Spend']}
                        />
                        <Bar dataKey="spend" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={24}>
                          {countrySpend.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Provider Spend Pie */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-purple-500" /> Provider Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row items-center gap-8">
                  <div className="h-[280px] flex-1 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={providerSpendPie}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        >
                          {providerSpendPie.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => [`$${value.toLocaleString()}`, 'Spend']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-foreground">${(totalSpend).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Total SMS Spend</span>
                    </div>
                  </div>
                  <div className="w-full md:w-[200px] space-y-3">
                    {providerSpendPie.map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.fill }} />
                          <span className="font-medium text-muted-foreground">{p.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">${p.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="providers" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Provider Performance Radar</CardTitle>
                <CardDescription>Evaluating providers across 5 key dimensions: Delivery, Latency, Support, Features, and Cost Efficiency.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col lg:flex-row items-center gap-8 pt-4">
                <div className="h-[400px] w-full lg:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={providerPerformance}>
                      <PolarGrid stroke="hsl(var(--muted-foreground)/0.2)" />
                      <PolarAngleAxis dataKey="provider" tick={{ fill: 'hsl(var(--foreground))', fontSize: 13, fontWeight: 500 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Delivery Rate" dataKey="delivery" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.4} />
                      <Radar name="Latency Score" dataKey="latency" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.4} />
                      <Radar name="Cost Efficiency" dataKey="cost" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.4} />
                      <Legend iconType="circle" />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-1/2 space-y-4">
                  <h4 className="font-semibold text-foreground mb-4">Provider Metrics Breakdown</h4>
                  {providerPerformance.map(p => (
                    <div key={p.provider} className="p-4 rounded-xl border bg-card/50 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-base">{p.provider}</span>
                        <Badge variant="outline" className="font-mono text-xs">${p.spend.toLocaleString()} spend</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs mb-1">Delivery Rate</div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${p.delivery}%` }} />
                            </div>
                            <span className="font-medium">{p.delivery}%</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs mb-1">Latency Score</div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.latency}%` }} />
                            </div>
                            <span className="font-medium">{p.latency}/100</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Campaign Spend vs. Conversions</CardTitle>
                <CardDescription>Breakdown of SMS and MMS costs per campaign, and resulting conversions.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={campaignChartConfig} className="h-[400px] w-full">
                  <ComposedChart data={campaignSpend} layout="vertical" margin={{ top: 20, right: 20, bottom: 20, left: 40 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(val) => `$${val}`} className="text-xs text-muted-foreground" />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} className="text-sm font-medium text-foreground" />
                    <ChartTooltip 
                      cursor={{fill: 'hsl(var(--muted)/0.5)'}} 
                      content={<ChartTooltipContent indicator="dashed" />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="sms" stackId="a" fill="var(--color-sms)" radius={[0, 0, 0, 0]} barSize={32} />
                    <Bar dataKey="mms" stackId="a" fill="var(--color-mms)" radius={[0, 4, 4, 0]} barSize={32} />
                    <Scatter dataKey="conversions" fill="hsl(var(--chart-3))" shape="star" />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Caps */}
              <Card className="shadow-sm border-amber-500/20">
                <CardHeader className="bg-amber-500/5 border-b border-amber-500/10">
                  <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-500">
                    <Settings className="w-5 h-5" />
                    Budget Enforcements
                  </CardTitle>
                  <CardDescription>Hard limits to prevent accidental overspending</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="flex flex-col p-4 rounded-xl border bg-card hover:border-amber-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-base">Workspace Monthly Cap</div>
                        <div className="text-sm text-muted-foreground">Hard stop at $10,000.00</div>
                      </div>
                      <span className="text-amber-600 dark:text-amber-400 font-bold text-lg">${totalSpend.toLocaleString()} / $10k</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full" style={{ width: `${(totalSpend/10000)*100}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <PauseCircle className="w-4 h-4 text-red-500" />
                        Auto-pauses all sending when reached
                      </div>
                      <Button variant="outline" size="sm" className="h-8">Adjust Cap</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border bg-card">
                      <div className="font-semibold text-sm mb-1">Campaign Level Caps</div>
                      <div className="text-3xl font-bold text-foreground mb-1">3</div>
                      <div className="text-xs text-muted-foreground">Campaigns have active limits</div>
                    </div>
                    <div className="p-4 rounded-xl border bg-card">
                      <div className="font-semibold text-sm mb-1">Sender Restrictions</div>
                      <div className="text-3xl font-bold text-foreground mb-1">12</div>
                      <div className="text-xs text-muted-foreground">Numbers locked from Int'l</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Anomaly Alerts */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                    Anomaly & Burn-rate Alerts
                  </CardTitle>
                  <CardDescription>Machine learning driven notifications for unexpected spend</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="group flex items-center justify-between p-4 rounded-xl border border-muted hover:border-foreground/20 transition-all bg-card hover:shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400 mt-0.5">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Velocity Spike Detection</div>
                        <div className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[280px]">
                          Alerts immediately when hourly spend exceeds the 7-day moving average by 50%.
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">Email</Badge>
                          <Badge variant="secondary" className="text-[10px]">Slack</Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="group flex items-center justify-between p-4 rounded-xl border border-muted hover:border-foreground/20 transition-all bg-card hover:shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 mt-0.5">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Low Prepaid Balance</div>
                        <div className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[280px]">
                          Alerts when prepaid balance falls below $500 to prevent service interruption.
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">Email</Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SabsmsPageShell>
  );
}
