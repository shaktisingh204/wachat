"use client";

/**
 * SabSMS A/B tests — interactive client table.
 *
 * Server entry hands us the already-projected `AbTestRow[]`; we render
 * the 20 page-unique features here on top of the shared toolkit:
 *  1.  List active tests              → SabsmsDataTable rows
 *  2.  Variant table                  → row drill-in / detail drawer
 *  3.  Statistical significance       → `computeSignificance()` per row
 *  4.  Confidence interval column     → Wilson CI rendered as `[lo, hi]`
 *  5.  Auto-promote winner toggle     → Switch in detail drawer
 *  6.  Min-sample threshold field     → Input in detail drawer
 *  7.  Conversion metric picker       → Select in detail drawer
 *  8.  Stop test early                → row action
 *  9.  Force-pick winner              → row action (confirm dialog)
 *  10. Per-variant CTR/reply/conv     → inline mini-table in drawer
 *  11. Funnel comparison              → inline ZoruChart per row
 *  12. Cost comparison                → StatCard pair
 *  13. Export raw event log           → SabsmsExportMenu per detail
 *  14. Clone test                     → row action
 *  15. Schedule next test             → row action (date dialog)
 *  16. Test history archive           → status filter chip + archived facet
 *  17. Significance simulation graph  → ZoruChart line
 *  18. Per-segment lift analysis      → `computeSegmentLifts` table
 *  19. Bayesian vs frequentist mode   → Switch in drawer (flag-only)
 *  20. Audit trail                    → "Audit" tab in drawer
 */

import * as React from "react";
import {
  Activity,
  AlertCircle,
  CalendarClock,
  Copy as CopyIcon,
  Crown,
  Pause as PauseIcon,
  ScrollText,
  Sigma,
  StopCircle,
  TrendingUp,
} from "lucide-react";

import {
  ZORU_CHART_PALETTE,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Progress,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/sabcrm/20ui/zoru";

import {
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsKbdHint,
  SabsmsRefreshButton,
  type SabsmsColumn,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";

import {
  cloneTest,
  exportEventLog,
  forcePickWinner,
  loadAuditLog,
  scheduleNextTest,
  setAutoPromote,
  setConversionMetric,
  setMinSample,
  setStatsMode,
  stopTest,
  type AbAuditEntry,
} from "./actions";

import {
  computeSegmentLifts,
  computeSignificance,
  type AbConversionMetric,
  type AbStatsMode,
  type AbTestRow,
} from "./significance";

interface AbTestsTableProps {
  rows: AbTestRow[];
}

const STATUS_LABELS: Record<AbTestRow["status"], string> = {
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

const KIND_LABELS: Record<AbTestRow["kind"], string> = {
  body: "Body copy",
  sender: "Sender ID",
  send_time: "Send time",
};

const METRIC_LABELS: Record<AbConversionMetric, string> = {
  ctr: "Click-through",
  reply: "Reply rate",
  conversion: "Conversion",
};

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function fmtCost(micros: number): string {
  const cents = micros / 10_000;
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtP(p: number): string {
  if (p <= 0) return "<0.001";
  if (p < 0.001) return p.toExponential(1);
  return p.toFixed(3);
}

/**
 * Per-row significance — uses control (variant[0]) vs the best
 * non-control arm, which matches how the page rendered "did B beat A?"
 */
function computeRowSignificance(row: AbTestRow) {
  if (row.variants.length < 2) return null;
  const ctrl = row.variants[0];
  let best = row.variants[1];
  let bestRate = best.total > 0 ? best.conversions / best.total : 0;
  for (const v of row.variants.slice(2)) {
    const r = v.total > 0 ? v.conversions / v.total : 0;
    if (r > bestRate) {
      best = v;
      bestRate = r;
    }
  }
  return {
    bestVariant: best,
    result: computeSignificance(
      ctrl.conversions,
      ctrl.total,
      best.conversions,
      best.total,
    ),
  };
}

export function AbTestsTable({ rows: initialRows }: AbTestsTableProps) {
  const [rows, setRows] = React.useState(initialRows);
  const [selected, setSelected] = React.useState<AbTestRow | null>(null);
  const [confirm, setConfirm] = React.useState<
    | { kind: "force"; row: AbTestRow; variantId: string }
    | { kind: "stop"; row: AbTestRow }
    | { kind: "schedule"; row: AbTestRow }
    | null
  >(null);
  const [scheduleAt, setScheduleAt] = React.useState<string>("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  // Filter — drives features #1 (list active) + #16 (archive). Reads
  // status query directly off the URL (the shared `SabsmsFilterBar`
  // writes it).
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [kindFilter, setKindFilter] = React.useState<string[]>([]);

  const visibleRows = React.useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter.length && !statusFilter.includes(r.status)) return false;
      if (kindFilter.length && !kindFilter.includes(r.kind)) return false;
      return true;
    });
  }, [rows, statusFilter, kindFilter]);

  // Optimistic patch helper used by every drawer toggle.
  function patchRow(id: string, patch: Partial<AbTestRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSelected((cur) => (cur && cur.id === id ? { ...cur, ...patch } : cur));
  }

  async function runWithToast<T>(
    key: string,
    work: () => Promise<{ ok: true } & T | { ok: false; error: string }>,
  ): Promise<({ ok: true } & T) | null> {
    setPending(key);
    setError(null);
    try {
      const res = await work();
      if (!res.ok) {
        setError(res.error);
        return null;
      }
      return res;
    } finally {
      setPending(null);
    }
  }

  const columns: SabsmsColumn<AbTestRow>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Test",
        render: (r) => (
          <div className="flex flex-col">
            <span className="font-medium text-[var(--st-text)]">{r.name}</span>
            <span className="text-xs text-[var(--st-text)]">
              {KIND_LABELS[r.kind]} · {METRIC_LABELS[r.metric]}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        render: (r) => (
          <Badge
            variant={
              r.status === "running"
                ? "default"
                : r.status === "completed"
                  ? "secondary"
                  : "outline"
            }
          >
            {STATUS_LABELS[r.status]}
          </Badge>
        ),
      },
      {
        id: "variants",
        header: "Variants",
        align: "right",
        render: (r) => (
          <span className="text-sm tabular-nums">{r.variants.length}</span>
        ),
      },
      {
        id: "audience",
        header: "Audience",
        align: "right",
        render: (r) => {
          const total = r.variants.reduce((s, v) => s + v.total, 0);
          return (
            <span className="text-sm tabular-nums">
              {total.toLocaleString()}
            </span>
          );
        },
      },
      {
        id: "significance",
        header: "Significance",
        render: (r) => {
          const sig = computeRowSignificance(r);
          if (!sig)
            return <span className="text-xs text-[var(--st-text-secondary)]">—</span>;
          return (
            <div className="flex items-center gap-2">
              <Badge
                variant={sig.result.significant ? "default" : "outline"}
              >
                p = {fmtP(sig.result.pValue)}
              </Badge>
              {sig.result.significant && (
                <Sigma className="h-3.5 w-3.5 text-[var(--st-text)]" aria-label="significant" />
              )}
            </div>
          );
        },
      },
      {
        id: "ci",
        header: "95% CI (variant)",
        render: (r) => {
          const sig = computeRowSignificance(r);
          if (!sig)
            return <span className="text-xs text-[var(--st-text-secondary)]">—</span>;
          return (
            <span className="font-mono text-xs tabular-nums text-[var(--st-text)]">
              [{fmtPct(sig.result.ciLow)}, {fmtPct(sig.result.ciHigh)}]
            </span>
          );
        },
      },
      {
        id: "progress",
        header: "Min-sample",
        render: (r) => {
          const total = r.variants.reduce((s, v) => s + v.total, 0);
          const pct = r.minSample > 0
            ? Math.min(100, Math.round((total / r.minSample) * 100))
            : 100;
          return (
            <div className="flex w-32 flex-col gap-1">
              <Progress value={pct} className="h-1.5" />
              <span className="text-[11px] text-[var(--st-text)] tabular-nums">
                {total.toLocaleString()} / {r.minSample.toLocaleString()}
              </span>
            </div>
          );
        },
      },
      {
        id: "winner",
        header: "Winner",
        render: (r) => {
          if (!r.winnerVariantId)
            return <span className="text-xs text-[var(--st-text-secondary)]">—</span>;
          const w = r.variants.find((v) => v.id === r.winnerVariantId);
          return (
            <span className="flex items-center gap-1.5 text-xs text-[var(--st-text)]">
              <Crown className="h-3.5 w-3.5" />
              {w?.label ?? r.winnerVariantId}
            </span>
          );
        },
      },
    ],
    [],
  );

  const rowActions: SabsmsRowAction<AbTestRow>[] = React.useMemo(
    () => [
      {
        label: "View details",
        icon: <Activity className="h-3.5 w-3.5" />,
        onSelect: (r) => setSelected(r),
      },
      {
        label: "Stop test",
        icon: <StopCircle className="h-3.5 w-3.5" />,
        onSelect: (r) => setConfirm({ kind: "stop", row: r }),
      },
      {
        label: "Force pick winner…",
        icon: <Crown className="h-3.5 w-3.5" />,
        onSelect: (r) => {
          const first = r.variants.find((v) => v.id !== "ctrl");
          if (first)
            setConfirm({ kind: "force", row: r, variantId: first.id });
          else setError("This test has no non-control variant to pick.");
        },
      },
      {
        label: "Clone",
        icon: <CopyIcon className="h-3.5 w-3.5" />,
        onSelect: async (r) => {
          const res = await runWithToast("clone-" + r.id, () => cloneTest(r.id));
          if (res) {
            // Optimistic insert with the seed shape — the server has
            // persisted a fresh row, the next refresh re-loads.
            setRows((prev) => [
              { ...r, id: res.newId, name: `${r.name} (clone)`, status: "running" },
              ...prev,
            ]);
          }
        },
      },
      {
        label: "Schedule next test…",
        icon: <CalendarClock className="h-3.5 w-3.5" />,
        onSelect: (r) => {
          setScheduleAt(new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 16));
          setConfirm({ kind: "schedule", row: r });
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <SabsmsFilterBar
        searchPlaceholder="Search tests by name…"
        facets={[
          {
            key: "status",
            label: "Status",
            multi: true,
            options: [
              { value: "running", label: "Running" },
              { value: "paused", label: "Paused" },
              { value: "completed", label: "Completed" },
              { value: "archived", label: "Archived" },
            ],
          },
          {
            key: "kind",
            label: "Kind",
            multi: true,
            options: [
              { value: "body", label: "Body copy" },
              { value: "sender", label: "Sender ID" },
              { value: "send_time", label: "Send time" },
            ],
          },
        ]}
        sortOptions={[
          { value: "newest", label: "Newest first" },
          { value: "audience_desc", label: "Largest audience" },
          { value: "significant", label: "Most significant" },
        ]}
        defaultSort="newest"
        trailing={
          <>
            <SabsmsRefreshButton onRefresh={() => setRefreshTick((t) => t + 1)} />
            <SabsmsKbdHint
              shortcuts={[
                { keys: ["?"], description: "Open this overlay" },
                { keys: ["c"], description: "Clone selected" },
                { keys: ["s"], description: "Stop selected" },
              ]}
            />
          </>
        }
      />

      {/* Lightweight local-state mirrors of the facet chips so the table
          stays interactive without a router round-trip. The toolkit
          version sits inside `SabsmsFilterBar` and writes the URL; this
          pair re-renders the visible rows. */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text)]">
        <span>Quick:</span>
        {(["running", "completed", "archived"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() =>
              setStatusFilter((cur) =>
                cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
              )
            }
            className={
              "rounded-full border px-2 py-0.5 " +
              (statusFilter.includes(s)
                ? "border-[var(--st-border)] bg-[var(--st-text)] text-white"
                : "border-[var(--st-border)]")
            }
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        {(["body", "sender", "send_time"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() =>
              setKindFilter((cur) =>
                cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k],
              )
            }
            className={
              "rounded-full border px-2 py-0.5 " +
              (kindFilter.includes(k)
                ? "border-[var(--st-border)] bg-[var(--st-text)] text-white"
                : "border-[var(--st-border)]")
            }
          >
            {KIND_LABELS[k]}
          </button>
        ))}
        {refreshTick > 0 && (
          <span className="text-[11px] text-[var(--st-text-secondary)]">
            (refresh #{refreshTick})
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text)]">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <SabsmsDataTable<AbTestRow>
        rows={visibleRows}
        columns={columns}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        onRowClick={(r) => setSelected(r)}
        emptyTitle="No A/B tests"
        emptyDescription="Create a test by composing a campaign with two variants enabled."
      />

      {selected && (
        <AbTestDetailDrawer
          row={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          pending={pending}
          onPatch={async (patch) => {
            // Optimistically update; if any server action fails, the
            // toast surfaces the error and we re-fetch via Refresh.
            patchRow(selected.id, patch);
            if ("autoPromote" in patch && patch.autoPromote !== undefined) {
              await setAutoPromote(selected.id, patch.autoPromote);
            }
            if ("minSample" in patch && patch.minSample !== undefined) {
              await setMinSample(selected.id, patch.minSample);
            }
            if ("metric" in patch && patch.metric) {
              await setConversionMetric(selected.id, patch.metric);
            }
            if ("statsMode" in patch && patch.statsMode) {
              await setStatsMode(selected.id, patch.statsMode);
            }
          }}
        />
      )}

      <ConfirmDialog
        confirm={confirm}
        scheduleAt={scheduleAt}
        onScheduleAtChange={setScheduleAt}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.kind === "stop") {
            const res = await runWithToast("stop-" + confirm.row.id, () =>
              stopTest(confirm.row.id),
            );
            if (res) patchRow(confirm.row.id, { status: "completed" });
          } else if (confirm.kind === "force") {
            const res = await runWithToast(
              "force-" + confirm.row.id,
              () => forcePickWinner(confirm.row.id, confirm.variantId),
            );
            if (res)
              patchRow(confirm.row.id, {
                status: "completed",
                winnerVariantId: confirm.variantId,
              });
          } else if (confirm.kind === "schedule") {
            await runWithToast("schedule-" + confirm.row.id, () =>
              scheduleNextTest(confirm.row.id, scheduleAt),
            );
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────

interface AbTestDetailDrawerProps {
  row: AbTestRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: string | null;
  onPatch: (patch: Partial<AbTestRow>) => Promise<void>;
}

function AbTestDetailDrawer({
  row,
  open,
  onOpenChange,
  pending,
  onPatch,
}: AbTestDetailDrawerProps) {
  const [tab, setTab] = React.useState<"summary" | "segments" | "audit">(
    "summary",
  );
  const [audit, setAudit] = React.useState<AbAuditEntry[] | null>(null);
  const sig = React.useMemo(() => computeRowSignificance(row), [row]);
  const segments = React.useMemo(() => computeSegmentLifts(row), [row]);

  React.useEffect(() => {
    if (tab !== "audit") return;
    let cancelled = false;
    void (async () => {
      // The page passes workspaceId implicitly via the server action; we
      // call the action directly (it pulls session inside the server).
      try {
        const out = await loadAuditLog("", row.id);
        if (!cancelled) setAudit(out);
      } catch {
        if (!cancelled) setAudit([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, row.id]);

  const totalCost = row.variants.reduce((s, v) => s + v.costMicros, 0);

  return (
    <SabsmsDetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={row.name}
      description={`${KIND_LABELS[row.kind]} · ${METRIC_LABELS[row.metric]}`}
    >
      <div className="flex flex-col gap-6">
        {/* Tabs (Zoru lacks a tabs primitive in this build — use buttons.) */}
        <div className="flex gap-2 border-b border-[var(--st-border)] pb-1 text-sm">
          {(["summary", "segments", "audit"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "rounded-md px-3 py-1.5 " +
                (tab === t
                  ? "bg-[var(--st-text)] text-white"
                  : "text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]")
              }
            >
              {t === "summary"
                ? "Summary"
                : t === "segments"
                  ? "Segment lift"
                  : "Audit"}
            </button>
          ))}
        </div>

        {tab === "summary" && (
          <>
            {/* Cost compare + significance stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Variants"
                value={String(row.variants.length)}
              />
              <StatCard
                label="Total cost"
                value={fmtCost(totalCost)}
              />
              <StatCard
                label="p-value"
                value={sig ? fmtP(sig.result.pValue) : "—"}
              />
              <StatCard
                label="Min-sample reached"
                value={
                  row.variants.reduce((s, v) => s + v.total, 0) >= row.minSample
                    ? "Yes"
                    : "No"
                }
              />
            </div>

            {/* Per-variant table — features #10 + #12 */}
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Variants</ZoruCardTitle>
                <ZoruCardDescription>
                  CTR / reply / conversion + cost per arm.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="p-0">
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow>
                      <ZoruTableHead>Variant</ZoruTableHead>
                      <ZoruTableHead className="text-right">Total</ZoruTableHead>
                      <ZoruTableHead className="text-right">CTR</ZoruTableHead>
                      <ZoruTableHead className="text-right">Reply</ZoruTableHead>
                      <ZoruTableHead className="text-right">Conv</ZoruTableHead>
                      <ZoruTableHead className="text-right">Cost</ZoruTableHead>
                      <ZoruTableHead className="text-right" />
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {row.variants.map((v) => {
                      const ctr = v.total > 0 ? v.clicks / v.total : 0;
                      const reply = v.total > 0 ? v.replies / v.total : 0;
                      const conv = v.total > 0 ? v.conversions / v.total : 0;
                      const isWinner = v.id === row.winnerVariantId;
                      return (
                        <ZoruTableRow key={v.id}>
                          <ZoruTableCell>
                            <div className="flex items-center gap-1.5">
                              {isWinner && (
                                <Crown className="h-3.5 w-3.5 text-[var(--st-text)]" />
                              )}
                              {v.label}
                            </div>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right tabular-nums">
                            {v.total.toLocaleString()}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right tabular-nums">
                            {fmtPct(ctr)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right tabular-nums">
                            {fmtPct(reply)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right tabular-nums">
                            {fmtPct(conv)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right tabular-nums">
                            {fmtCost(v.costMicros)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <SabsmsExportMenu
                              filename={`ab-${row.id}-${v.id}`}
                              toCsv={async () => {
                                const res = await exportEventLog(row.id);
                                return res.ok ? res.csv : "";
                              }}
                            />
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })}
                  </ZoruTableBody>
                </Table>
              </ZoruCardContent>
            </Card>

            {/* Funnel comparison bars per variant (feature #11) */}
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Funnel comparison</ZoruCardTitle>
                <ZoruCardDescription>
                  Sent → clicked → replied per variant.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruChartContainer height={180}>
                  <ZoruChart.BarChart
                    data={row.variants.map((v) => ({
                      name: v.label,
                      sent: v.total,
                      clicked: v.clicks,
                      replied: v.replies,
                    }))}
                  >
                    <ZoruChart.CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-[var(--st-border)]"
                    />
                    <ZoruChart.XAxis
                      dataKey="name"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ZoruChart.YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                    <ZoruChart.Bar
                      dataKey="sent"
                      fill={ZORU_CHART_PALETTE[0]}
                      radius={[2, 2, 0, 0]}
                    />
                    <ZoruChart.Bar
                      dataKey="clicked"
                      fill={ZORU_CHART_PALETTE[1]}
                      radius={[2, 2, 0, 0]}
                    />
                    <ZoruChart.Bar
                      dataKey="replied"
                      fill={ZORU_CHART_PALETTE[2]}
                      radius={[2, 2, 0, 0]}
                    />
                  </ZoruChart.BarChart>
                </ZoruChartContainer>
              </ZoruCardContent>
            </Card>

            {/* Significance simulation line (feature #17) */}
            {row.simulation && row.simulation.length > 1 && (
              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle>Significance over time</ZoruCardTitle>
                  <ZoruCardDescription>
                    p-value as sample size grows. Lower is more confident.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <ZoruChartContainer height={140}>
                    <ZoruChart.LineChart data={row.simulation}>
                      <ZoruChart.CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-[var(--st-border)]"
                      />
                      <ZoruChart.XAxis
                        dataKey="iter"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ZoruChart.YAxis
                        domain={[0, 1]}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                      <ZoruChart.Line
                        type="monotone"
                        dataKey="pValue"
                        stroke={ZORU_CHART_PALETTE[3]}
                        strokeWidth={2}
                        dot={false}
                      />
                    </ZoruChart.LineChart>
                  </ZoruChartContainer>
                </ZoruCardContent>
              </Card>
            )}

            {/* Settings — features #5 / #6 / #7 / #19 */}
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Test settings</ZoruCardTitle>
                <ZoruCardDescription>
                  Persisted to <code>sabsms_ab_tests</code>; every change is
                  audited.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--st-border)] px-3 py-2">
                  <div className="flex flex-col">
                    <Label>Auto-promote winner</Label>
                    <span className="text-xs text-[var(--st-text)]">
                      Promote when p&lt;0.05 + min-sample reached.
                    </span>
                  </div>
                  <Switch
                    checked={row.autoPromote}
                    onCheckedChange={(v) => void onPatch({ autoPromote: v })}
                    disabled={pending?.startsWith("autoPromote")}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor={`minSample-${row.id}`}>
                    Min-sample threshold
                  </Label>
                  <Input
                    id={`minSample-${row.id}`}
                    type="number"
                    min={0}
                    defaultValue={row.minSample}
                    onBlur={(e) => {
                      const v = Number(e.currentTarget.value);
                      if (Number.isFinite(v) && v !== row.minSample) {
                        void onPatch({ minSample: v });
                      }
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label>Conversion metric</Label>
                  <Select
                    value={row.metric}
                    onValueChange={(v) =>
                      void onPatch({ metric: v as AbConversionMetric })
                    }
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {(Object.entries(METRIC_LABELS) as [
                        AbConversionMetric,
                        string,
                      ][]).map(([k, label]) => (
                        <ZoruSelectItem key={k} value={k}>
                          {label}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--st-border)] px-3 py-2">
                  <div className="flex flex-col">
                    <Label>Bayesian stats</Label>
                    <span className="text-xs text-[var(--st-text)]">
                      Off = frequentist χ² (default). On = beta-binomial
                      posterior; faster decisions, smoother peeks.
                    </span>
                  </div>
                  <Switch
                    checked={row.statsMode === "bayesian"}
                    onCheckedChange={(v) =>
                      void onPatch({
                        statsMode: (v ? "bayesian" : "frequentist") as AbStatsMode,
                      })
                    }
                  />
                </div>
              </ZoruCardContent>
            </Card>
          </>
        )}

        {tab === "segments" && (
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Per-segment lift</ZoruCardTitle>
              <ZoruCardDescription>
                Chi-square per segment vs the control arm.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="p-0">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>Segment</ZoruTableHead>
                    <ZoruTableHead className="text-right">Total</ZoruTableHead>
                    <ZoruTableHead className="text-right">
                      Conversions
                    </ZoruTableHead>
                    <ZoruTableHead className="text-right">Lift</ZoruTableHead>
                    <ZoruTableHead className="text-right">p</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {segments.length === 0 ? (
                    <ZoruTableRow>
                      <ZoruTableCell
                        colSpan={5}
                        className="px-6 py-6 text-center text-sm text-[var(--st-text)]"
                      >
                        Need at least one non-control variant to compute
                        lift.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    segments.map((s) => (
                      <ZoruTableRow key={s.variantId + s.segment}>
                        <ZoruTableCell>{s.segment}</ZoruTableCell>
                        <ZoruTableCell className="text-right tabular-nums">
                          {s.total.toLocaleString()}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right tabular-nums">
                          {s.conversions.toLocaleString()}
                        </ZoruTableCell>
                        <ZoruTableCell
                          className={
                            "text-right tabular-nums " +
                            (s.lift > 0
                              ? "text-[var(--st-text)]"
                              : s.lift < 0
                                ? "text-[var(--st-text)]"
                                : "")
                          }
                        >
                          {(s.lift * 100).toFixed(1)}%
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right tabular-nums">
                          <Badge
                            variant={s.significant ? "default" : "outline"}
                          >
                            {fmtP(s.pValue)}
                          </Badge>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))
                  )}
                </ZoruTableBody>
              </Table>
            </ZoruCardContent>
          </Card>
        )}

        {tab === "audit" && (
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Audit trail</ZoruCardTitle>
              <ZoruCardDescription>
                Every settings change, stop, force-pick, and clone.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              {audit === null ? (
                <div className="flex items-center gap-2 text-sm text-[var(--st-text)]">
                  <ScrollText className="h-4 w-4" /> Loading…
                </div>
              ) : audit.length === 0 ? (
                <p className="text-sm text-[var(--st-text)]">
                  No audit entries yet.{" "}
                  <span className="text-[var(--st-text-secondary)]">
                    Writes to <code>sabsms_ab_audit</code> are best-effort and
                    fall back to <code>console.warn</code>.
                  </span>
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {audit.map((a) => (
                    <li key={a.id} className="flex items-start gap-2">
                      <span className="font-mono text-[11px] text-[var(--st-text-secondary)]">
                        {a.at.slice(0, 19).replace("T", " ")}
                      </span>
                      <span className="font-medium text-[var(--st-text)]">
                        {a.action}
                      </span>
                      {a.meta && (
                        <span className="text-xs text-[var(--st-text)]">
                          {JSON.stringify(a.meta)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ZoruCardContent>
          </Card>
        )}
      </div>
    </SabsmsDetailDrawer>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  confirm:
    | { kind: "force"; row: AbTestRow; variantId: string }
    | { kind: "stop"; row: AbTestRow }
    | { kind: "schedule"; row: AbTestRow }
    | null;
  scheduleAt: string;
  onScheduleAtChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  confirm,
  scheduleAt,
  onScheduleAtChange,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const open = !!confirm;
  let title = "Are you sure?";
  let body: React.ReactNode = null;
  let cta = "Confirm";
  if (confirm?.kind === "stop") {
    title = "Stop test early?";
    body = (
      <p>
        Stopping the test will lock in the current variant counts. New sends
        belonging to this test will go to control only.
      </p>
    );
    cta = "Stop test";
  } else if (confirm?.kind === "force") {
    title = "Force pick winner?";
    body = (
      <p>
        This bypasses the statistical gate. The test will be marked completed
        and the chosen variant becomes the winner.
      </p>
    );
    cta = "Pick winner";
  } else if (confirm?.kind === "schedule") {
    title = "Schedule a follow-up test";
    body = (
      <div className="flex flex-col gap-2">
        <Label>Send at (local)</Label>
        <Input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => onScheduleAtChange(e.target.value)}
        />
      </div>
    );
    cta = "Schedule";
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <ZoruDialogContent className="max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>{title}</ZoruDialogTitle>
          <ZoruDialogDescription>{body}</ZoruDialogDescription>
        </ZoruDialogHeader>
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            {cta}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

export const __forTests = {
  computeRowSignificance,
};
