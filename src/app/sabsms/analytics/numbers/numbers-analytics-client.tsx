"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Pause, Archive, Sparkles, AlertTriangle, 
  Share, PieChart, FileText,
  Activity, ArrowRight, Settings, Mail
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  type SabsmsColumn,
  type SabsmsRowAction,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsSavedViews,
  SabsmsColumnPicker,
  useSabsmsUrlState,
  rowsToCsv
} from "@/components/sabsms/page-toolkit";

import { Badge, Button, Progress } from "@/components/sabcrm/20ui/zoru";

export interface NumberTrendData {
  date: string;
  delivered: number;
  failed: number;
}

export interface CapacityData {
  hour: string;
  utilized: number;
  available: number;
}

export interface NumberScorecardRow {
  id: string;
  e164: string;
  provider: string;
  status: string;
  deliverabilityScore: number;
  complaintRate: number;
  costPerDelivered: number;
  replyRate: number;
  blockRate: number;
  banRisk: "low" | "medium" | "high";
  warmupProgress: number;
  totalVolume: number;
  carrierBreakdown: {
    att: number;
    verizon: number;
    tmobile: number;
  };
  trend?: NumberTrendData[];
}

interface NumbersAnalyticsClientProps {
  rows: NumberScorecardRow[];
  capacityData: CapacityData[];
}

export function NumbersAnalyticsClient({ rows, capacityData }: NumbersAnalyticsClientProps) {
  const router = useRouter();
  const urlState = useSabsmsUrlState();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailRow, setDetailRow] = useState<NumberScorecardRow | null>(null);

  // Filters
  const q = urlState.get("q")?.toLowerCase() || "";
  const filterBanRisk = urlState.getAll("banRisk");
  const filterProvider = urlState.getAll("provider");
  const filterPeriod = urlState.get("period") || "7d"; // 11. Compare two periods

  const filteredRows = rows.filter((r) => {
    if (q && !r.e164.includes(q)) return false;
    if (filterBanRisk.length > 0 && !filterBanRisk.includes(r.banRisk)) return false;
    if (filterProvider.length > 0 && !filterProvider.includes(r.provider)) return false;
    return true;
  });

  const uniqueProviders = Array.from(new Set(rows.map(r => r.provider))).filter(p => p !== "—");

  const renderBanRisk = (risk: string) => {
    switch (risk) {
      case "high":
        return <Badge variant="destructive">High Risk</Badge>;
      case "medium":
        return <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">Medium</Badge>;
      case "low":
      default:
        return <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">Low Risk</Badge>;
    }
  };

  const columns: SabsmsColumn<NumberScorecardRow>[] = [
    {
      id: "number",
      header: "Number",
      render: (r) => <span className="font-mono text-sm font-medium">{r.e164}</span>,
      width: "140px",
    },
    {
      id: "deliverabilityScore", // 1. Per-number deliverability score
      header: "Deliverability",
      render: (r) => (
        <div className="flex flex-col gap-1">
          <span className={`text-xs font-medium ${r.deliverabilityScore < 95 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}`}>
            {r.deliverabilityScore.toFixed(1)}%
          </span>
          {r.trend && (
            <div className="h-6 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r.trend}>
                  <defs>
                    <linearGradient id={`colorDelivered-${r.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={r.deliverabilityScore < 95 ? '#e11d48' : '#10b981'} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={r.deliverabilityScore < 95 ? '#e11d48' : '#10b981'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="delivered" stroke={r.deliverabilityScore < 95 ? '#e11d48' : '#10b981'} fillOpacity={1} fill={`url(#colorDelivered-${r.id})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ),
      width: "110px",
    },
    {
      id: "complaintRate", // 2. Per-number complaint rate
      header: "Complaint Rate",
      render: (r) => <span className="text-xs">{r.complaintRate.toFixed(2)}%</span>,
      width: "110px",
    },
    {
      id: "costPerDelivered", // 3. Per-number cost per delivered
      header: "Cost/Delivered",
      render: (r) => <span className="text-xs">${r.costPerDelivered.toFixed(4)}</span>,
      width: "120px",
      hideByDefault: true,
    },
    {
      id: "replyRate", // 4. Per-number reply rate
      header: "Reply Rate",
      render: (r) => <span className="text-xs">{r.replyRate.toFixed(1)}%</span>,
      width: "100px",
      hideByDefault: true,
    },
    {
      id: "blockRate", // 5. Per-number block rate
      header: "Block Rate",
      render: (r) => (
        <span className={`text-xs ${r.blockRate > 1.0 ? 'text-[var(--st-text)] font-medium' : ''}`}>
          {r.blockRate.toFixed(2)}%
        </span>
      ),
      width: "100px",
    },
    {
      id: "banRisk", // 6. Per-number ban risk
      header: "Ban Risk",
      render: (r) => renderBanRisk(r.banRisk),
      width: "110px",
    },
    {
      id: "warmupProgress", // 18. New-number warm-up tracker
      header: "Warm-up",
      render: (r) => (
        <div className="w-24 space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--st-text)]">
            <span>{r.warmupProgress === 100 ? 'Ready' : 'Warming'}</span>
            <span>{r.warmupProgress}%</span>
          </div>
          <Progress value={r.warmupProgress} className="h-1.5" />
        </div>
      ),
      width: "120px",
    },
  ];

  const rowActions: SabsmsRowAction<NumberScorecardRow>[] = [
    {
      label: "AI: Should I rotate?", // 7. AI: Should I rotate this number out?
      icon: <Sparkles className="h-4 w-4 text-[var(--st-text)]" />,
      onSelect: (r) => console.log("AI Analyze", r.id),
    },
    {
      label: "Drill-down to raw events", // 12. Drill-down to raw events
      icon: <Activity className="h-4 w-4" />,
      onSelect: (r) => console.log("Raw events", r.id),
    },
    {
      label: "View carrier breakdown", // 13. Per-carrier breakdown
      icon: <PieChart className="h-4 w-4" />,
      onSelect: (r) => setDetailRow(r),
    },
    {
      label: "Pause number",
      icon: <Pause className="h-4 w-4" />,
      onSelect: (r) => console.log("Pause", r.id),
    },
    {
      label: "Archive number",
      icon: <Archive className="h-4 w-4" />,
      destructive: true,
      onSelect: (r) => console.log("Archive", r.id),
    },
  ];

  const visibleColumnIds = urlState.get("cols")?.split(",") || columns.filter(c => !c.hideByDefault).map(c => c.id);

  return (
    <div className="flex h-full flex-col">
      <SabsmsPageShell
        title="Number Scorecards"
        description="Deliverability, cost, and health analytics per number."
        breadcrumbs={[
          { label: "Insights", href: "/sabsms/analytics" },
          { label: "Number Scorecards" }
        ]}
        primaryAction={{
          label: "Share Report", // 20. Public share link
          icon: <Share className="h-4 w-4 mr-2" />,
          onClick: () => console.log("Share link generated"),
        }}
        secondaryActions={[
          {
            label: "Schedule Email", // 16. Schedule periodic email
            icon: <Mail className="h-4 w-4 mr-2" />,
            onClick: () => console.log("Schedule Email Modal"),
          },
          {
            label: "Auto-rotate config", // 17. Auto-rotate config (rules)
            icon: <Settings className="h-4 w-4 mr-2" />,
            onClick: () => console.log("Auto-rotate settings"),
          }
        ]}
      >
        {/* Visual Charts Area (Features 10, 19) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--st-text)] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--st-text)]" />
                Underperformer Volume
              </h3>
              <Button variant="outline" size="sm" className="h-7 text-xs">View Full</Button>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={capacityData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid var(--st-border)' }} />
                  <Bar dataKey="utilized" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--st-text)] flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--st-text)]" />
                Capacity Utilisation
              </h3>
              <Button variant="outline" size="sm" className="h-7 text-xs">View Full</Button>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={capacityData}>
                  <defs>
                    <linearGradient id="colorUtilized" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid var(--st-border)' }} />
                  <Area type="monotone" dataKey="utilized" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUtilized)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SabsmsFilterBar
              searchPlaceholder="Search numbers..."
              facets={[
                {
                  key: "period",
                  label: "Period", // 11. Compare two periods (Period selection)
                  multi: false,
                  options: [
                    { label: "Last 7 Days vs Prior", value: "7d" },
                    { label: "Last 30 Days vs Prior", value: "30d" },
                    { label: "This Month", value: "this_month" }
                  ]
                },
                {
                  key: "banRisk",
                  label: "Ban Risk",
                  multi: true,
                  options: [
                    { label: "High Risk", value: "high" },
                    { label: "Medium Risk", value: "medium" },
                    { label: "Low Risk", value: "low" }
                  ]
                },
                {
                  key: "provider",
                  label: "Provider",
                  multi: true,
                  options: uniqueProviders.map(p => ({ label: p, value: p }))
                }
              ]}
              trailing={
                <div className="flex gap-2">
                  <SabsmsSavedViews
                    views={[
                      { id: "v1", name: "High Risk Numbers", urlQuery: "banRisk=high" },
                      { id: "v2", name: "Poor Deliverability", urlQuery: "cols=number,deliverabilityScore&period=7d" }
                    ]}
                    currentViewId={null}
                    onSelectView={(v) => console.log("Load view", v)}
                    onSaveView={() => console.log("Save view")}
                  />
                  <SabsmsColumnPicker
                    columns={columns.map(c => ({ id: c.id, label: c.header as string, hideByDefault: c.hideByDefault }))}
                    visibleIds={visibleColumnIds}
                    onChange={(ids) => urlState.setOne("cols", ids.join(","))}
                  />
                  <SabsmsExportMenu // 15. Export CSV
                    onExportCsv={() => {
                      const csv = rowsToCsv(filteredRows, visibleColumnIds);
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "number-scorecards-export.csv";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  />
                </div>
              }
            />
          </div>

          <SabsmsDataTable
            rows={filteredRows}
            columns={columns}
            visibleColumnIds={visibleColumnIds}
            rowKey={(r) => r.id}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            rowActions={rowActions}
            onRowClick={setDetailRow}
            emptyTitle="No scorecards generated yet"
            emptyDescription="Send more volume to generate deliverability scorecards for your numbers."
            bulkActions={[
              {
                label: "Bulk pause underperforming", // 8. Bulk pause underperforming
                icon: <Pause className="h-4 w-4" />,
                onAction: (rows) => console.log("Bulk pause", rows.map(r => r.id))
              },
              {
                label: "Bulk archive", // 9. Bulk archive
                icon: <Archive className="h-4 w-4" />,
                onAction: (rows) => console.log("Bulk archive", rows.map(r => r.id))
              }
            ]}
          />
        </div>
      </SabsmsPageShell>

      <SabsmsDetailDrawer
        open={!!detailRow}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
        title={`Scorecard: ${detailRow?.e164}`}
        subtitle={`${detailRow?.provider} • ${detailRow?.totalVolume.toLocaleString()} sends`}
        tabs={[
          {
            value: "carriers", // 13. Per-carrier breakdown
            label: "Carrier Breakdown",
            icon: <PieChart className="h-4 w-4" />,
            content: (
              <div className="p-4 space-y-6">
                <div>
                  <h4 className="font-medium text-[var(--st-text)] mb-4">Deliverability by Carrier</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">AT&T</span>
                        <span className={detailRow?.carrierBreakdown.att && detailRow.carrierBreakdown.att < 95 ? "text-[var(--st-text)]" : "text-[var(--st-text)]"}>
                          {detailRow?.carrierBreakdown.att.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={detailRow?.carrierBreakdown.att} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Verizon</span>
                        <span className={detailRow?.carrierBreakdown.verizon && detailRow.carrierBreakdown.verizon < 95 ? "text-[var(--st-text)]" : "text-[var(--st-text)]"}>
                          {detailRow?.carrierBreakdown.verizon.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={detailRow?.carrierBreakdown.verizon} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">T-Mobile</span>
                        <span className={detailRow?.carrierBreakdown.tmobile && detailRow.carrierBreakdown.tmobile < 95 ? "text-[var(--st-text)]" : "text-[var(--st-text)]"}>
                          {detailRow?.carrierBreakdown.tmobile.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={detailRow?.carrierBreakdown.tmobile} className="h-2" />
                    </div>
                  </div>
                </div>
                
                <div className="rounded-lg bg-[var(--st-bg-muted)] p-4 border border-[var(--st-border)]">
                  <h4 className="font-medium text-[var(--st-text)] flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4" /> AI Analysis
                  </h4>
                  <p className="text-sm text-[var(--st-text)] leading-relaxed">
                    Based on the recent block rate of {detailRow?.blockRate.toFixed(2)}% across T-Mobile and Verizon, it is recommended to <strong>{detailRow?.banRisk === 'high' ? 'rotate this number out immediately' : 'monitor closely'}</strong>.
                  </p>
                </div>
              </div>
            )
          },
          {
            value: "events", // 12. Drill-down to raw events (Drawer version)
            label: "Raw Events",
            icon: <FileText className="h-4 w-4" />,
            content: (
              <div className="p-4 text-sm text-[var(--st-text)]">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-[var(--st-text)]">Recent Failures</h4>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    View full logs <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="p-3 border border-[var(--st-border)] rounded-md bg-[var(--st-bg-muted)]">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[var(--st-text)]">Error 30007</span>
                      <span className="text-xs">10 mins ago</span>
                    </div>
                    <p className="text-xs text-[var(--st-text)]">Carrier Violation - Message blocked due to spam heuristics.</p>
                  </div>
                  <div className="p-3 border border-[var(--st-border)] rounded-md bg-[var(--st-bg-muted)]">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[var(--st-text)]">Error 30004</span>
                      <span className="text-xs">1 hour ago</span>
                    </div>
                    <p className="text-xs text-[var(--st-text)]">Message blocked - Destination number opted out.</p>
                  </div>
                </div>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
