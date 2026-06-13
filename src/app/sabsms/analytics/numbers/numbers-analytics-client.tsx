"use client";

import React, { useState } from "react";
import {
  Sparkles,
  PieChart, FileText,
  Activity, ArrowRight, Settings, Mail, Hash,
} from "lucide-react";
import {
  AreaChart, Area,
  ResponsiveContainer,
} from "recharts";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  type SabsmsColumn,
  type SabsmsRowAction,
  type SabsmsBulkAction,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsSavedViews,
  SabsmsColumnPicker,
  SabsmsEmpty,
  useSabsmsUrlState,
  rowsToCsv,
} from "@/components/sabsms/page-toolkit";

import { Badge, Button } from "@/components/sabcrm/20ui";

export interface NumberTrendData {
  date: string;
  delivered: number;
  failed: number;
}

/**
 * Per-number scorecard. Every field here is measured from
 * `sabsms_messages` over the last 7 days (grouped by sender number). There
 * is intentionally NO fabricated complaint-rate / ban-risk / warm-up /
 * carrier-breakdown — those have no backend yet and are surfaced as honest
 * "not available" in the UI rather than random numbers.
 */
export interface NumberScorecardRow {
  id: string;
  e164: string;
  provider: string;
  status: string;
  deliverabilityScore: number;
  costPerDelivered: number;
  replyRate: number;
  blockRate: number;
  totalVolume: number;
  /** True when the number had any send activity in the window. */
  hasData: boolean;
  trend?: NumberTrendData[];
}

interface NumbersAnalyticsClientProps {
  rows: NumberScorecardRow[];
}

export function NumbersAnalyticsClient({ rows }: NumbersAnalyticsClientProps) {
  const urlState = useSabsmsUrlState();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailRow, setDetailRow] = useState<NumberScorecardRow | null>(null);

  // Filters (the FilterBar reads/writes the URL itself).
  const q = urlState.get("q")?.toLowerCase() || "";
  const filterProvider = urlState.getAll("provider");

  const filteredRows = rows.filter((r) => {
    if (q && !r.e164.toLowerCase().includes(q)) return false;
    if (filterProvider.length > 0 && !filterProvider.includes(r.provider)) return false;
    return true;
  });

  const uniqueProviders = Array.from(new Set(rows.map((r) => r.provider))).filter(
    (p) => p !== "—",
  );

  const columns: SabsmsColumn<NumberScorecardRow>[] = [
    {
      id: "number",
      header: "Number",
      render: (r) => <span className="font-mono text-sm font-medium">{r.e164}</span>,
      width: "140px",
    },
    {
      id: "deliverabilityScore",
      header: "Deliverability",
      render: (r) =>
        r.hasData ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--st-text)]">
              {r.deliverabilityScore.toFixed(1)}%
            </span>
            {r.trend && r.trend.length > 0 && (
              <div className="h-6 w-16">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={r.trend}>
                    <defs>
                      <linearGradient id={`colorDelivered-${r.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={r.deliverabilityScore < 95 ? "#e11d48" : "#10b981"} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={r.deliverabilityScore < 95 ? "#e11d48" : "#10b981"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="delivered" stroke={r.deliverabilityScore < 95 ? "#e11d48" : "#10b981"} fillOpacity={1} fill={`url(#colorDelivered-${r.id})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-[var(--st-text-secondary)]">No sends (7d)</span>
        ),
      width: "110px",
    },
    {
      id: "costPerDelivered",
      header: "Cost/Delivered",
      render: (r) => (
        <span className="text-xs">{r.hasData && r.costPerDelivered > 0 ? `$${r.costPerDelivered.toFixed(4)}` : "—"}</span>
      ),
      width: "120px",
      hideByDefault: true,
    },
    {
      id: "replyRate",
      header: "Reply Rate",
      render: (r) => <span className="text-xs">{r.hasData ? `${r.replyRate.toFixed(1)}%` : "—"}</span>,
      width: "100px",
      hideByDefault: true,
    },
    {
      id: "blockRate",
      header: "Failure Rate",
      render: (r) =>
        r.hasData ? (
          <span className={`text-xs ${r.blockRate > 1.0 ? "text-[var(--st-text)] font-medium" : ""}`}>
            {r.blockRate.toFixed(2)}%
          </span>
        ) : (
          <span className="text-xs text-[var(--st-text-secondary)]">—</span>
        ),
      width: "110px",
    },
    {
      id: "totalVolume",
      header: "Volume (7d)",
      render: (r) => <span className="text-xs tabular-nums">{r.totalVolume.toLocaleString()}</span>,
      width: "110px",
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">
          {r.status}
        </Badge>
      ),
      width: "100px",
    },
  ];

  const rowActions: SabsmsRowAction<NumberScorecardRow>[] = [
    {
      label: "View details",
      icon: <PieChart className="h-4 w-4" />,
      onSelect: (r) => setDetailRow(r),
    },
    {
      label: "Drill-down to raw events",
      icon: <Activity className="h-4 w-4" />,
      onSelect: (r) => {
        window.location.href = `/sabsms/logs?from=${encodeURIComponent(r.e164)}`;
      },
    },
  ];

  const bulkActions: SabsmsBulkAction<NumberScorecardRow>[] = [
    {
      label: "Open selected in logs",
      icon: <FileText className="h-4 w-4" />,
      onSelect: (selected) => {
        const first = selected[0];
        if (first) window.location.href = `/sabsms/logs?from=${encodeURIComponent(first.e164)}`;
      },
    },
  ];

  // Columns are toggled via the URL `cols` param.
  const defaultVisible = columns.filter((c) => !c.hideByDefault).map((c) => c.id);
  const visibleColumnIds = urlState.get("cols")?.split(",").filter(Boolean) || defaultVisible;

  // CSV export of the visible scorecard data (no fabricated columns).
  const exportCsv = React.useCallback(async () => {
    const csvRows = filteredRows.map((r) => ({
      number: r.e164,
      provider: r.provider,
      status: r.status,
      deliverabilityPct: r.hasData ? r.deliverabilityScore.toFixed(1) : "",
      failureRatePct: r.hasData ? r.blockRate.toFixed(2) : "",
      replyRatePct: r.hasData ? r.replyRate.toFixed(1) : "",
      costPerDelivered: r.hasData && r.costPerDelivered > 0 ? r.costPerDelivered.toFixed(4) : "",
      volume7d: r.totalVolume,
    }));
    return rowsToCsv(csvRows, [
      { key: "number", header: "Number" },
      { key: "provider", header: "Provider" },
      { key: "status", header: "Status" },
      { key: "deliverabilityPct", header: "Deliverability %" },
      { key: "failureRatePct", header: "Failure Rate %" },
      { key: "replyRatePct", header: "Reply Rate %" },
      { key: "costPerDelivered", header: "Cost / Delivered" },
      { key: "volume7d", header: "Volume (7d)" },
    ]);
  }, [filteredRows]);

  return (
    <div className="flex h-full flex-col">
      <SabsmsPageShell
        title="Number Scorecards"
        description="Per-number deliverability, failure rate, reply rate, and cost measured from the last 7 days of message activity."
        breadcrumbs={[
          { label: "Insights", href: "/sabsms/analytics" },
          { label: "Number Scorecards" },
        ]}
        secondaryActions={[
          {
            label: "Schedule Email",
            icon: <Mail className="h-4 w-4" />,
            onSelectHref: "/sabsms/analytics",
          },
          {
            label: "Number settings",
            icon: <Settings className="h-4 w-4" />,
            onSelectHref: "/sabsms/numbers",
          },
        ]}
      >
        {rows.length === 0 ? (
          <SabsmsEmpty
            icon={<Hash />}
            title="No numbers to score yet"
            description="Once you have active numbers and 7 days of send activity, per-number deliverability scorecards will appear here."
          />
        ) : (
          <div className="mb-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SabsmsFilterBar
                searchPlaceholder="Search numbers..."
                facets={[
                  {
                    key: "provider",
                    label: "Provider",
                    multi: true,
                    options: uniqueProviders.map((p) => ({ label: p, value: p })),
                  },
                ]}
                trailing={
                  <div className="flex gap-2">
                    <SabsmsSavedViews scope="analytics:numbers" />
                    <SabsmsColumnPicker
                      columns={columns.map((c) => ({
                        id: c.id,
                        label: typeof c.header === "string" ? c.header : c.id,
                        required: c.id === "number",
                      }))}
                      visible={visibleColumnIds}
                      onChange={(ids) => urlState.setOne("cols", ids.join(","))}
                    />
                    <SabsmsExportMenu toCsv={exportCsv} filename="number-scorecards" />
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
              emptyTitle="No scorecards match these filters"
              emptyDescription="Adjust the provider filter or search to see more numbers."
              bulkActions={bulkActions}
            />
          </div>
        )}
      </SabsmsPageShell>

      <SabsmsDetailDrawer
        open={!!detailRow}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
        title={
          <span className="flex items-center gap-2">
            <PieChart className="h-4 w-4" aria-hidden="true" />
            Scorecard: {detailRow?.e164}
          </span>
        }
        description={
          detailRow
            ? `${detailRow.provider} • ${detailRow.totalVolume.toLocaleString()} sends in the last 7 days`
            : ""
        }
      >
        {detailRow && (
          <div className="space-y-6 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--st-border)] p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--st-text-secondary)] mb-1">Deliverability</p>
                <p className="text-2xl font-bold font-mono">
                  {detailRow.hasData ? `${detailRow.deliverabilityScore.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--st-border)] p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--st-text-secondary)] mb-1">Failure rate</p>
                <p className="text-2xl font-bold font-mono">
                  {detailRow.hasData ? `${detailRow.blockRate.toFixed(2)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--st-border)] p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--st-text-secondary)] mb-1">Reply rate</p>
                <p className="text-2xl font-bold font-mono">
                  {detailRow.hasData ? `${detailRow.replyRate.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--st-border)] p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--st-text-secondary)] mb-1">Cost / delivered</p>
                <p className="text-2xl font-bold font-mono">
                  {detailRow.hasData && detailRow.costPerDelivered > 0 ? `$${detailRow.costPerDelivered.toFixed(4)}` : "—"}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-[var(--st-bg-muted)] p-4 border border-[var(--st-border)]">
              <h4 className="font-medium text-[var(--st-text)] flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4" /> Carrier &amp; ban-risk analysis
              </h4>
              <p className="text-sm text-[var(--st-text-secondary)] leading-relaxed">
                Per-carrier deliverability and automated ban-risk scoring are not available yet — the
                SabSMS engine does not surface carrier-level delivery receipts or a ban-risk signal.
                The metrics above are measured directly from your message history.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = `/sabsms/logs?from=${encodeURIComponent(detailRow.e164)}`;
              }}
            >
              View full logs for this number <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </SabsmsDetailDrawer>
    </div>
  );
}
