"use client";

import React, { useState } from "react";
import { 

  Activity, AlertTriangle, ArrowRight, BarChart3, Bell, Download, 
  Globe, LineChart, Phone, RefreshCw, Zap, ShieldAlert,
  ServerCrash, ArrowUpRight, ArrowDownRight, Layers, CheckCircle2,
  TrendingUp, ActivitySquare, Network, Cpu, Wifi
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line
} from "recharts";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsExportMenu,
  SabsmsSavedViews,
  useSabsmsUrlState,
} from "@/components/sabsms/page-toolkit";
import { Badge, Button } from '@/components/sabcrm/20ui/compat';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/sabcrm/20ui/compat';


const chartConfig = {
  twilio: { label: "Twilio", color: "hsl(var(--chart-1))" },
  vonage: { label: "Vonage", color: "hsl(var(--chart-2))" },
  plivo: { label: "Plivo", color: "hsl(var(--chart-3))" },
  sinch: { label: "Sinch", color: "hsl(var(--chart-4))" },
};
const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];
export default function DeliverabilityPage({ dlrTrendData, volumeVsDlrData, failureCodeData, regionalPerformanceData, tableDataTemplateDLR }: any) {
  const urlState = useSabsmsUrlState();
  const [activeTab, setActiveTab] = useState("templates");
  const [showReroute, setShowReroute] = useState(true);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--st-bg-muted)]/50 pb-12">
      <SabsmsPageShell
        title="Deliverability Command Center"
        description="Enterprise-grade observability into delivery rates, latency, and carrier anomalies."
        breadcrumbs={[
          { label: "Analytics", href: "/sabsms/analytics" },
          { label: "Deliverability Command Center" }
        ]}
        primaryAction={{
          label: "Refresh Analytics",
          icon: <RefreshCw className="h-4 w-4" />,
          onClick: () => console.log("Refreshing data..."),
        }}
        secondaryActions={[
          {
            label: "Alert Subscriptions",
            icon: <Bell className="h-4 w-4" />,
            onClick: () => console.log("Configuring alerts..."),
          }
        ]}
      >
        {/* Filters and Actions */}
        <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-xl border border-[var(--st-border)] shadow-sm">
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
        </div>

        {/* Massive KPI Row */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe className="h-16 w-16 text-[var(--st-text)]" />
            </div>
            <p className="text-sm text-[var(--st-text)] font-medium uppercase tracking-wider mb-1">Global DLR</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">98.4%</h2>
              <span className="flex items-center text-sm font-medium text-[var(--st-text)] mb-1 bg-[var(--st-bg-muted)] px-2 py-0.5 rounded-full">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                0.6%
              </span>
            </div>
            <p className="text-xs text-[var(--st-text)]">vs 97.8% trailing 7 days</p>
          </div>

          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Layers className="h-16 w-16 text-[var(--st-text)]" />
            </div>
            <p className="text-sm text-[var(--st-text)] font-medium uppercase tracking-wider mb-1">Total Volume</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">3.2M</h2>
              <span className="flex items-center text-sm font-medium text-[var(--st-text)] mb-1 bg-[var(--st-bg-muted)] px-2 py-0.5 rounded-full">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                12.4%
              </span>
            </div>
            <p className="text-xs text-[var(--st-text)]">Messages processed this period</p>
          </div>

          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ActivitySquare className="h-16 w-16 text-[var(--st-text)]" />
            </div>
            <p className="text-sm text-[var(--st-text)] font-medium uppercase tracking-wider mb-1">Avg Latency (p95)</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">2.4s</h2>
              <span className="flex items-center text-sm font-medium text-[var(--st-text)] mb-1 bg-[var(--st-bg-muted)] px-2 py-0.5 rounded-full">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                0.3s
              </span>
            </div>
            <p className="text-xs text-[var(--st-text)]">Elevated latency in APAC region</p>
          </div>

          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldAlert className="h-16 w-16 text-[var(--st-text)]" />
            </div>
            <p className="text-sm text-[var(--st-text)] font-medium uppercase tracking-wider mb-1">Carrier Blocks</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-[var(--st-text)]">1.2%</h2>
              <span className="flex items-center text-sm font-medium text-[var(--st-text)] mb-1 bg-[var(--st-bg-muted)] px-2 py-0.5 rounded-full">
                <ArrowDownRight className="h-3 w-3 mr-1" />
                0.2%
              </span>
            </div>
            <p className="text-xs text-[var(--st-text)]">Improved spam detection rates</p>
          </div>
        </div>

        {/* Machine Learning / Intelligent Reroute Alert */}
        {showReroute && (
          <div className="mb-6 rounded-xl border border-[var(--st-border)] bg-gradient-to-r from-[var(--st-bg-muted)] to-[var(--st-bg-muted)] p-5 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-[var(--st-bg-muted)] p-2 rounded-lg mt-1">
                  <Network className="h-6 w-6 text-[var(--st-text)]" />
                </div>
                <div>
                  <h4 className="font-bold text-[var(--st-text)] text-lg flex items-center gap-2">
                    Intelligent Re-route Recommendation
                    <Badge className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white border-0">AI Optimization</Badge>
                  </h4>
                  <p className="text-[var(--st-text)] mt-1 max-w-3xl">
                    Our routing engine detected a <strong>12% DLR drop</strong> on Plivo for <strong>India (IN)</strong> traffic over the last 2 hours. 
                    Shifting traffic to Twilio will restore DLR to ~94% and reduce p95 latency by 3.1s. Estimated cost impact: +$45/day.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <Button variant="outline" className="border-[var(--st-border)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]" onClick={() => setShowReroute(false)}>
                  Dismiss
                </Button>
                <Button className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white shadow-md shadow-[var(--st-border)]" onClick={() => setShowReroute(false)}>
                  Execute Failover
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          
          {/* Main Area Chart - Takes 2 columns */}
          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm xl:col-span-2 flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg text-[var(--st-text)]">Provider Deliverability Trends</h3>
                <p className="text-sm text-[var(--st-text)]">Real-time delivery rates across top gateway providers</p>
              </div>
              <div className="flex items-center gap-2 bg-[var(--st-bg-muted)] p-1 rounded-lg">
                <button className="px-3 py-1 text-xs font-medium bg-white shadow-sm rounded-md text-[var(--st-text)]">DLR %</button>
                <button className="px-3 py-1 text-xs font-medium text-[var(--st-text)] hover:text-[var(--st-text)] transition-colors">Latency</button>
                <button className="px-3 py-1 text-xs font-medium text-[var(--st-text)] hover:text-[var(--st-text)] transition-colors">Volume</button>
              </div>
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    dy={10} 
                  />
                  <YAxis 
                    domain={[85, 100]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    dx={-10}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ChartTooltip cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="twilio" stroke="var(--color-twilio)" fillOpacity={1} fill="url(#fillTwilio)" strokeWidth={2} />
                  <Area type="monotone" dataKey="vonage" stroke="var(--color-vonage)" fillOpacity={1} fill="url(#fillVonage)" strokeWidth={2} />
                  <Area type="monotone" dataKey="plivo" stroke="var(--color-plivo)" fillOpacity={1} fill="url(#fillPlivo)" strokeWidth={2} />
                  <Area type="monotone" dataKey="sinch" stroke="var(--color-sinch)" fillOpacity={1} fill="url(#fillSinch)" strokeWidth={2} />
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              </ChartContainer>
            </div>
          </div>

          {/* Failure Reasons Donut */}
          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm flex flex-col min-h-[400px]">
            <div className="mb-2">
              <h3 className="font-bold text-lg text-[var(--st-text)]">Failure Telemetry</h3>
              <p className="text-sm text-[var(--st-text)]">Breakdown of non-delivery reasons</p>
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
                <span className="text-xs text-[var(--st-text)] uppercase tracking-wider font-medium">Total Failures</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-4">
              {failureCodeData.slice(0,4).map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--st-text)] truncate w-[100px]" title={item.name}>{item.name.split(' ')[0]}</span>
                    <span className="text-xs text-[var(--st-text)]">{item.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Second Row of Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Composed Chart for Volume vs DLR */}
          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm">
            <div className="mb-6">
              <h3 className="font-bold text-lg text-[var(--st-text)]">Volume vs Deliverability</h3>
              <p className="text-sm text-[var(--st-text)]">Correlation between send volume and delivery success</p>
            </div>
            <div className="h-[300px] w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ComposedChart data={volumeVsDlrData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(val) => `${val/1000}k`} />
                  <YAxis yAxisId="right" orientation="right" domain={[90, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={10} tickFormatter={(val) => `${val}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="left" dataKey="volume" fill="var(--color-volume)" radius={[4, 4, 0, 0]} barSize={30} fillOpacity={0.3} />
                  <Line yAxisId="right" type="monotone" dataKey="dlr" stroke="var(--color-dlr)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-dlr)', strokeWidth: 2, stroke: 'white' }} />
                  <ChartLegend content={<ChartLegendContent />} />
                </ComposedChart>
              </ChartContainer>
            </div>
          </div>

          {/* Regional Performance - Horizontal Bar Chart */}
          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm">
            <div className="mb-6">
              <h3 className="font-bold text-lg text-[var(--st-text)]">Regional Performance</h3>
              <p className="text-sm text-[var(--st-text)]">Delivery rates across global territories</p>
            </div>
            <div className="h-[300px] w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart data={regionalPerformanceData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[80, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                  <YAxis dataKey="region" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }} width={100} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="dlr" radius={[0, 4, 4, 0]} barSize={24}>
                    {regionalPerformanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.dlr > 98 ? '#10b981' : entry.dlr > 95 ? '#3b82f6' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </div>

        {/* Detailed Data Tables Segment */}
        <div className="rounded-xl border border-[var(--st-border)] bg-white shadow-sm flex flex-col overflow-hidden">
          <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/80 px-6 py-4 flex flex-wrap gap-6 text-sm">
            <button 
              onClick={() => setActiveTab('templates')} 
              className={`pb-1 relative font-medium transition-colors ${activeTab === 'templates' ? 'text-[var(--st-text)]' : 'text-[var(--st-text)] hover:text-[var(--st-text)]'}`}
            >
              Template Performance
              {activeTab === 'templates' && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-[var(--st-text)] rounded-t-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('routes')} 
              className={`pb-1 relative font-medium transition-colors ${activeTab === 'routes' ? 'text-[var(--st-text)]' : 'text-[var(--st-text)] hover:text-[var(--st-text)]'}`}
            >
              Route Health
              {activeTab === 'routes' && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-[var(--st-text)] rounded-t-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('anomalies')} 
              className={`pb-1 relative font-medium transition-colors ${activeTab === 'anomalies' ? 'text-[var(--st-text)]' : 'text-[var(--st-text)] hover:text-[var(--st-text)]'}`}
            >
              Detected Anomalies
              <Badge className="ml-2 bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)] px-1.5 py-0 h-5 text-[10px]">3 New</Badge>
              {activeTab === 'anomalies' && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-[var(--st-text)] rounded-t-full"></div>}
            </button>
          </div>
          
          <div className="p-0 flex-1 overflow-x-auto">
            {activeTab === 'templates' && (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-[var(--st-text)] bg-white border-b border-[var(--st-border)] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Template Name</th>
                    <th className="px-6 py-4 font-semibold">Deliverability</th>
                    <th className="px-6 py-4 font-semibold">Volume</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--st-border)]">
                  {tableDataTemplateDLR.map(t => (
                    <tr key={t.id} className="hover:bg-[var(--st-bg-muted)] transition-colors">
                      <td className="px-6 py-4 font-medium text-[var(--st-text)]">{t.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${t.dlr >= 98 ? 'text-[var(--st-text)]' : t.dlr >= 90 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}`}>
                            {t.dlr}%
                          </span>
                          {t.trend === 'up' && <TrendingUp className="h-4 w-4 text-[var(--st-text)]" />}
                          {t.trend === 'down' && <TrendingUp className="h-4 w-4 text-[var(--st-text)] rotate-180" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[var(--st-text)]">{t.volume.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {t.dlr >= 98 ? (
                          <Badge variant="outline" className="text-[var(--st-text)] border-[var(--st-border)] bg-[var(--st-bg-muted)]">Excellent</Badge>
                        ) : t.dlr >= 90 ? (
                          <Badge variant="outline" className="text-[var(--st-text)] border-[var(--st-border)] bg-[var(--st-bg-muted)]">Fair</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[var(--st-text)] border-[var(--st-border)] bg-[var(--st-bg-muted)]">Poor</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">Inspect</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {activeTab === 'routes' && (
              <div className="p-8 text-center text-[var(--st-text)] flex flex-col items-center">
                <Network className="h-12 w-12 text-[var(--st-text-secondary)] mb-3" />
                <h4 className="text-[var(--st-text)] font-medium mb-1">Route Health Matrix</h4>
                <p className="max-w-md text-sm">Detailed route performance matrix is loaded dynamically based on selected timeframe and provider.</p>
                <Button className="mt-4" variant="outline">Load Route Matrix</Button>
              </div>
            )}

            {activeTab === 'anomalies' && (
              <div className="divide-y divide-[var(--st-border)]">
                <div className="p-6 flex items-start gap-4 hover:bg-[var(--st-bg-muted)] transition-colors">
                  <div className="bg-[var(--st-bg-muted)] p-2 rounded-full shrink-0">
                    <AlertTriangle className="h-5 w-5 text-[var(--st-text)]" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[var(--st-text)] font-semibold text-base mb-1">Spam Block Spike: "Promo Flash Sale"</h4>
                    <p className="text-[var(--st-text)] text-sm mb-3">Carrier filtering rates for this template increased by 45% in the last 2 hours, primarily affecting Verizon US subscribers.</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white">Pause Campaign</Button>
                      <Button size="sm" variant="outline">View Filtered Logs</Button>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--st-text-secondary)] font-medium whitespace-nowrap">2 hrs ago</span>
                </div>
                
                <div className="p-6 flex items-start gap-4 hover:bg-[var(--st-bg-muted)] transition-colors">
                  <div className="bg-[var(--st-bg-muted)] p-2 rounded-full shrink-0">
                    <Activity className="h-5 w-5 text-[var(--st-text)]" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[var(--st-text)] font-semibold text-base mb-1">API Throttling: Vonage UK</h4>
                    <p className="text-[var(--st-text)] text-sm mb-3">Sender +44 7700 900000 is hitting rate limits (HTTP 429). 2,400 messages queued.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Adjust Throughput</Button>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--st-text-secondary)] font-medium whitespace-nowrap">4 hrs ago</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </SabsmsPageShell>
    </div>
  );
}
