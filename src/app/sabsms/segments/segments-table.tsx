"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  Copy,
  DollarSign,
  GitCompare,
  History,
  RefreshCcw,
  Send,
  ShieldOff,
  Tag,
  Trash2,
  LogOut,
} from "lucide-react";

import { Alert, Badge, Button, Field, Input, Separator } from "@/components/sabcrm/20ui";
import {
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsKbdHint,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  SabsmsColumnPicker,
  type SabsmsColumnDef,
  type SabsmsBulkAction,
  type SabsmsColumn,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";

import {
  archiveSegments,
  compareSegments,
  convertSegmentToSuppressions,
  duplicateSegment,
  estimateSegmentCost,
  exportSegmentContacts,
  loadMembershipHistory,
  loadSegmentActivity,
  refreshSegment,
  tagSegment,
  exportSegmentToCrm,
  type SegmentActivityEntry,
  type SegmentListRow,
} from "./actions";

interface SegmentsTableProps {
  workspaceId: string;
  initialRows: SegmentListRow[];
  total: number;
}

interface CompareResult {
  aName: string;
  bName: string;
  aSize: number;
  bSize: number;
  overlap: number;
  overlapPercent: number;
}

interface CostEstimate {
  segmentName: string;
  size: number;
  pricePerMessageCents: number;
  totalCents: number;
}

interface ActivityState {
  segmentId: string;
  segmentName: string;
  entries: SegmentActivityEntry[];
}

interface HistoryState {
  segmentId: string;
  segmentName: string;
  points: { date: string; size: number }[];
}

interface TagDialogState {
  segmentId: string;
  segmentName: string;
  current: string[];
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatRelative(iso?: string): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return new Date(iso).toLocaleString();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function SegmentsTable({
  initialRows,
  total: initialTotal,
}: SegmentsTableProps) {
  const router = useRouter();
  const [rows, setRows] = React.useState<SegmentListRow[]>(initialRows);
  const [total, setTotal] = React.useState(initialTotal);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<
    | { kind: "ok"; message: string }
    | { kind: "err"; message: string }
    | null
  >(null);

  const [activity, setActivity] = React.useState<ActivityState | null>(null);
  const [historyState, setHistoryState] = React.useState<HistoryState | null>(null);
  const [costState, setCostState] = React.useState<CostEstimate | null>(null);
  const [compareState, setCompareState] = React.useState<CompareResult | null>(null);
  const [tagDialog, setTagDialog] = React.useState<TagDialogState | null>(null);
  const [tagInput, setTagInput] = React.useState("");

  const ALL_COLUMNS: SabsmsColumnDef[] = React.useMemo(() => [
    { id: "name", label: "Name", required: true },
    { id: "kind", label: "Kind" },
    { id: "size", label: "Size" },
    { id: "campaigns", label: "Campaigns" },
    { id: "drips", label: "Drips" },
    { id: "refreshed", label: "Last refresh" },
    { id: "cost", label: "Send cost" },
    { id: "actions", label: "Actions", required: true },
  ], []);
  const [visibleColumns, setVisibleColumns] = React.useState<string[]>(
    ALL_COLUMNS.map((c) => c.id)
  );

  // Refresh-from-server (used by the auto-refresh dropdown).
  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  // Keep our local state in sync when the server re-renders.
  React.useEffect(() => {
    setRows(initialRows);
    setTotal(initialTotal);
  }, [initialRows, initialTotal]);

  // --- Per-row actions ----------------------------------------------------

  async function handleRefresh(row: SegmentListRow) {
    setBusy(`refresh:${row.id}`);
    const res = await refreshSegment(row.id);
    setBusy(null);
    if (!res.ok) return setBanner({ kind: "err", message: res.error });
    setRows((r) =>
      r.map((x) =>
        x.id === row.id
          ? { ...x, size: res.size, lastRefreshedAt: res.lastRefreshedAt }
          : x,
      ),
    );
    setBanner({ kind: "ok", message: `Re-evaluated "${row.name}", ${res.size} members.` });
  }

  async function handleExportToCrm(row: SegmentListRow) {
    setBusy(`exportCrm:${row.id}`);
    const res = await exportSegmentToCrm(row.id);
    setBusy(null);
    if (!res.ok) return setBanner({ kind: "err", message: res.error });
    setBanner({
      kind: "ok",
      message: `Exported ${res.pushed} members from "${row.name}" to CRM.`,
    });
  }

  async function handleDuplicate(row: SegmentListRow) {
    setBusy(`dup:${row.id}`);
    const res = await duplicateSegment(row.id);
    setBusy(null);
    if (!res.ok) return setBanner({ kind: "err", message: res.error });
    setBanner({
      kind: "ok",
      message: `Duplicated "${row.name}". Refreshing list...`,
    });
    refresh();
  }

  async function handleConvertSuppression(row: SegmentListRow) {
    setBusy(`supp:${row.id}`);
    const res = await convertSegmentToSuppressions(row.id);
    setBusy(null);
    if (!res.ok) return setBanner({ kind: "err", message: res.error });
    setBanner({
      kind: "ok",
      message: `Added ${res.inserted} phones from "${row.name}" to suppressions.`,
    });
  }

  async function handleActivity(row: SegmentListRow) {
    setBusy(`act:${row.id}`);
    const res = await loadSegmentActivity(row.id);
    setBusy(null);
    if (!res.ok) return setBanner({ kind: "err", message: res.error });
    setActivity({ segmentId: row.id, segmentName: row.name, entries: res.entries });
  }

  async function handleHistory(row: SegmentListRow) {
    setBusy(`hist:${row.id}`);
    const res = await loadMembershipHistory(row.id);
    setBusy(null);
    if (!res.ok) return setBanner({ kind: "err", message: res.error });
    setHistoryState({
      segmentId: row.id,
      segmentName: row.name,
      points: res.points,
    });
  }

  async function handleCost(row: SegmentListRow) {
    setBusy(`cost:${row.id}`);
    const res = await estimateSegmentCost(row.id);
    setBusy(null);
    if (!res.ok) return setBanner({ kind: "err", message: res.error });
    setCostState({
      segmentName: row.name,
      size: res.size,
      pricePerMessageCents: res.pricePerMessageCents,
      totalCents: res.totalCents,
    });
  }

  function openTagDialog(row: SegmentListRow) {
    setTagDialog({
      segmentId: row.id,
      segmentName: row.name,
      current: row.tags ?? [],
    });
    setTagInput((row.tags ?? []).join(", "));
  }

  async function commitTags() {
    if (!tagDialog) return;
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setBusy(`tag:${tagDialog.segmentId}`);
    const res = await tagSegment(tagDialog.segmentId, tags);
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    setRows((r) =>
      r.map((x) =>
        x.id === tagDialog.segmentId ? { ...x, tags } : x,
      ),
    );
    setTagDialog(null);
    setBanner({ kind: "ok", message: "Tags updated." });
  }

  // --- Bulk actions -------------------------------------------------------

  async function handleArchive(selectedRows: SegmentListRow[]) {
    const ids = selectedRows.map((r) => r.id);
    setBusy("bulk:archive");
    const res = await archiveSegments(ids);
    setBusy(null);
    if (!res.ok) return setBanner({ kind: "err", message: res.error });
    setSelected([]);
    setBanner({ kind: "ok", message: `Archived ${res.archived} segments.` });
    refresh();
  }

  async function handleCompare(selectedRows: SegmentListRow[]) {
    if (selectedRows.length !== 2) {
      setBanner({
        kind: "err",
        message: "Pick exactly two segments to compare overlap.",
      });
      return;
    }
    setBusy("bulk:compare");
    const res = await compareSegments(selectedRows[0].id, selectedRows[1].id);
    setBusy(null);
    if (!res.ok) return setBanner({ kind: "err", message: res.error });
    setCompareState({
      aName: selectedRows[0].name,
      bName: selectedRows[1].name,
      aSize: res.aSize,
      bSize: res.bSize,
      overlap: res.overlap,
      overlapPercent: res.overlapPercent,
    });
  }

  // --- Columns ------------------------------------------------------------

  const columns: SabsmsColumn<SegmentListRow>[] = [
    {
      id: "name",
      header: "Name",
      width: "26%",
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Link
              href={`/sabsms/segments/new?id=${row.id}`}
              className="font-medium text-[var(--st-text)] hover:underline"
            >
              {row.name}
            </Link>
            {row.tags?.includes("crm") && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 py-0">
                CRM
              </Badge>
            )}
          </div>
          {row.description && (
            <div className="line-clamp-1 text-xs text-[var(--st-text-secondary)]">
              {row.description}
            </div>
          )}
          {row.tags && row.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {row.tags.slice(0, 4).map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "kind",
      header: "Kind",
      render: (row) => (
        <Badge
          variant={row.kind === "dynamic" ? "accent" : "secondary"}
          className="text-[10px] uppercase"
        >
          {row.kind}
        </Badge>
      ),
    },
    {
      id: "size",
      header: "Size",
      align: "right",
      render: (row) => (
        <span className="font-mono text-sm tabular-nums">
          {row.size.toLocaleString()}
        </span>
      ),
    },
    {
      id: "campaigns",
      header: "Campaigns",
      align: "right",
      render: (row) => (
        <span className="text-sm text-[var(--st-text)]">{row.campaignsUsing}</span>
      ),
    },
    {
      id: "drips",
      header: "Drips",
      align: "right",
      render: (row) => (
        <span className="text-sm text-[var(--st-text)]">{row.dripsUsing}</span>
      ),
    },
    {
      id: "refreshed",
      header: "Last refresh",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm text-[var(--st-text)]">
            {formatRelative(row.lastRefreshedAt)}
          </span>
          {row.autoRefreshSeconds ? (
            <span className="text-[11px] text-[var(--st-text-secondary)]">
              auto: {row.autoRefreshSeconds}s
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "cost",
      header: "Send cost",
      align: "right",
      render: (row) => (
        <span className="text-sm tabular-nums text-[var(--st-text)]">
          {formatCents(row.costEstimateCents)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      width: "240px",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRefresh(row)}
            disabled={busy === `refresh:${row.id}`}
            aria-label="Refresh segment"
          >
            <RefreshCcw
              className={`h-3.5 w-3.5 ${busy === `refresh:${row.id}` ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/sabsms/send?segmentId=${row.id}`)}
            aria-label="Send to segment"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCost(row)}
            aria-label="Cost estimate"
          >
            <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleHistory(row)}
            aria-label="Membership history"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleActivity(row)}
            aria-label="Activity feed"
          >
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ].filter((col) => visibleColumns.includes(col.id));

  const rowActions: SabsmsRowAction<SegmentListRow>[] = [
    {
      label: "Refresh now",
      icon: <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: handleRefresh,
    },
    {
      label: "Duplicate",
      icon: <Copy className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: handleDuplicate,
    },
    {
      label: "Tag / label",
      icon: <Tag className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: openTagDialog,
    },
    {
      label: "Export to CRM",
      icon: <LogOut className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: handleExportToCrm,
    },
    {
      label: "Convert to suppressions",
      icon: <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: handleConvertSuppression,
    },
    {
      label: "View audit log",
      icon: <History className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: (r) => router.push(`/sabsms/logs?resource=${r.id}`),
    },
    {
      label: "Archive",
      icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
      destructive: true,
      onSelect: (r) => handleArchive([r]),
    },
  ];

  const bulkActions: SabsmsBulkAction<SegmentListRow>[] = [
    {
      label: "Compare overlap",
      icon: <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: handleCompare,
    },
    {
      label: "Archive selected",
      icon: <Archive className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: handleArchive,
      destructive: true,
    },
  ];

  const exportCsv = React.useCallback(async () => {
    const header = [
      "id",
      "name",
      "kind",
      "size",
      "campaigns",
      "drips",
      "last_refreshed_at",
      "tags",
    ].join(",");
    const body = rows
      .map((r) =>
        [
          r.id,
          `"${r.name.replace(/"/g, '""')}"`,
          r.kind,
          r.size,
          r.campaignsUsing,
          r.dripsUsing,
          r.lastRefreshedAt ?? "",
          (r.tags ?? []).join("|"),
        ].join(","),
      )
      .join("\n");
    return `${header}\n${body}`;
  }, [rows]);

  // --- Render -------------------------------------------------------------

  return (
    <div className="space-y-4">
      <SabsmsFilterBar
        searchPlaceholder="Search by name, description, predicate text..."
        facets={[
          {
            key: "kind",
            label: "Kind",
            options: [
              { value: "dynamic", label: "Dynamic" },
              { value: "static", label: "Static" },
            ],
          },
          {
            key: "archived",
            label: "Archived",
            options: [{ value: "1", label: "Show archived" }],
          },
        ]}
        sortOptions={[
          { value: "updatedAt:desc", label: "Recently updated" },
          { value: "updatedAt:asc", label: "Oldest first" },
          { value: "name:asc", label: "Name A to Z" },
          { value: "name:desc", label: "Name Z to A" },
          { value: "size:desc", label: "Largest first" },
          { value: "size:asc", label: "Smallest first" },
        ]}
        defaultSort="updatedAt:desc"
        dateRangeKey={{ from: "from", to: "to" }}
        trailing={
          <div className="flex items-center gap-2">
            <SabsmsSavedViews scope="segments" />
            <SabsmsColumnPicker
              columns={ALL_COLUMNS}
              visible={visibleColumns}
              onChange={setVisibleColumns}
            />
            <SabsmsRefreshButton onRefresh={refresh} defaultInterval="off" />
            <SabsmsExportMenu toCsv={exportCsv} filename="sabsms-segments" />
            <SabsmsKbdHint
              shortcuts={[
                { keys: ["g", "n"], description: "New segment" },
                { keys: ["r"], description: "Refresh selected" },
                { keys: ["?"], description: "Show this overlay" },
              ]}
            />
          </div>
        }
      />

      {banner && (
        <Alert
          tone={banner.kind === "ok" ? "success" : "danger"}
          onClose={() => setBanner(null)}
        >
          {banner.message}
        </Alert>
      )}

      <SabsmsDataTable<SegmentListRow>
        rows={rows}
        total={total}
        page={1}
        pageSize={50}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
        bulkActions={bulkActions}
        rowActions={rowActions}
        emptyTitle="No segments yet"
        emptyDescription="Build your first audience predicate to power campaigns, drips, and exports."
        emptyAction={{ label: "New segment", href: "/sabsms/segments/new" }}
      />

      {/* Activity drawer */}
      <SabsmsDetailDrawer
        open={!!activity}
        onOpenChange={(o) => !o && setActivity(null)}
        title={activity ? `Activity: ${activity.segmentName}` : "Activity"}
        description="Recent membership and metadata changes."
      >
        {activity && (
          <ul className="space-y-3">
            {activity.entries.length === 0 ? (
              <li className="text-sm text-[var(--st-text-secondary)]">No activity yet.</li>
            ) : (
              activity.entries.map((e, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3"
                >
                  <Badge variant="outline" className="mt-0.5 text-[10px]">
                    {e.kind}
                  </Badge>
                  <div className="flex-1">
                    <div className="text-sm text-[var(--st-text)]">{e.message}</div>
                    <div className="text-[11px] text-[var(--st-text-secondary)]">
                      {new Date(e.at).toLocaleString()}
                    </div>
                    {e.delta && (
                      <div className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                        +{e.delta.added ?? 0} / -{e.delta.removed ?? 0}
                      </div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </SabsmsDetailDrawer>

      {/* Membership history drawer (feature 17) */}
      <SabsmsDetailDrawer
        open={!!historyState}
        onOpenChange={(o) => !o && setHistoryState(null)}
        title={
          historyState
            ? `Membership history: ${historyState.segmentName}`
            : "History"
        }
        description="Member count over the last 30 days."
      >
        {historyState && <MembershipChart points={historyState.points} />}
      </SabsmsDetailDrawer>

      {/* Cost forecast (feature 19) */}
      <SabsmsDetailDrawer
        open={!!costState}
        onOpenChange={(o) => !o && setCostState(null)}
        title={costState ? `Cost forecast: ${costState.segmentName}` : "Cost"}
        description="Estimated cost to send one SMS to every member."
      >
        {costState && (
          <div className="space-y-3">
            <Row label="Segment size" value={costState.size.toLocaleString()} />
            <Row
              label="Per-message price"
              value={`${(costState.pricePerMessageCents / 100).toFixed(3)} USD`}
            />
            <Separator />
            <Row
              label="Total estimate"
              value={formatCents(costState.totalCents)}
              emphasised
            />
            <p className="text-xs text-[var(--st-text-secondary)]">
              Estimate uses the workspace default price. Final billed cost
              varies by destination country and provider tier.
            </p>
          </div>
        )}
      </SabsmsDetailDrawer>

      {/* Compare overlap (feature 16) */}
      <SabsmsDetailDrawer
        open={!!compareState}
        onOpenChange={(o) => !o && setCompareState(null)}
        title="Segment overlap"
        description="Members shared between two segments."
      >
        {compareState && (
          <div className="space-y-3">
            <Row label={compareState.aName} value={compareState.aSize.toLocaleString()} />
            <Row label={compareState.bName} value={compareState.bSize.toLocaleString()} />
            <Separator />
            <Row
              label="Overlap"
              value={`${compareState.overlap.toLocaleString()} (${compareState.overlapPercent}%)`}
              emphasised
            />
          </div>
        )}
      </SabsmsDetailDrawer>

      {/* Tag dialog (feature 11) */}
      <SabsmsDetailDrawer
        open={!!tagDialog}
        onOpenChange={(o) => !o && setTagDialog(null)}
        title={tagDialog ? `Tag: ${tagDialog.segmentName}` : "Tag"}
        description="Comma-separated labels for grouping and search."
      >
        {tagDialog && (
          <div className="space-y-3">
            <Field label="Tags" id="seg-tags">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="e.g. vip, holiday-2026"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setTagDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={commitTags}
                disabled={busy?.startsWith("tag:")}
              >
                Save tags
              </Button>
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>

      <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
        <div>
          {selected.length > 0 ? (
            <span>{selected.length} selected of {total.toLocaleString()}</span>
          ) : (
            <span>{total.toLocaleString()} segments</span>
          )}
        </div>
        <div>
          <ExportSelectedButton selectedIds={selected} rows={rows} />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasised,
}: {
  label: string;
  value: React.ReactNode;
  emphasised?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--st-text-secondary)]">{label}</span>
      <span
        className={`text-sm tabular-nums ${
          emphasised ? "font-semibold text-[var(--st-text)]" : "text-[var(--st-text)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ExportSelectedButton({
  selectedIds,
  rows,
}: {
  selectedIds: string[];
  rows: SegmentListRow[];
}) {
  const [busy, setBusy] = React.useState(false);
  if (selectedIds.length !== 1) return null;
  const row = rows.find((r) => r.id === selectedIds[0]);
  if (!row) return null;

  async function downloadCsv() {
    setBusy(true);
    try {
      const res = await exportSegmentContacts(selectedIds[0]);
      if (!res.ok) return;
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${row?.name ?? "segment"}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={downloadCsv}
      disabled={busy}
    >
      Export contacts of "{row.name}"
    </Button>
  );
}

/**
 * Lightweight inline sparkline. We avoid pulling a full chart here to keep
 * the bundle for the list page small. A 30-day history reads fine as
 * an SVG polyline.
 */
function MembershipChart({ points }: { points: { date: string; size: number }[] }) {
  if (points.length === 0)
    return <p className="text-sm text-[var(--st-text-secondary)]">No data.</p>;
  const max = Math.max(...points.map((p) => p.size), 1);
  const width = 480;
  const height = 140;
  const stepX = width / Math.max(points.length - 1, 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - (p.size / max) * (height - 20) - 10;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
        role="img"
        aria-label="Segment size over time"
      >
        <path
          d={path}
          fill="none"
          stroke="var(--st-accent)"
          strokeWidth={2}
        />
        {points.map((p, i) => {
          const x = i * stepX;
          const y = height - (p.size / max) * (height - 20) - 10;
          return (
            <circle
              key={p.date}
              cx={x}
              cy={y}
              r={2}
              fill="var(--st-accent)"
            />
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
        <span>{points[0].date}</span>
        <span>peak: {max.toLocaleString()}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}
