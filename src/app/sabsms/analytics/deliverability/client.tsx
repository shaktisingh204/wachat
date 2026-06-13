"use client";

import React, { useState } from "react";
import {
  Globe, Layers, RefreshCw,
  ShieldAlert, ActivitySquare,
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
  SabsmsEmpty,
  rowsToCsv,
} from "@/components/sabsms/page-toolkit";
import {
  Badge,
  Button,
  Card,
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

interface VolumeDlrPoint {
  day: string;
  volume: number;
  dlr: number;
}
interface FailureSlice {
  name: string;
  value: number;
}
interface RegionRow {
  region: string;
  dlr: number;
  volume: number;
}
interface TemplateDlrRow {
  id: string;
  name: string;
  dlr: number;
  volume: number;
}
interface DeliverabilityKpis {
  globalDlr: number;
  totalVolume: number;
  latencyP95Ms: number;
  carrierBlockPct: number;
}
interface DeliverabilityPageProps {
  dlrTrendData: Array<Record<string, number | string>>;
  volumeVsDlrData: VolumeDlrPoint[];
  failureCodeData: FailureSlice[];
  regionalPerformanceData: RegionRow[];
  tableDataTemplateDLR: TemplateDlrRow[];
  kpis: DeliverabilityKpis;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function DeliverabilityPage({
  dlrTrendData,
  volumeVsDlrData,
  failureCodeData,
  regionalPerformanceData,
  tableDataTemplateDLR,
  kpis,
}: DeliverabilityPageProps) {
  const [activeTab, setActiveTab] = useState("templates");
  const [trendMetric, setTrendMetric] = useState("dlr");

  const totalFailures = failureCodeData.reduce((acc, f) => acc + f.value, 0);

  const exportCsv = React.useCallback(
    async () =>
      rowsToCsv(regionalPerformanceData as unknown as Array<Record<string, unknown>>, [
        { key: "region", header: "Region" },
        { key: "dlr", header: "DLR %" },
        { key: "volume", header: "Volume" },
      ]),
    [regionalPerformanceData],
  );

  const exportJson = React.useCallback(
    async () =>
      [...regionalPerformanceData, ...tableDataTemplateDLR]
        .map((r) => JSON.stringify(r))
        .join("\n"),
    [regionalPerformanceData, tableDataTemplateDLR],
  );

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
          href: "/sabsms/analytics/deliverability",
        }}
        secondaryActions={[
          {
            label: "View raw logs",
            icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
            onSelectHref: "/sabsms/logs",
          },
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
                <SabsmsSavedViews scope="analytics:deliverability" />
                <SabsmsExportMenu
                  toCsv={exportCsv}
                  toJson={exportJson}
                  filename="deliverability"
                />
              </div>
            }
          />
        </Card>

        {/* KPI Row — real values from the last 30 days. */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden group p-5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe className="h-16 w-16 text-[var(--st-text)]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-1">Global DLR</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">{kpis.globalDlr}%</h2>
            </div>
            <p className="text-xs text-[var(--st-text-tertiary)]">delivered / total over the last 30 days</p>
          </Card>

          <Card className="relative overflow-hidden group p-5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Layers className="h-16 w-16 text-[var(--st-text)]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-1">Total Volume</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">{fmtCompact(kpis.totalVolume)}</h2>
            </div>
            <p className="text-xs text-[var(--st-text-tertiary)]">Messages processed this period</p>
          </Card>

          <Card className="relative overflow-hidden group p-5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ActivitySquare className="h-16 w-16 text-[var(--st-text)]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-1">Avg Latency (p95)</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">
                {kpis.latencyP95Ms > 0 ? `${(kpis.latencyP95Ms / 1000).toFixed(1)}s` : "—"}
              </h2>
            </div>
            <p className="text-xs text-[var(--st-text-tertiary)]">sent → delivered, avg across providers</p>
          </Card>

          <Card className="relative overflow-hidden group p-5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldAlert className="h-16 w-16 text-[var(--st-text)]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-1">Failure Rate</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">{kpis.carrierBlockPct}%</h2>
            </div>
            <p className="text-xs text-[var(--st-text-tertiary)]">failed / total over the last 30 days</p>
          </Card>
        </div>

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
                    {failureCodeData.map((entry: FailureSlice, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent hideIndicator={true} />} />
                </PieChart>
              </ChartContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-[var(--st-text)]">{fmtCompact(totalFailures)}</span>
                <span className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider font-medium">Failures (7d)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-4">
              {failureCodeData.slice(0,4).map((item: FailureSlice, i: number) => (
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
                  <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                  <YAxis dataKey="region" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--st-text-secondary)', fontSize: 12, fontWeight: 500 }} width={100} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="dlr" radius={[0, 4, 4, 0]} barSize={24}>
                    {regionalPerformanceData.map((entry: RegionRow, index: number) => (
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
                { value: "failures", label: "Failure Codes (7d)" },
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
                  {tableDataTemplateDLR.length === 0 ? (
                    <Tr>
                      <Td colSpan={5} className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
                        No template sends in the last 30 days.
                      </Td>
                    </Tr>
                  ) : (
                    tableDataTemplateDLR.map((t: TemplateDlrRow) => (
                      <Tr key={t.id}>
                        <Td className="font-mono text-xs text-[var(--st-text)]">{t.name}</Td>
                        <Td>
                          <span className={`font-semibold ${t.dlr >= 98 ? 'text-[var(--st-status-ok)]' : t.dlr >= 90 ? 'text-[var(--st-text)]' : 'text-[var(--st-danger)]'}`}>
                            {t.dlr}%
                          </span>
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
                    ))
                  )}
                </TBody>
              </Table>
            )}

            {activeTab === 'failures' && (
              failureCodeData.length === 0 ? (
                <div className="p-8">
                  <SabsmsEmpty
                    icon={<ShieldAlert />}
                    title="No failures in the last 7 days"
                    description="When messages fail, their normalized error codes appear here ranked by frequency."
                  />
                </div>
              ) : (
                <Table hover className="w-full whitespace-nowrap">
                  <THead>
                    <Tr>
                      <Th>Failure Code</Th>
                      <Th align="right">Count</Th>
                      <Th align="right">Share</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {failureCodeData.map((f: FailureSlice) => (
                      <Tr key={f.name}>
                        <Td className="font-mono text-xs text-[var(--st-text)]">{f.name}</Td>
                        <Td align="right" className="tabular-nums">{f.value.toLocaleString()}</Td>
                        <Td align="right" className="text-[var(--st-text-secondary)]">
                          {totalFailures > 0 ? `${Math.round((f.value / totalFailures) * 1000) / 10}%` : "—"}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )
            )}
          </div>
        </Card>
      </SabsmsPageShell>
    </div>
  );
}
