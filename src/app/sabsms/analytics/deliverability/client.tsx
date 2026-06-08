"use client";

import React, { useState } from "react";
import {
  Activity, AlertTriangle, Bell, Globe, Layers, Network, RefreshCw,
  ShieldAlert, ActivitySquare, TrendingUp, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line,
} from "recharts";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsExportMenu,
  SabsmsSavedViews,
  useSabsmsUrlState,
} from "@/components/sabsms/page-toolkit";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/sabcrm/20ui";

const chartConfig = {
  twilio: { label: "Twilio", color: "var(--st-accent)" },
  vonage: { label: "Vonage", color: "var(--st-status-ok)" },
  plivo: { label: "Plivo", color: "var(--st-warn)" },
  sinch: { label: "Sinch", color: "var(--st-text-secondary)" },
  volume: { label: "Volume", color: "var(--st-accent)" },
  dlr: { label: "Deliverability", color: "var(--st-status-ok)" },
};

// Categorical slices for the failure-telemetry donut. Colour carries the
// category here, so these stay as concrete values (runtime-applied per Cell).
const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];

export default function DeliverabilityPage({ dlrTrendData, volumeVsDlrData, failureCodeData, regionalPerformanceData, tableDataTemplateDLR }: any) {
  const urlState = useSabsmsUrlState();
  const [activeTab, setActiveTab] = useState("templates");
  const [trendMetric, setTrendMetric] = useState("dlr");
  const [showReroute, setShowReroute] = useState(true);

  return (
    <div className="20ui flex h-full flex-col overflow-y-auto bg-[var(--st-bg-secondary)] pb-12">
      <SabsmsPageShell
        title="Deliverability Command Center"
        description="Enterprise-grade observability into delivery rates, latency, and carrier anomalies."
        breadcrumbs={[
          { label: "Analytics", href: "/sabsms/analytics" },
          { label: "Deliverability Command Center" }
        ]}
        primaryAction={{
          label: "Refresh Analytics",
          icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
          onClick: () => console.log("Refreshing data..."),
        }}
        secondaryActions={[
          {
            label: "Alert Subscriptions",
            icon: <Bell className="h-4 w-4" aria-hidden="true" />,
            onClick: () => console.log("Configuring alerts..."),
          }
        ]}
      >
        {/* Filters and Actions */}
        <Card className="mb-6 flex items-center justify-between p-4">
          <SabsmsFilterBar
            searchPlaceholder="Search routes, carriers, or templates..."
            facets={[
              {
                key: "dateRange",
                label: "Timeframe",
                options: [
                  { label: "Last 24 Hours", value: "last_24h" },
                  { label: "Last 7 Days", value: "last_7d" },
                  { label: "Last 30 Days", value: "last_30d" },
                  { label: "Compare: Week over Week", value: "compare_wow" },
                ]
              },
              {
                key: "provider",
                label: "Provider",
                options: [
                  { label: "All Providers", value: "all" },
                  { label: "Twilio", value: "twilio" },
                  { label: "Vonage", value: "vonage" },
                  { label: "Plivo", value: "plivo" },
                ]
              }
            ]}
            trailing={
              <div className="flex gap-2">
                <SabsmsSavedViews
                  currentView={null}
                  savedViews={[{ id: "1", name: "Global Degradation Watch" }]}
                  onSaveCurrentView={() => console.log("Saved")}
                  onSelectView={() => console.log("Selected")}
                  onDeleteView={() => console.log("Deleted")}
                />
                <SabsmsExportMenu
                  onExportCsv={() => console.log("Exporting CSV")}
                  onExportJson={() => console.log("Exporting JSONL")}
                />
              </div>
            }
          />
        </Card>

        {/* Massive KPI Row */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden group p-5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe className="h-16 w-16 text-[var(--st-text)]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-1">Global DLR</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">98.4%</h2>
              <Badge tone="success" className="mb-1">
                <ArrowUpRight className="h-3 w-3 mr-1" aria-hidden="true" />
                0.6%
              </Badge>
            </div>
            <p className="text-xs text-[var(--st-text-tertiary)]">vs 97.8% trailing 7 days</p>
          </Card>

          <Card className="relative overflow-hidden group p-5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Layers className="h-16 w-16 text-[var(--st-text)]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-1">Total Volume</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">3.2M</h2>
              <Badge tone="success" className="mb-1">
                <ArrowUpRight className="h-3 w-3 mr-1" aria-hidden="true" />
                12.4%
              </Badge>
            </div>
            <p className="text-xs text-[var(--st-text-tertiary)]">Messages processed this period</p>
          </Card>

          <Card className="relative overflow-hidden group p-5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ActivitySquare className="h-16 w-16 text-[var(--st-text)]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-1">Avg Latency (p95)</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">2.4s</h2>
              <Badge tone="warning" className="mb-1">
                <ArrowUpRight className="h-3 w-3 mr-1" aria-hidden="true" />
                0.3s
              </Badge>
            </div>
            <p className="text-xs text-[var(--st-text-tertiary)]">Elevated latency in APAC region</p>
          </Card>

          <Card className="relative overflow-hidden group p-5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldAlert className="h-16 w-16 text-[var(--st-text)]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-1">Carrier Blocks</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">1.2%</h2>
              <Badge tone="success" className="mb-1">
                <ArrowDownRight className="h-3 w-3 mr-1" aria-hidden="true" />
                0.2%
              </Badge>
            </div>
            <p className="text-xs text-[var(--st-text-tertiary)]">Improved spam detection rates</p>
          </Card>
        </div>

        {/* Machine Learning / Intelligent Reroute Alert */}
        {showReroute && (
          <Card className="mb-6 p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-[var(--st-bg-secondary)] p-2 rounded-[var(--st-radius)] mt-1">
                  <Network className="h-6 w-6 text-[var(--st-accent)]" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="font-bold text-[var(--st-text)] text-lg flex items-center gap-2">
                    Intelligent Re-route Recommendation
                    <Badge tone="accent">AI Optimization</Badge>
                  </h4>
                  <p className="text-[var(--st-text-secondary)] mt-1 max-w-3xl">
                    Our routing engine detected a <strong>12% DLR drop</strong> on Plivo for <strong>India (IN)</strong> traffic over the last 2 hours.
                    Shifting traffic to Twilio will restore DLR to ~94% and reduce p95 latency by 3.1s. Estimated cost impact: +$45/day.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <Button variant="outline" onClick={() => setShowReroute(false)}>
                  Dismiss
                </Button>
                <Button variant="primary" onClick={() => setShowReroute(false)}>
                  Execute Failover
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">

          {/* Main Area Chart - Takes 2 columns */}
          <Card className="xl:col-span-2 flex flex-col min-h-[400px] p-5">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg text-[var(--st-text)]">Provider Deliverability Trends</h3>
                <p className="text-sm text-[var(--st-text-secondary)]">Real-time delivery rates across top gateway providers</p>
              </div>
              <SegmentedControl
                aria-label="Trend metric"
                size="sm"
                value={trendMetric}
                onChange={setTrendMetric}
                items={[
                  { value: "dlr", label: "DLR %" },
                  { value: "latency", label: "Latency" },
                  { value: "volume", label: "Volume" },
                ]}
              />
            </div>

            <div className="flex-1 w-full mt-2">
              <ChartContainer config={chartConfig} className="h-full w-full min-h-[300px]">
                <AreaChart data={dlrTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillTwilio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-twilio)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-twilio)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillVonage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-vonage)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-vonage)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillPlivo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-plivo)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-plivo)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillSinch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-sinch)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-sinch)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    domain={[85, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
                    dx={-10}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ChartTooltip cursor={{ stroke: 'var(--st-border-strong)', strokeWidth: 1, strokeDasharray: '4 4' }} content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="twilio" stroke="var(--color-twilio)" fillOpacity={1} fill="url(#fillTwilio)" strokeWidth={2} />
                  <Area type="monotone" dataKey="vonage" stroke="var(--color-vonage)" fillOpacity={1} fill="url(#fillVonage)" strokeWidth={2} />
                  <Area type="monotone" dataKey="plivo" stroke="var(--color-plivo)" fillOpacity={1} fill="url(#fillPlivo)" strokeWidth={2} />
                  <Area type="monotone" dataKey="sinch" stroke="var(--color-sinch)" fillOpacity={1} fill="url(#fillSinch)" strokeWidth={2} />
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              </ChartContainer>
            </div>
          </Card>

          {/* Failure Reasons Donut */}
          <Card className="flex flex-col min-h-[400px] p-5">
            <div className="mb-2">
              <h3 className="font-bold text-lg text-[var(--st-text)]">Failure Telemetry</h3>
              <p className="text-sm text-[var(--st-text-secondary)]">Breakdown of non-delivery reasons</p>
            </div>

            <div className="flex-1 w-full relative flex items-center justify-center">
              <ChartContainer config={chartConfig} className="h-full w-full min-h-[250px]">
                <PieChart>
                  <Pie
                    data={failureCodeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {failureCodeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent hideIndicator={true} />} />
                </PieChart>
              </ChartContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-[var(--st-text)]">12.5k</span>
                <span className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider font-medium">Total Failures</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-4">
              {failureCodeData.slice(0,4).map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm shrink-0" aria-hidden="true" style={{ backgroundColor: COLORS[i] }} />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--st-text)] truncate w-[100px]" title={item.name}>{item.name.split(' ')[0]}</span>
                    <span className="text-xs text-[var(--st-text-secondary)]">{item.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Second Row of Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Composed Chart for Volume vs DLR */}
          <Card className="p-5">
            <div className="mb-6">
              <h3 className="font-bold text-lg text-[var(--st-text)]">Volume vs Deliverability</h3>
              <p className="text-sm text-[var(--st-text-secondary)]">Correlation between send volume and delivery success</p>
            </div>
            <div className="h-[300px] w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ComposedChart data={volumeVsDlrData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }} dx={-10} tickFormatter={(val) => `${val/1000}k`} />
                  <YAxis yAxisId="right" orientation="right" domain={[90, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }} dx={10} tickFormatter={(val) => `${val}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="left" dataKey="volume" fill="var(--color-volume)" radius={[4, 4, 0, 0]} barSize={30} fillOpacity={0.3} />
                  <Line yAxisId="right" type="monotone" dataKey="dlr" stroke="var(--color-dlr)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-dlr)', strokeWidth: 2, stroke: 'var(--st-bg)' }} />
                  <ChartLegend content={<ChartLegendContent />} />
                </ComposedChart>
              </ChartContainer>
            </div>
          </Card>

          {/* Regional Performance - Horizontal Bar Chart */}
          <Card className="p-5">
            <div className="mb-6">
              <h3 className="font-bold text-lg text-[var(--st-text)]">Regional Performance</h3>
              <p className="text-sm text-[var(--st-text-secondary)]">Delivery rates across global territories</p>
            </div>
            <div className="h-[300px] w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart data={regionalPerformanceData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--st-border)" />
                  <XAxis type="number" domain={[80, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                  <YAxis dataKey="region" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--st-text-secondary)', fontSize: 12, fontWeight: 500 }} width={100} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="dlr" radius={[0, 4, 4, 0]} barSize={24}>
                    {regionalPerformanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.dlr > 98 ? 'var(--st-status-ok)' : entry.dlr > 95 ? 'var(--st-accent)' : 'var(--st-warn)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </Card>
        </div>

        {/* Detailed Data Tables Segment */}
        <Card padding="none" className="flex flex-col overflow-hidden">
          <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-6 py-4">
            <SegmentedControl
              aria-label="Deliverability detail view"
              size="sm"
              value={activeTab}
              onChange={setActiveTab}
              items={[
                { value: "templates", label: "Template Performance" },
                { value: "routes", label: "Route Health" },
                { value: "anomalies", label: (<span className="flex items-center gap-2">Detected Anomalies<Badge tone="accent">3 New</Badge></span>) },
              ]}
            />
          </div>

          <div className="flex-1 overflow-x-auto">
            {activeTab === 'templates' && (
              <Table hover className="w-full whitespace-nowrap">
                <THead>
                  <Tr>
                    <Th>Template Name</Th>
                    <Th>Deliverability</Th>
                    <Th>Volume</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {tableDataTemplateDLR.map(t => (
                    <Tr key={t.id}>
                      <Td className="font-medium text-[var(--st-text)]">{t.name}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${t.dlr >= 98 ? 'text-[var(--st-status-ok)]' : t.dlr >= 90 ? 'text-[var(--st-text)]' : 'text-[var(--st-danger)]'}`}>
                            {t.dlr}%
                          </span>
                          {t.trend === 'up' && <TrendingUp className="h-4 w-4 text-[var(--st-status-ok)]" aria-hidden="true" />}
                          {t.trend === 'down' && <TrendingUp className="h-4 w-4 text-[var(--st-danger)] rotate-180" aria-hidden="true" />}
                        </div>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">{t.volume.toLocaleString()}</Td>
                      <Td>
                        {t.dlr >= 98 ? (
                          <Badge tone="success">Excellent</Badge>
                        ) : t.dlr >= 90 ? (
                          <Badge tone="info">Fair</Badge>
                        ) : (
                          <Badge tone="danger">Poor</Badge>
                        )}
                      </Td>
                      <Td align="right">
                        <Button variant="ghost" size="sm">Inspect</Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}

            {activeTab === 'routes' && (
              <div className="p-8">
                <EmptyState
                  icon={Network}
                  title="Route Health Matrix"
                  description="Detailed route performance matrix is loaded dynamically based on selected timeframe and provider."
                  action={<Button variant="outline">Load Route Matrix</Button>}
                />
              </div>
            )}

            {activeTab === 'anomalies' && (
              <div className="divide-y divide-[var(--st-border)]">
                <div className="p-6 flex items-start gap-4 hover:bg-[var(--st-bg-secondary)] transition-colors">
                  <div className="bg-[var(--st-bg-secondary)] p-2 rounded-full shrink-0">
                    <AlertTriangle className="h-5 w-5 text-[var(--st-warn)]" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[var(--st-text)] font-semibold text-base mb-1">Spam Block Spike: "Promo Flash Sale"</h4>
                    <p className="text-[var(--st-text-secondary)] text-sm mb-3">Carrier filtering rates for this template increased by 45% in the last 2 hours, primarily affecting Verizon US subscribers.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary">Pause Campaign</Button>
                      <Button size="sm" variant="outline">View Filtered Logs</Button>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--st-text-tertiary)] font-medium whitespace-nowrap">2 hrs ago</span>
                </div>

                <div className="p-6 flex items-start gap-4 hover:bg-[var(--st-bg-secondary)] transition-colors">
                  <div className="bg-[var(--st-bg-secondary)] p-2 rounded-full shrink-0">
                    <Activity className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[var(--st-text)] font-semibold text-base mb-1">API Throttling: Vonage UK</h4>
                    <p className="text-[var(--st-text-secondary)] text-sm mb-3">Sender +44 7700 900000 is hitting rate limits (HTTP 429). 2,400 messages queued.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Adjust Throughput</Button>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--st-text-tertiary)] font-medium whitespace-nowrap">4 hrs ago</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </SabsmsPageShell>
    </div>
  );
}
