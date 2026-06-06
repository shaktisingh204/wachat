"use client";

import React, { useMemo } from "react";
import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsExportMenu,
  SabsmsSavedViews,
  SabsmsRefreshButton,
} from "@/components/sabsms/page-toolkit";
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, CardFooter, Badge, Tabs, TabsContent, TabsList, TabsTrigger, StatCard } from '@/components/sabcrm/20ui';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/sabcrm/20ui';

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

export default function CostAnalyticsPage({ spendTrendsData, providerPerformance, providerSpendPie, countrySpend, campaignSpend }: any) {
  const totalSpend = useMemo(() => spendTrendsData.reduce((acc: any, curr: any) => acc + curr.spend, 0), [spendTrendsData]);
  const totalRevenue = useMemo(() => spendTrendsData.reduce((acc: any, curr: any) => acc + curr.revenue, 0), [spendTrendsData]);
  const totalMargin = totalRevenue - totalSpend;
  const totalMessages = useMemo(() => spendTrendsData.reduce((acc: any, curr: any) => acc + (curr.messages || 0), 0), [spendTrendsData]);
  const avgCpc = totalMessages > 0 ? totalSpend / totalMessages : 0;
  const marginPercent = totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(1) : "0.0";

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
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[var(--st-bg-secondary)] p-4 rounded-xl border shadow-sm">
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
        <Card className="border-[var(--st-border)]/40 bg-gradient-to-r from-[var(--st-text)]/10 to-transparent shadow-sm dark:from-[var(--st-text)]/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-32 h-32 text-[var(--st-text)]" />
          </div>
          <div className="flex flex-col sm:flex-row items-start gap-4 p-5">
            <div className="p-3 bg-[var(--st-text)]/20 rounded-xl text-[var(--st-text)] dark:text-[var(--st-text-secondary)] shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-base font-semibold text-[var(--st-text)] dark:text-white flex items-center gap-3">
                AI Optimization Discovered
                <Badge variant="secondary" className="bg-[var(--st-text)]/20 text-[var(--st-text)] dark:text-[var(--st-text-secondary)] border-[var(--st-border)]/30 font-medium">
                  Est. Savings: $450/mo
                </Badge>
              </h4>
              <p className="text-sm text-[var(--st-text)] dark:text-white/80 leading-relaxed max-w-4xl">
                We've analyzed your traffic over the past 30 days. Shifting 15% of your UK traffic from <strong>Provider A</strong> to <strong>Provider B</strong> could reduce operational costs by 12% while maintaining a 98.9% deliverability rate.
              </p>
            </div>
            <Button className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white shrink-0 shadow-sm mt-2 sm:mt-0">
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
                    <Area type="monotone" dataKey="revenue" stroke="currentColor" fill="currentColor" fillOpacity={0.15} strokeWidth={2} className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]" />
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
                    <Area type="step" dataKey="margin" stroke="currentColor" fill="currentColor" fillOpacity={0.15} strokeWidth={2} className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]" />
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
                    <Bar dataKey="messages" fill="currentColor" radius={[2, 2, 0, 0]} className="fill-[var(--st-text)] dark:fill-[var(--st-text-secondary)]" opacity={0.5} />
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
                    <Line type="monotone" dataKey="cpc" stroke="currentColor" strokeWidth={2} dot={false} className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]" />
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
                 <div className="w-full text-xs text-[var(--st-text-secondary)] pb-2">Applied to 14 sub-workspaces</div>
              </div>
            }
          />
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="h-11 bg-[var(--st-bg-muted)]/50 p-1">
              <TabsTrigger value="overview" className="h-9 px-4 text-sm"><BarChart3 className="w-4 h-4 mr-2" /> Overview</TabsTrigger>
              <TabsTrigger value="providers" className="h-9 px-4 text-sm"><Layers className="w-4 h-4 mr-2" /> Providers</TabsTrigger>
              <TabsTrigger value="campaigns" className="h-9 px-4 text-sm"><Target className="w-4 h-4 mr-2" /> Campaigns</TabsTrigger>
              <TabsTrigger value="security" className="h-9 px-4 text-sm"><AlertTriangle className="w-4 h-4 mr-2" /> Caps & Alerts</TabsTrigger>
            </TabsList>
            <div className="text-sm text-[var(--st-text-secondary)] hidden md:block">
              Data syncs every 15 minutes. Last sync: <strong className="text-[var(--st-text)]">2 mins ago</strong>
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
              <CardBody className="pt-4">
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
                      className="text-xs text-[var(--st-text-secondary)]" 
                    />
                    <YAxis 
                      yAxisId="left"
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `$${val}`}
                      className="text-xs text-[var(--st-text-secondary)]"
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `$${val}`}
                      className="text-xs text-[var(--st-text-secondary)]"
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
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Country Breakdown */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-[var(--st-text)]" /> Spend by Region</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={countrySpend} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} className="text-xs text-[var(--st-text-secondary)]" />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} className="text-xs font-medium text-[var(--st-text)]" />
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
                </CardBody>
              </Card>

              {/* Provider Spend Pie */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-[var(--st-text)]" /> Provider Distribution</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col md:flex-row items-center gap-8">
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
                      <span className="text-3xl font-bold text-[var(--st-text)]">${(totalSpend).toLocaleString()}</span>
                      <span className="text-xs text-[var(--st-text-secondary)] uppercase tracking-wider">Total SMS Spend</span>
                    </div>
                  </div>
                  <div className="w-full md:w-[200px] space-y-3">
                    {providerSpendPie.map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.fill }} />
                          <span className="font-medium text-[var(--st-text-secondary)]">{p.name}</span>
                        </div>
                        <span className="font-semibold text-[var(--st-text)]">${p.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="providers" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Provider Performance Radar</CardTitle>
                <CardDescription>Evaluating providers across 5 key dimensions: Delivery, Latency, Support, Features, and Cost Efficiency.</CardDescription>
              </CardHeader>
              <CardBody className="flex flex-col lg:flex-row items-center gap-8 pt-4">
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
                  <h4 className="font-semibold text-[var(--st-text)] mb-4">Provider Metrics Breakdown</h4>
                  {providerPerformance.map(p => (
                    <div key={p.provider} className="p-4 rounded-xl border bg-[var(--st-bg-secondary)]/50 hover:bg-[var(--st-bg-muted)]/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-base">{p.provider}</span>
                        <Badge variant="outline" className="font-mono text-xs">${p.spend.toLocaleString()} spend</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-[var(--st-text-secondary)] text-xs mb-1">Delivery Rate</div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-[var(--st-bg-muted)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--st-text)] rounded-full" style={{ width: `${p.delivery}%` }} />
                            </div>
                            <span className="font-medium">{p.delivery}%</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[var(--st-text-secondary)] text-xs mb-1">Latency Score</div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-[var(--st-bg-muted)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--st-text)] rounded-full" style={{ width: `${p.latency}%` }} />
                            </div>
                            <span className="font-medium">{p.latency}/100</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Campaign Spend vs. Conversions</CardTitle>
                <CardDescription>Breakdown of SMS and MMS costs per campaign, and resulting conversions.</CardDescription>
              </CardHeader>
              <CardBody>
                <ChartContainer config={campaignChartConfig} className="h-[400px] w-full">
                  <ComposedChart data={campaignSpend} layout="vertical" margin={{ top: 20, right: 20, bottom: 20, left: 40 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(val) => `$${val}`} className="text-xs text-[var(--st-text-secondary)]" />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} className="text-sm font-medium text-[var(--st-text)]" />
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
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Caps */}
              <Card className="shadow-sm border-[var(--st-border)]/20">
                <CardHeader className="bg-[var(--st-text)]/5 border-b border-[var(--st-border)]/10">
                  <CardTitle className="text-lg flex items-center gap-2 text-[var(--st-text)] dark:text-[var(--st-text)]">
                    <Settings className="w-5 h-5" />
                    Budget Enforcements
                  </CardTitle>
                  <CardDescription>Hard limits to prevent accidental overspending</CardDescription>
                </CardHeader>
                <CardBody className="pt-6 space-y-5">
                  <div className="flex flex-col p-4 rounded-xl border bg-[var(--st-bg-secondary)] hover:border-[var(--st-border)]/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-base">Workspace Monthly Cap</div>
                        <div className="text-sm text-[var(--st-text-secondary)]">Hard stop at $10,000.00</div>
                      </div>
                      <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)] font-bold text-lg">${totalSpend.toLocaleString()} / $10k</span>
                    </div>
                    <div className="h-3 bg-[var(--st-bg-muted)] rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-gradient-to-r from-[var(--st-bg-muted)] to-[var(--st-text)] rounded-full" style={{ width: `${(totalSpend/10000)*100}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)] font-medium">
                        <PauseCircle className="w-4 h-4 text-[var(--st-text)]" />
                        Auto-pauses all sending when reached
                      </div>
                      <Button variant="outline" size="sm" className="h-8">Adjust Cap</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border bg-[var(--st-bg-secondary)]">
                      <div className="font-semibold text-sm mb-1">Campaign Level Caps</div>
                      <div className="text-3xl font-bold text-[var(--st-text)] mb-1">3</div>
                      <div className="text-xs text-[var(--st-text-secondary)]">Campaigns have active limits</div>
                    </div>
                    <div className="p-4 rounded-xl border bg-[var(--st-bg-secondary)]">
                      <div className="font-semibold text-sm mb-1">Sender Restrictions</div>
                      <div className="text-3xl font-bold text-[var(--st-text)] mb-1">12</div>
                      <div className="text-xs text-[var(--st-text-secondary)]">Numbers locked from Int'l</div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Anomaly Alerts */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[var(--st-text)]" />
                    Anomaly & Burn-rate Alerts
                  </CardTitle>
                  <CardDescription>Machine learning driven notifications for unexpected spend</CardDescription>
                </CardHeader>
                <CardBody className="space-y-4 pt-4">
                  <div className="group flex items-center justify-between p-4 rounded-xl border border-muted hover:border-foreground/20 transition-all bg-[var(--st-bg-secondary)] hover:shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/30 rounded-lg text-[var(--st-text)] dark:text-[var(--st-text-secondary)] mt-0.5">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Velocity Spike Detection</div>
                        <div className="text-xs text-[var(--st-text-secondary)] mt-1 leading-relaxed max-w-[280px]">
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

                  <div className="group flex items-center justify-between p-4 rounded-xl border border-muted hover:border-foreground/20 transition-all bg-[var(--st-bg-secondary)] hover:shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/30 rounded-lg text-[var(--st-text)] dark:text-[var(--st-text-secondary)] mt-0.5">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Low Prepaid Balance</div>
                        <div className="text-xs text-[var(--st-text-secondary)] mt-1 leading-relaxed max-w-[280px]">
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
                </CardBody>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SabsmsPageShell>
  );
}
