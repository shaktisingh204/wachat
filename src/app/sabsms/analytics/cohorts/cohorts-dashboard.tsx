"use client";

import React, { useState, useMemo } from "react";
import {
  SabsmsFilterBar,
  SabsmsExportMenu,
  SabsmsSavedViews,
  SabsmsDetailDrawer,
  useSabsmsUrlState,
} from "@/components/sabsms/page-toolkit";
import { Sparkles, Filter, Eye, Layers, TrendingUp, Users, Target } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Table, THead, Tr, Th, TBody, Td, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/sabcrm/20ui/compat';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import type { CohortData } from "./actions";

interface CohortsDashboardProps {
  data: CohortData;
  options: {
    sources: { label: string; value: string }[];
    campaigns: { label: string; value: string }[];
  };
}

const COLORS = [
  "#6366f1", // indigo-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ef4444", // red-500
];

export function CohortsDashboard({ data, options }: CohortsDashboardProps) {
  const urlState = useSabsmsUrlState();
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; period: number } | null>(null);
  const [multiMetric, setMultiMetric] = useState(false);

  // Facets for filter bar
  const facets = [
    { id: "source", label: "Source", options: options.sources },
    { id: "campaign", label: "Campaign", options: options.campaigns },
  ];

  // Colors for heatmap
  function getHeatmapColor(percentage: number) {
    if (percentage === 100) return "bg-[var(--st-text)]/5 text-white";
    if (percentage > 80) return "bg-[var(--st-text)] text-white";
    if (percentage > 60) return "bg-[var(--st-text)]/80 text-white";
    if (percentage > 40) return "bg-[var(--st-text)]/60 text-white";
    if (percentage > 20) return "bg-[var(--st-text)]/40 text-white";
    return "bg-[var(--st-text)]/20 text-[var(--st-text)]";
  }

  // Derive chart data
  const chartData = useMemo(() => {
    const periods = Array.from({ length: 6 }, (_, i) => i);
    return periods.map((period) => {
      const point: any = { period: `Month ${period}` };
      data.rows.forEach((row) => {
        const cell = row.cells.find((c) => c.period === period);
        if (cell) point[row.id] = cell.value;
      });
      return point;
    });
  }, [data]);

  const ltvChartData = useMemo(() => {
    const periods = Array.from({ length: 6 }, (_, i) => i);
    return periods.map((period) => {
      const point: any = { period: `Month ${period}` };
      data.rows.forEach((row) => {
        const cell = row.cells.find((c) => c.period === period);
        if (cell && cell.ltv !== undefined) point[row.id] = cell.ltv;
      });
      return point;
    });
  }, [data]);

  // Compute KPIs
  const totalContacts = useMemo(() => data.rows.reduce((acc, row) => acc + row.size, 0), [data]);
  const avgM1Retention = useMemo(() => {
    const m1Cells = data.rows.map(r => r.cells.find(c => c.period === 1)).filter(Boolean);
    if (!m1Cells.length) return 0;
    return Math.round(m1Cells.reduce((acc, cell) => acc + cell!.value, 0) / m1Cells.length);
  }, [data]);
  
  const bestCohort = useMemo(() => {
    let best = { id: "-", val: 0 };
    data.rows.forEach(r => {
      const m1 = r.cells.find(c => c.period === 1);
      if (m1 && m1.value > best.val) best = { id: r.id, val: m1.value };
    });
    return best;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SabsmsFilterBar
          facets={facets}
          onSearch={(q) => urlState.setParam("q", q)}
          onFacetChange={(f, v) => urlState.setParam(f, v)}
          searchPlaceholder="Search cohorts..."
        />
        <div className="flex items-center gap-2">
          <SabsmsSavedViews
            views={[
              { id: "v1", label: "Monthly by First Message", params: { definition: "first-message" } },
              { id: "v2", label: "Weekly by Conversions", params: { metric: "conversions" } }
            ]}
            currentViewId="v1"
            onSelectView={(v) => console.log(v)}
            onSaveCurrent={() => console.log("save")}
          />
          <SabsmsExportMenu
            onExportCsv={() => console.log("export csv")}
            onExportExcel={() => console.log("export excel")}
            onExportJson={() => console.log("export json")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center bg-[var(--st-bg-secondary)] shadow-sm p-4 rounded-xl border border-[var(--st-border)]">
        {/* Definition */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--st-text-secondary)]">Definition:</span>
          <select
            className="text-sm bg-transparent border-none outline-none cursor-pointer font-medium focus:text-[var(--st-text)]"
            value={urlState.params.get("definition") || "first-message"}
            onChange={(e) => urlState.setParam("definition", e.target.value)}
          >
            <option value="first-message">First Message</option>
            <option value="first-reply">First Reply</option>
            <option value="first-click">First Click</option>
          </select>
        </div>

        {/* Metric */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--st-text-secondary)]">Metric:</span>
          <select
            className="text-sm bg-transparent border-none outline-none cursor-pointer font-medium focus:text-[var(--st-text)]"
            value={urlState.params.get("metric") || "sends"}
            onChange={(e) => urlState.setParam("metric", e.target.value)}
          >
            <option value="sends">Sends</option>
            <option value="replies">Replies</option>
            <option value="clicks">Clicks</option>
            <option value="conversions">Conversions</option>
          </select>
        </div>

        {/* Splits */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--st-text-secondary)]">Split by:</span>
          <select
            className="text-sm bg-transparent border-none outline-none cursor-pointer font-medium focus:text-[var(--st-text)]"
            value={urlState.params.get("splitBy") || "none"}
            onChange={(e) => urlState.setParam("splitBy", e.target.value)}
          >
            <option value="none">None</option>
            <option value="locale">Locale</option>
            <option value="provider">Provider</option>
            <option value="template">Template</option>
          </select>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMultiMetric(!multiMetric)}>
            <Layers className="mr-2 h-4 w-4" />
            {multiMetric ? "Single Metric" : "Multi-metric Overlay"}
          </Button>
          <Button variant="outline" size="sm">
            Compare Cohorts
          </Button>
          <Button variant="default" size="sm">
            <Sparkles className="mr-2 h-4 w-4" />
            AI Explain
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="interactive">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-[var(--st-text-secondary)]">Total Cohorted Contacts</CardTitle>
            <div className="h-8 w-8 rounded-full bg-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalContacts.toLocaleString()}</div>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">Across {data.totalCohorts} active cohorts</p>
          </CardContent>
        </Card>
        <Card variant="interactive">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-[var(--st-text-secondary)]">Avg. Month 1 Retention</CardTitle>
            <div className="h-8 w-8 rounded-full bg-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgM1Retention}%</div>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">Industry avg is ~35%</p>
          </CardContent>
        </Card>
        <Card variant="interactive">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-[var(--st-text-secondary)]">Top Performing Cohort</CardTitle>
            <div className="h-8 w-8 rounded-full bg-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
              <Target className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{bestCohort.id}</div>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">{bestCohort.val}% retained in M1</p>
          </CardContent>
        </Card>
      </div>

      {/* Retention Curve Chart */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Retention Curves</CardTitle>
          <CardDescription>Visualizing drop-off rates across all cohorts over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="period" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`${value}%`, undefined]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {data.rows.map((row, idx) => (
                  <Line 
                    key={row.id} 
                    type="monotone" 
                    dataKey={row.id} 
                    stroke={COLORS[idx % COLORS.length]} 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* LTV Curve Chart */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>LTV Over Time</CardTitle>
          <CardDescription>Cumulative Life-Time Value progression across all cohorts over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ltvChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="period" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`$${value}`, undefined]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {data.rows.map((row, idx) => (
                  <Line 
                    key={row.id} 
                    type="monotone" 
                    dataKey={row.id} 
                    stroke={COLORS[(idx + 2) % COLORS.length]} 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Retention Matrix</CardTitle>
          <CardDescription>
            Hover and click cells to drill down into the specific cohort period.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <THead>
              <Tr className="hover:bg-transparent">
                <Th className="w-[180px] pl-6 font-semibold">Cohort</Th>
                <Th className="w-[120px] font-semibold">Initial Size</Th>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Th key={i} className="text-center w-[120px] font-semibold">
                    Month {i}
                  </Th>
                ))}
              </Tr>
            </THead>
            <TBody>
              {data.rows.map((row) => (
                <Tr key={row.id} className="group border-b border-[var(--st-border)]/50 hover:bg-[var(--st-bg-muted)]/30">
                  <Td className="font-medium pl-6">
                    <div className="flex items-center">
                      <span>{row.id}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="sr-only">Open menu</span>
                            <Filter className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem>Save as segment</DropdownMenuItem>
                          <DropdownMenuItem>Save as drip entry trigger</DropdownMenuItem>
                          <DropdownMenuItem>Compare this cohort</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono">{row.size.toLocaleString()}</span>
                  </Td>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const cell = row.cells.find((c) => c.period === i);
                    if (!cell) {
                      return <Td key={i} className="bg-[var(--st-bg-muted)]/10 border-r border-[var(--st-border)]/10 last:border-r-0" />;
                    }
                    const isSelected = selectedCell?.rowId === row.id && selectedCell?.period === i;
                    return (
                      <Td
                        key={i}
                        className={`text-center p-0 border-r border-[var(--st-border)]/10 last:border-r-0`}
                      >
                        <div 
                          className={`h-full w-full m-1 p-2 rounded-md cursor-pointer transition-all hover:scale-[0.98] ${getHeatmapColor(cell.value)} ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-zoru-surface scale-[0.98]" : ""}`}
                          onClick={() => setSelectedCell({ rowId: row.id, period: i })}
                        >
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="font-bold text-[15px]">{cell.value}%</span>
                            {multiMetric && (
                              <span className="text-[11px] opacity-80 font-mono">
                                {cell.absoluteValue.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drill-down Drawer */}
      <SabsmsDetailDrawer
        open={selectedCell !== null}
        onOpenChange={(open) => !open && setSelectedCell(null)}
        title={`Cohort Drill-down`}
        description={selectedCell ? `Viewing ${selectedCell.rowId} at Month ${selectedCell.period}` : ""}
        icon={<Eye className="h-4 w-4" />}
      >
        <div className="space-y-6 py-4">
          <p className="text-sm text-[var(--st-text-secondary)]">
            Detailed breakdown of the contacts in this cohort cell.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Card variant="default" className="bg-[var(--st-bg-muted)]/30">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <p className="text-xs text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-2">Active Contacts</p>
                <p className="text-2xl font-bold font-mono text-[var(--st-text)]">
                  {selectedCell &&
                    data.rows
                      .find((r) => r.id === selectedCell.rowId)
                      ?.cells.find((c) => c.period === selectedCell.period)?.absoluteValue.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card variant="default" className="bg-[var(--st-bg-muted)]/30">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <p className="text-xs text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-2">Retention Rate</p>
                <p className="text-2xl font-bold font-mono text-[var(--st-text)]">
                  {selectedCell &&
                    data.rows
                      .find((r) => r.id === selectedCell.rowId)
                      ?.cells.find((c) => c.period === selectedCell.period)?.value}%
                </p>
              </CardContent>
            </Card>
            <Card variant="default" className="bg-[var(--st-bg-muted)]/30">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <p className="text-xs text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-2">LTV</p>
                <p className="text-2xl font-bold font-mono text-[var(--st-text)]">
                  ${selectedCell &&
                    data.rows
                      .find((r) => r.id === selectedCell.rowId)
                      ?.cells.find((c) => c.period === selectedCell.period)?.ltv}
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-[var(--st-border)]/50">
            <Button variant="default" className="flex-1 shadow-md">
              View Contacts List
            </Button>
            <Button variant="outline" className="flex-1">
              Export CSV
            </Button>
          </div>
        </div>
      </SabsmsDetailDrawer>
    </div>
  );
}
