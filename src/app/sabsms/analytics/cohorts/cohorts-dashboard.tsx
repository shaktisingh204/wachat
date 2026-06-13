"use client";

import React, { useState, useMemo } from "react";
import {
  SabsmsFilterBar,
  SabsmsExportMenu,
  SabsmsSavedViews,
  SabsmsDetailDrawer,
  SabsmsEmpty,
  useSabsmsUrlState,
} from "@/components/sabsms/page-toolkit";
import { Sparkles, Filter, Eye, Layers, TrendingUp, Users, Target } from "lucide-react";
import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Table,
  THead,
  Tr,
  Th,
  TBody,
  Td,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/sabcrm/20ui";
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

  // Facets for filter bar (the bar reads/writes the URL itself).
  const facets = [
    { key: "source", label: "Source", options: options.sources, multi: false },
    { key: "campaign", label: "Campaign", options: options.campaigns, multi: false },
  ];

  // CSV export of the retention matrix (one row per cohort × period).
  const exportCsv = React.useCallback(async () => {
    const header = "cohort,size,period,retentionPct,activeContacts,ltv";
    const lines = data.rows.flatMap((row) =>
      row.cells.map((c) =>
        [row.id, row.size, c.period, c.value, c.absoluteValue, c.ltv].join(","),
      ),
    );
    return [header, ...lines].join("\n");
  }, [data]);

  const exportJson = React.useCallback(
    async () => data.rows.map((r) => JSON.stringify(r)).join("\n"),
    [data],
  );

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
    const m1Cells = data.rows.map((r) => r.cells.find((c) => c.period === 1)).filter(Boolean);
    if (!m1Cells.length) return 0;
    return Math.round(m1Cells.reduce((acc, cell) => acc + cell!.value, 0) / m1Cells.length);
  }, [data]);

  const bestCohort = useMemo(() => {
    let best = { id: "-", val: 0 };
    data.rows.forEach((r) => {
      const m1 = r.cells.find((c) => c.period === 1);
      if (m1 && m1.value > best.val) best = { id: r.id, val: m1.value };
    });
    return best;
  }, [data]);

  if (data.empty || data.rows.length === 0) {
    return (
      <div className="space-y-6">
        <SabsmsFilterBar facets={facets} searchPlaceholder="Search cohorts..." />
        <SabsmsEmpty
          icon={<Users />}
          title="No cohort data yet"
          description="Cohorts are built from the first month you messaged each contact. Send outbound messages and replies will start populating the retention matrix here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SabsmsFilterBar
          facets={facets}
          searchPlaceholder="Search cohorts..."
        />
        <div className="flex items-center gap-2">
          <SabsmsSavedViews scope="analytics:cohorts" />
          <SabsmsExportMenu
            toCsv={exportCsv}
            toJson={exportJson}
            filename="sabsms-cohorts"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center bg-[var(--st-bg-secondary)] shadow-sm p-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
        {/* Definition */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--st-text-secondary)]">Definition:</span>
          <Select
            value={urlState.get("definition") || "first-message"}
            onValueChange={(v) => urlState.setOne("definition", v)}
          >
            <SelectTrigger className="w-[170px]" aria-label="Cohort definition">
              <SelectValue placeholder="First Message" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first-message">First Message</SelectItem>
              <SelectItem value="first-reply">First Reply</SelectItem>
              <SelectItem value="first-click">First Click</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Metric */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--st-text-secondary)]">Metric:</span>
          <Select
            value={urlState.get("metric") || "sends"}
            onValueChange={(v) => urlState.setOne("metric", v)}
          >
            <SelectTrigger className="w-[150px]" aria-label="Cohort metric">
              <SelectValue placeholder="Sends" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sends">Sends</SelectItem>
              <SelectItem value="replies">Replies</SelectItem>
              <SelectItem value="clicks">Clicks</SelectItem>
              <SelectItem value="conversions">Conversions</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Splits */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--st-text-secondary)]">Split by:</span>
          <Select
            value={urlState.get("splitBy") || "none"}
            onValueChange={(v) => urlState.setOne("splitBy", v)}
          >
            <SelectTrigger className="w-[150px]" aria-label="Split cohorts by">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="locale">Locale</SelectItem>
              <SelectItem value="provider">Provider</SelectItem>
              <SelectItem value="template">Template</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={Layers} onClick={() => setMultiMetric(!multiMetric)}>
            {multiMetric ? "Single Metric" : "Multi-metric Overlay"}
          </Button>
          <Button variant="outline" size="sm">
            Compare Cohorts
          </Button>
          <Button variant="primary" size="sm" iconLeft={Sparkles}>
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
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-3xl font-bold">{totalContacts.toLocaleString()}</div>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">Across {data.totalCohorts} active cohorts</p>
          </CardBody>
        </Card>
        <Card variant="interactive">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-[var(--st-text-secondary)]">Avg. Month 1 Retention</CardTitle>
            <div className="h-8 w-8 rounded-full bg-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-3xl font-bold">{avgM1Retention}%</div>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">Industry avg is ~35%</p>
          </CardBody>
        </Card>
        <Card variant="interactive">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-[var(--st-text-secondary)]">Top Performing Cohort</CardTitle>
            <div className="h-8 w-8 rounded-full bg-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
              <Target className="h-4 w-4" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-3xl font-bold">{bestCohort.id}</div>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">{bestCohort.val}% retained in M1</p>
          </CardBody>
        </Card>
      </div>

      {/* Retention Curve Chart */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Retention Curves</CardTitle>
          <CardDescription>Visualizing drop-off rates across all cohorts over time</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
                <XAxis
                  dataKey="period"
                  stroke="var(--st-text-secondary)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--st-text-secondary)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--st-bg-secondary)",
                    borderColor: "var(--st-border)",
                    borderRadius: "var(--st-radius-lg)",
                  }}
                  itemStyle={{ color: "var(--st-text)" }}
                  formatter={(value) => `${value}%`}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
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
        </CardBody>
      </Card>

      {/* LTV Curve Chart */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Cumulative Messages per Contact</CardTitle>
          <CardDescription>Cumulative messages-per-contact by cohort (volume proxy — no per-contact revenue source in SabSMS yet)</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ltvChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
                <XAxis
                  dataKey="period"
                  stroke="var(--st-text-secondary)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--st-text-secondary)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--st-bg-secondary)",
                    borderColor: "var(--st-border)",
                    borderRadius: "var(--st-radius-lg)",
                  }}
                  itemStyle={{ color: "var(--st-text)" }}
                  formatter={(value) => `${value}`}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
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
        </CardBody>
      </Card>

      {/* Heatmap */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Retention Matrix</CardTitle>
          <CardDescription>
            Hover and click cells to drill down into the specific cohort period.
          </CardDescription>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <Table>
            <THead>
              <Tr className="hover:bg-transparent">
                <Th className="w-[180px] pl-6 font-semibold">Cohort</Th>
                <Th className="w-[120px] font-semibold">Initial Size</Th>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Th key={i} align="center" className="w-[120px] font-semibold">
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
                          <IconButton
                            label={`Cohort actions for ${row.id}`}
                            icon={Filter}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          />
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
                      <Td key={i} align="center" className="p-0 border-r border-[var(--st-border)]/10 last:border-r-0">
                        <Button
                          variant="ghost"
                          aria-label={`Open ${row.id} at Month ${i}, ${cell.value} percent retained`}
                          aria-pressed={isSelected}
                          className={`!h-auto !w-[calc(100%-0.5rem)] !min-w-0 !block m-1 !p-2 !rounded-[var(--st-radius)] cursor-pointer text-center transition-all hover:scale-[0.98] [&_.u-btn__label]:block [&_.u-btn__label]:w-full ${getHeatmapColor(cell.value)} ${isSelected ? "ring-2 ring-[var(--st-accent)] ring-offset-2 ring-offset-[var(--st-bg-secondary)] scale-[0.98]" : ""}`}
                          onClick={() => setSelectedCell({ rowId: row.id, period: i })}
                        >
                          <span className="flex flex-col items-center justify-center gap-0.5">
                            <span className="font-bold text-[15px]">{cell.value}%</span>
                            {multiMetric && (
                              <span className="text-[11px] opacity-80 font-mono">
                                {cell.absoluteValue.toLocaleString()}
                              </span>
                            )}
                          </span>
                        </Button>
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      {/* Drill-down Drawer */}
      <SabsmsDetailDrawer
        open={selectedCell !== null}
        onOpenChange={(open) => !open && setSelectedCell(null)}
        title={
          <span className="flex items-center gap-2">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Cohort Drill-down
          </span>
        }
        description={selectedCell ? `Viewing ${selectedCell.rowId} at Month ${selectedCell.period}` : ""}
      >
        <div className="space-y-6 py-4">
          <p className="text-sm text-[var(--st-text-secondary)]">
            Detailed breakdown of the contacts in this cohort cell.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Card variant="outlined" className="bg-[var(--st-bg-muted)]/30">
              <CardBody className="p-4 flex flex-col items-center justify-center text-center h-full">
                <p className="text-xs text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-2">Active Contacts</p>
                <p className="text-2xl font-bold font-mono text-[var(--st-text)]">
                  {selectedCell &&
                    data.rows
                      .find((r) => r.id === selectedCell.rowId)
                      ?.cells.find((c) => c.period === selectedCell.period)?.absoluteValue.toLocaleString()}
                </p>
              </CardBody>
            </Card>
            <Card variant="outlined" className="bg-[var(--st-bg-muted)]/30">
              <CardBody className="p-4 flex flex-col items-center justify-center text-center h-full">
                <p className="text-xs text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-2">Retention Rate</p>
                <p className="text-2xl font-bold font-mono text-[var(--st-text)]">
                  {selectedCell &&
                    data.rows
                      .find((r) => r.id === selectedCell.rowId)
                      ?.cells.find((c) => c.period === selectedCell.period)?.value}%
                </p>
              </CardBody>
            </Card>
            <Card variant="outlined" className="bg-[var(--st-bg-muted)]/30">
              <CardBody className="p-4 flex flex-col items-center justify-center text-center h-full">
                <p className="text-xs text-[var(--st-text-secondary)] font-medium uppercase tracking-wider mb-2">Msgs / Contact</p>
                <p className="text-2xl font-bold font-mono text-[var(--st-text)]">
                  {selectedCell &&
                    data.rows
                      .find((r) => r.id === selectedCell.rowId)
                      ?.cells.find((c) => c.period === selectedCell.period)?.ltv}
                </p>
              </CardBody>
            </Card>
          </div>

          <div className="flex gap-3 pt-4 border-t border-[var(--st-border)]/50">
            <Button variant="primary" className="flex-1 shadow-md">
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
