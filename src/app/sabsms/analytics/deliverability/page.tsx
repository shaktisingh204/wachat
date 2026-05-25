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
import { Badge, Button } from "@/components/zoruui";
import { 
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent 
} from "@/components/ui/chart";

// Extended mock data to make it look massively data-rich
const dlrTrendData = [
  { time: "00:00", twilio: 98.2, vonage: 99.1, plivo: 95.0, sinch: 97.5 },
  { time: "02:00", twilio: 97.8, vonage: 98.4, plivo: 94.2, sinch: 96.1 },
  { time: "04:00", twilio: 97.5, vonage: 98.1, plivo: 94.0, sinch: 95.8 },
  { time: "06:00", twilio: 98.9, vonage: 99.3, plivo: 96.4, sinch: 98.2 },
  { time: "08:00", twilio: 99.2, vonage: 99.5, plivo: 96.8, sinch: 98.5 },
  { time: "10:00", twilio: 99.1, vonage: 99.4, plivo: 96.5, sinch: 98.3 },
  { time: "12:00", twilio: 95.5, vonage: 97.2, plivo: 89.1, sinch: 93.4 }, // Dip
  { time: "14:00", twilio: 96.8, vonage: 98.1, plivo: 91.5, sinch: 94.8 },
  { time: "16:00", twilio: 98.5, vonage: 98.9, plivo: 95.2, sinch: 97.5 },
  { time: "18:00", twilio: 98.8, vonage: 99.1, plivo: 96.0, sinch: 98.0 },
  { time: "20:00", twilio: 99.1, vonage: 99.3, plivo: 97.1, sinch: 98.4 },
  { time: "22:00", twilio: 99.3, vonage: 99.5, plivo: 97.5, sinch: 98.6 },
];

const chartConfig = {
  twilio: { label: "Twilio", color: "#2563eb" },
  vonage: { label: "Vonage", color: "#16a34a" },
  plivo: { label: "Plivo", color: "#ea580c" },
  sinch: { label: "Sinch", color: "#9333ea" },
  value: { label: "Value" },
  volume: { label: "Volume", color: "#94a3b8" },
  dlr: { label: "DLR %", color: "#2563eb" },
};

const volumeVsDlrData = [
  { day: "Mon", volume: 120000, dlr: 98.5 },
  { day: "Tue", volume: 150000, dlr: 98.1 },
  { day: "Wed", volume: 180000, dlr: 97.5 },
  { day: "Thu", volume: 140000, dlr: 98.8 },
  { day: "Fri", volume: 210000, dlr: 96.2 },
  { day: "Sat", volume: 90000, dlr: 99.1 },
  { day: "Sun", volume: 85000, dlr: 99.4 },
];

const failureCodeData = [
  { name: "30008 (Unknown)", value: 4200 },
  { name: "30004 (Carrier Block)", value: 3100 },
  { name: "30005 (Unknown Dest)", value: 2800 },
  { name: "30003 (Unreachable)", value: 1500 },
  { name: "30007 (Carrier Violation)", value: 900 },
];
const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];

const regionalPerformanceData = [
  { region: "North America", dlr: 99.2, latency: 0.8 },
  { region: "Europe", dlr: 98.7, latency: 1.2 },
  { region: "Asia Pacific", dlr: 94.5, latency: 3.5 },
  { region: "Latin America", dlr: 92.1, latency: 4.1 },
  { region: "Middle East", dlr: 95.8, latency: 2.8 },
];

const tableDataTemplateDLR = [
  { id: "tmpl_1", name: "OTP Verification", dlr: 99.5, volume: 1250000, trend: "up" },
  { id: "tmpl_2", name: "Promo Flash Sale", dlr: 88.2, volume: 450000, trend: "down" },
  { id: "tmpl_3", name: "Order Shipped", dlr: 99.9, volume: 820000, trend: "up" },
  { id: "tmpl_4", name: "Account Alert", dlr: 99.1, volume: 340000, trend: "stable" },
  { id: "tmpl_5", name: "Re-engagement", dlr: 82.5, volume: 150000, trend: "down" },
];

export default function DeliverabilityPage() {
  const urlState = useSabsmsUrlState();
  const [activeTab, setActiveTab] = useState("templates");
  const [showReroute, setShowReroute] = useState(true);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50 pb-12">
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
        <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
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
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe className="h-16 w-16 text-blue-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Global DLR</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-slate-900">98.4%</h2>
              <span className="flex items-center text-sm font-medium text-emerald-600 mb-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                0.6%
              </span>
            </div>
            <p className="text-xs text-slate-500">vs 97.8% trailing 7 days</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Layers className="h-16 w-16 text-indigo-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Total Volume</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-slate-900">3.2M</h2>
              <span className="flex items-center text-sm font-medium text-emerald-600 mb-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                12.4%
              </span>
            </div>
            <p className="text-xs text-slate-500">Messages processed this period</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ActivitySquare className="h-16 w-16 text-amber-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Avg Latency (p95)</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-slate-900">2.4s</h2>
              <span className="flex items-center text-sm font-medium text-red-600 mb-1 bg-red-50 px-2 py-0.5 rounded-full">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                0.3s
              </span>
            </div>
            <p className="text-xs text-slate-500">Elevated latency in APAC region</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldAlert className="h-16 w-16 text-rose-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Carrier Blocks</p>
            <div className="flex items-end gap-3 mb-2">
              <h2 className="text-4xl font-bold text-slate-900">1.2%</h2>
              <span className="flex items-center text-sm font-medium text-emerald-600 mb-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                <ArrowDownRight className="h-3 w-3 mr-1" />
                0.2%
              </span>
            </div>
            <p className="text-xs text-slate-500">Improved spam detection rates</p>
          </div>
        </div>

        {/* Machine Learning / Intelligent Reroute Alert */}
        {showReroute && (
          <div className="mb-6 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-indigo-100 p-2 rounded-lg mt-1">
                  <Network className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-bold text-indigo-900 text-lg flex items-center gap-2">
                    Intelligent Re-route Recommendation
                    <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border-0">AI Optimization</Badge>
                  </h4>
                  <p className="text-indigo-800 mt-1 max-w-3xl">
                    Our routing engine detected a <strong>12% DLR drop</strong> on Plivo for <strong>India (IN)</strong> traffic over the last 2 hours. 
                    Shifting traffic to Twilio will restore DLR to ~94% and reduce p95 latency by 3.1s. Estimated cost impact: +$45/day.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <Button variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-100" onClick={() => setShowReroute(false)}>
                  Dismiss
                </Button>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200" onClick={() => setShowReroute(false)}>
                  Execute Failover
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          
          {/* Main Area Chart - Takes 2 columns */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2 flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Provider Deliverability Trends</h3>
                <p className="text-sm text-slate-500">Real-time delivery rates across top gateway providers</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button className="px-3 py-1 text-xs font-medium bg-white shadow-sm rounded-md text-slate-900">DLR %</button>
                <button className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">Latency</button>
                <button className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">Volume</button>
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
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col min-h-[400px]">
            <div className="mb-2">
              <h3 className="font-bold text-lg text-slate-900">Failure Telemetry</h3>
              <p className="text-sm text-slate-500">Breakdown of non-delivery reasons</p>
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
                <span className="text-3xl font-bold text-slate-900">12.5k</span>
                <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Failures</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-4">
              {failureCodeData.slice(0,4).map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-700 truncate w-[100px]" title={item.name}>{item.name.split(' ')[0]}</span>
                    <span className="text-xs text-slate-500">{item.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Second Row of Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Composed Chart for Volume vs DLR */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6">
              <h3 className="font-bold text-lg text-slate-900">Volume vs Deliverability</h3>
              <p className="text-sm text-slate-500">Correlation between send volume and delivery success</p>
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
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6">
              <h3 className="font-bold text-lg text-slate-900">Regional Performance</h3>
              <p className="text-sm text-slate-500">Delivery rates across global territories</p>
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
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4 flex flex-wrap gap-6 text-sm">
            <button 
              onClick={() => setActiveTab('templates')} 
              className={`pb-1 relative font-medium transition-colors ${activeTab === 'templates' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Template Performance
              {activeTab === 'templates' && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('routes')} 
              className={`pb-1 relative font-medium transition-colors ${activeTab === 'routes' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Route Health
              {activeTab === 'routes' && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('anomalies')} 
              className={`pb-1 relative font-medium transition-colors ${activeTab === 'anomalies' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Detected Anomalies
              <Badge className="ml-2 bg-rose-100 text-rose-700 border-rose-200 px-1.5 py-0 h-5 text-[10px]">3 New</Badge>
              {activeTab === 'anomalies' && <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
            </button>
          </div>
          
          <div className="p-0 flex-1 overflow-x-auto">
            {activeTab === 'templates' && (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-slate-500 bg-white border-b border-slate-100 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Template Name</th>
                    <th className="px-6 py-4 font-semibold">Deliverability</th>
                    <th className="px-6 py-4 font-semibold">Volume</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableDataTemplateDLR.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{t.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${t.dlr >= 98 ? 'text-emerald-600' : t.dlr >= 90 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {t.dlr}%
                          </span>
                          {t.trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                          {t.trend === 'down' && <TrendingUp className="h-4 w-4 text-rose-500 rotate-180" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{t.volume.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {t.dlr >= 98 ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">Excellent</Badge>
                        ) : t.dlr >= 90 ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Fair</Badge>
                        ) : (
                          <Badge variant="outline" className="text-rose-700 border-rose-200 bg-rose-50">Poor</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50">Inspect</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {activeTab === 'routes' && (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                <Network className="h-12 w-12 text-slate-300 mb-3" />
                <h4 className="text-slate-900 font-medium mb-1">Route Health Matrix</h4>
                <p className="max-w-md text-sm">Detailed route performance matrix is loaded dynamically based on selected timeframe and provider.</p>
                <Button className="mt-4" variant="outline">Load Route Matrix</Button>
              </div>
            )}

            {activeTab === 'anomalies' && (
              <div className="divide-y divide-slate-100">
                <div className="p-6 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                  <div className="bg-rose-100 p-2 rounded-full shrink-0">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-slate-900 font-semibold text-base mb-1">Spam Block Spike: "Promo Flash Sale"</h4>
                    <p className="text-slate-600 text-sm mb-3">Carrier filtering rates for this template increased by 45% in the last 2 hours, primarily affecting Verizon US subscribers.</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white">Pause Campaign</Button>
                      <Button size="sm" variant="outline">View Filtered Logs</Button>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-medium whitespace-nowrap">2 hrs ago</span>
                </div>
                
                <div className="p-6 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                  <div className="bg-amber-100 p-2 rounded-full shrink-0">
                    <Activity className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-slate-900 font-semibold text-base mb-1">API Throttling: Vonage UK</h4>
                    <p className="text-slate-600 text-sm mb-3">Sender +44 7700 900000 is hitting rate limits (HTTP 429). 2,400 messages queued.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Adjust Throughput</Button>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-medium whitespace-nowrap">4 hrs ago</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </SabsmsPageShell>
    </div>
  );
}
