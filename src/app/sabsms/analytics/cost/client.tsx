"use client";

import React, { useMemo } from "react";
import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsExportMenu,
  SabsmsSavedViews,
  SabsmsRefreshButton,
} from "@/components/sabsms/page-toolkit";
import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  IconButton,
  CHART_PALETTE,
} from "@/components/sabcrm/20ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/sabcrm/20ui";

import {
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
  ComposedChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Scatter,
} from "recharts";

import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Settings,
  Share2,
  Mail,
  Download,
  Sparkles,
  PauseCircle,
  FileText,
  Target,
  Globe,
  Activity,
  Layers,
  BarChart3,
  PieChart as PieChartIcon,
  MessageSquare,
  Edit3,
} from "lucide-react";

// ==========================================
// CHART CONFIGS (20ui tokens only)
// ==========================================
const trendsChartConfig = {
  revenue: { label: "Revenue", color: "var(--st-status-ok)" },
  spend: { label: "Spend", color: "var(--st-accent)" },
  margin: { label: "Net Margin", color: "var(--st-warn)" },
} satisfies ChartConfig;

const campaignChartConfig = {
  sms: { label: "SMS Spend", color: "var(--st-accent)" },
  mms: { label: "MMS Spend", color: "var(--st-status-ok)" },
} satisfies ChartConfig;

// Token-resolved tooltip surface for raw recharts tooltips.
const tooltipSurface: React.CSSProperties = {
  borderRadius: "var(--st-radius)",
  border: "1px solid var(--st-border)",
  backgroundColor: "var(--st-bg-secondary)",
  color: "var(--st-text)",
};

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
      toolbar={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" iconLeft={Mail} className="hidden sm:flex">
            Schedule Report
          </Button>
          <Button variant="outline" size="sm" iconLeft={Share2} className="hidden sm:flex">
            Share Dashboard
          </Button>
          <SabsmsExportMenu
            onExport={(format) => console.log(`Exporting ${format}...`)}
            options={[
              { id: "csv", label: "Export as CSV", icon: <Download className="w-4 h-4" aria-hidden="true" /> },
              { id: "excel", label: "Export as Excel", icon: <FileText className="w-4 h-4" aria-hidden="true" /> },
              { id: "pdf", label: "Download PDF", icon: <FileText className="w-4 h-4" aria-hidden="true" /> },
            ]}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[var(--st-bg-secondary)] p-4 rounded-[var(--st-radius)] border border-[var(--st-border)]">
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
        <Card variant="outlined" padding="none" className="relative overflow-hidden bg-[var(--st-accent-soft)]">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-32 h-32 text-[var(--st-accent)]" aria-hidden="true" />
          </div>
          <div className="flex flex-col sm:flex-row items-start gap-4 p-5">
            <div className="p-3 bg-[var(--st-accent)]/15 rounded-[var(--st-radius)] text-[var(--st-accent)] shrink-0">
              <Sparkles className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-base font-semibold text-[var(--st-text)] flex items-center gap-3">
                AI Optimization Discovered
                <Badge tone="accent">Est. Savings: $450/mo</Badge>
              </h4>
              <p className="text-sm text-[var(--st-text-secondary)] leading-relaxed max-w-4xl">
                We have analyzed your traffic over the past 30 days. Shifting 15% of your UK traffic from <strong className="text-[var(--st-text)]">Provider A</strong> to <strong className="text-[var(--st-text)]">Provider B</strong> could reduce operational costs by 12% while maintaining a 98.9% deliverability rate.
              </p>
            </div>
            <Button variant="primary" className="shrink-0 mt-2 sm:mt-0">
              Apply Routing Rules
            </Button>
          </div>
        </Card>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="Total Spend"
            value={`$${totalSpend.toLocaleString()}`}
            icon={DollarSign}
            delta={{ value: "+12.5% vs last mo", tone: "up" }}
            accent="var(--st-danger)"
          />
          <StatCard
            label="Total Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            icon={Activity}
            delta={{ value: "+18.2% vs last mo", tone: "up" }}
            accent="var(--st-status-ok)"
          />
          <StatCard
            label="Net Margin"
            value={`${marginPercent}%`}
            icon={TrendingUp}
            delta={{ value: "+4.2% vs last mo", tone: "up" }}
            accent="var(--st-accent)"
          />
          <StatCard
            label="Total Messages"
            value={totalMessages.toLocaleString()}
            icon={MessageSquare}
            delta={{ value: "+8.1% vs last mo", tone: "up" }}
            accent="var(--st-accent)"
          />
          <StatCard
            label="Avg Cost/Msg"
            value={`$${avgCpc.toFixed(4)}`}
            icon={Target}
            delta={{ value: "-2.3% vs last mo", tone: "down" }}
            accent="var(--st-warn)"
          />
          <StatCard
            label="Reseller Markup"
            value="2.5x"
            icon={Layers}
            delta={{ value: "Applied to 14 sub-workspaces", tone: "neutral" }}
            accent="var(--st-accent)"
          />
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="overview"><BarChart3 className="w-4 h-4 mr-2" aria-hidden="true" /> Overview</TabsTrigger>
              <TabsTrigger value="providers"><Layers className="w-4 h-4 mr-2" aria-hidden="true" /> Providers</TabsTrigger>
              <TabsTrigger value="campaigns"><Target className="w-4 h-4 mr-2" aria-hidden="true" /> Campaigns</TabsTrigger>
              <TabsTrigger value="security"><AlertTriangle className="w-4 h-4 mr-2" aria-hidden="true" /> Caps & Alerts</TabsTrigger>
            </TabsList>
            <div className="text-sm text-[var(--st-text-secondary)] hidden md:block">
              Data syncs every 15 minutes. Last sync: <strong className="text-[var(--st-text)]">2 mins ago</strong>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Main Chart */}
            <Card>
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
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--st-border)" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      minTickGap={20}
                      tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }}
                    />
                    <YAxis
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `$${val}`}
                      tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `$${val}`}
                      tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--st-bg-muted)" }}
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" /> Spend by Region</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={countrySpend} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--st-border)" />
                        <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "var(--st-text)", fontSize: 12, fontWeight: 500 }} />
                        <Tooltip
                          cursor={{ fill: "var(--st-bg-muted)" }}
                          contentStyle={tooltipSurface}
                          formatter={(value: any) => [`$${value.toLocaleString()}`, "Total Spend"]}
                        />
                        <Bar dataKey="spend" fill="var(--st-accent)" radius={[0, 4, 4, 0]} barSize={24}>
                          {countrySpend.map((_entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              {/* Provider Spend Pie */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" /> Provider Distribution</CardTitle>
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
                          stroke="var(--st-bg-secondary)"
                          strokeWidth={2}
                        >
                          {providerSpendPie.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [`$${value.toLocaleString()}`, "Spend"]}
                          contentStyle={tooltipSurface}
                          itemStyle={{ color: "var(--st-text)" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-[var(--st-text)]">${totalSpend.toLocaleString()}</span>
                      <span className="text-xs text-[var(--st-text-secondary)] uppercase tracking-wider">Total SMS Spend</span>
                    </div>
                  </div>
                  <div className="w-full md:w-[200px] space-y-3">
                    {providerSpendPie.map((p: any) => (
                      <div key={p.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.fill }} aria-hidden="true" />
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

          <TabsContent value="providers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Provider Performance Radar</CardTitle>
                <CardDescription>Evaluating providers across 5 key dimensions: Delivery, Latency, Support, Features, and Cost Efficiency.</CardDescription>
              </CardHeader>
              <CardBody className="flex flex-col lg:flex-row items-center gap-8 pt-4">
                <div className="h-[400px] w-full lg:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={providerPerformance}>
                      <PolarGrid stroke="var(--st-border)" />
                      <PolarAngleAxis dataKey="provider" tick={{ fill: "var(--st-text)", fontSize: 13, fontWeight: 500 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Delivery Rate" dataKey="delivery" stroke="var(--st-accent)" fill="var(--st-accent)" fillOpacity={0.4} />
                      <Radar name="Latency Score" dataKey="latency" stroke="var(--st-status-ok)" fill="var(--st-status-ok)" fillOpacity={0.4} />
                      <Radar name="Cost Efficiency" dataKey="cost" stroke="var(--st-warn)" fill="var(--st-warn)" fillOpacity={0.4} />
                      <Legend iconType="circle" />
                      <Tooltip contentStyle={tooltipSurface} itemStyle={{ color: "var(--st-text)" }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-1/2 space-y-4">
                  <h4 className="font-semibold text-[var(--st-text)] mb-4">Provider Metrics Breakdown</h4>
                  {providerPerformance.map((p: any) => (
                    <div key={p.provider} className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-base text-[var(--st-text)]">{p.provider}</span>
                        <Badge variant="outline" className="font-mono text-xs">${p.spend.toLocaleString()} spend</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-[var(--st-text-secondary)] text-xs mb-1">Delivery Rate</div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-[var(--st-bg-muted)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--st-accent)] rounded-full" style={{ width: `${p.delivery}%` }} />
                            </div>
                            <span className="font-medium text-[var(--st-text)]">{p.delivery}%</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[var(--st-text-secondary)] text-xs mb-1">Latency Score</div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-[var(--st-bg-muted)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--st-accent)] rounded-full" style={{ width: `${p.latency}%` }} />
                            </div>
                            <span className="font-medium text-[var(--st-text)]">{p.latency}/100</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaign Spend vs. Conversions</CardTitle>
                <CardDescription>Breakdown of SMS and MMS costs per campaign, and resulting conversions.</CardDescription>
              </CardHeader>
              <CardBody>
                <ChartContainer config={campaignChartConfig} className="h-[400px] w-full">
                  <ComposedChart data={campaignSpend} layout="vertical" margin={{ top: 20, right: 20, bottom: 20, left: 40 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--st-border)" />
                    <XAxis type="number" tickFormatter={(val) => `$${val}`} tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "var(--st-text)", fontSize: 13, fontWeight: 500 }} />
                    <ChartTooltip
                      cursor={{ fill: "var(--st-bg-muted)" }}
                      content={<ChartTooltipContent indicator="dashed" />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="sms" stackId="a" fill="var(--color-sms)" radius={[0, 0, 0, 0]} barSize={32} />
                    <Bar dataKey="mms" stackId="a" fill="var(--color-mms)" radius={[0, 4, 4, 0]} barSize={32} />
                    <Scatter dataKey="conversions" fill="var(--st-warn)" shape="star" />
                  </ComposedChart>
                </ChartContainer>
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Caps */}
              <Card>
                <CardHeader className="bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)]">
                  <CardTitle className="text-lg flex items-center gap-2 text-[var(--st-text)]">
                    <Settings className="w-5 h-5" aria-hidden="true" />
                    Budget Enforcements
                  </CardTitle>
                  <CardDescription>Hard limits to prevent accidental overspending</CardDescription>
                </CardHeader>
                <CardBody className="pt-6 space-y-5">
                  <div className="flex flex-col p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-base text-[var(--st-text)]">Workspace Monthly Cap</div>
                        <div className="text-sm text-[var(--st-text-secondary)]">Hard stop at $10,000.00</div>
                      </div>
                      <span className="text-[var(--st-accent)] font-bold text-lg">${totalSpend.toLocaleString()} / $10k</span>
                    </div>
                    <div className="h-3 bg-[var(--st-bg-muted)] rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-[var(--st-accent)] rounded-full" style={{ width: `${(totalSpend / 10000) * 100}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)] font-medium">
                        <PauseCircle className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Auto-pauses all sending when reached
                      </div>
                      <Button variant="outline" size="sm">Adjust Cap</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                      <div className="font-semibold text-sm mb-1 text-[var(--st-text)]">Campaign Level Caps</div>
                      <div className="text-3xl font-bold text-[var(--st-text)] mb-1">3</div>
                      <div className="text-xs text-[var(--st-text-secondary)]">Campaigns have active limits</div>
                    </div>
                    <div className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                      <div className="font-semibold text-sm mb-1 text-[var(--st-text)]">Sender Restrictions</div>
                      <div className="text-3xl font-bold text-[var(--st-text)] mb-1">12</div>
                      <div className="text-xs text-[var(--st-text-secondary)]">Numbers locked from Int'l</div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Anomaly Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[var(--st-warn)]" aria-hidden="true" />
                    Anomaly & Burn-rate Alerts
                  </CardTitle>
                  <CardDescription>Machine learning driven notifications for unexpected spend</CardDescription>
                </CardHeader>
                <CardBody className="space-y-4 pt-4">
                  <div className="group flex items-center justify-between p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] transition-all">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] text-[var(--st-accent)] mt-0.5">
                        <TrendingUp className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-[var(--st-text)]">Velocity Spike Detection</div>
                        <div className="text-xs text-[var(--st-text-secondary)] mt-1 leading-relaxed max-w-[280px]">
                          Alerts immediately when hourly spend exceeds the 7-day moving average by 50%.
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">Email</Badge>
                          <Badge variant="secondary" className="text-[10px]">Slack</Badge>
                        </div>
                      </div>
                    </div>
                    <IconButton label="Edit Velocity Spike Detection alert" icon={Edit3} variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <div className="group flex items-center justify-between p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] transition-all">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] text-[var(--st-accent)] mt-0.5">
                        <DollarSign className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-[var(--st-text)]">Low Prepaid Balance</div>
                        <div className="text-xs text-[var(--st-text-secondary)] mt-1 leading-relaxed max-w-[280px]">
                          Alerts when prepaid balance falls below $500 to prevent service interruption.
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">Email</Badge>
                        </div>
                      </div>
                    </div>
                    <IconButton label="Edit Low Prepaid Balance alert" icon={Edit3} variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" />
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
