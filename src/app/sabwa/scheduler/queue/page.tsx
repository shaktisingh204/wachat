"use client";

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Calendar,
  Checkbox,
  EmptyState,
  Input,
  Label,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  CalendarClock,
  CalendarIcon,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";

/**
 * SabWa — Scheduler Queue (`/sabwa/scheduler/queue`).
 *
 * Power-user table for the schedule pipeline. Filters by session,
 * status, and date range; bulk-cancel or bulk-reschedule selected
 * rows; click a row to open the shared `ScheduleDialog` in edit
 * mode.
 *
 * Wiring goes through:
 *   - `listScheduledMessages` (read — returns `{ items: [] }` on engine 404)
 *   - `updateScheduledMessage` (single reschedule + bulk reschedule)
 *   - `cancelScheduledMessage`  (single + bulk cancel)
 *
 * When the engine returns nothing (no scheduled messages yet), we show
 * an empty state — no fake sample rows.
 *
 * Rebuilt on ZoruUI primitives.
 */

import * as React from "react";
import Link from "next/link";

import {
  cancelScheduledMessage,
  listScheduledMessages,
  updateScheduledMessage,
} from "@/app/actions/sabwa.actions";
import { useSabwaSession } from "@/lib/sabwa/session-context";
import { formatJid, useResolveJid } from "@/lib/sabwa/format-jid";
import type {
  SabwaScheduled,
  SabwaScheduledStatus,
  SabwaScheduledTargetType,
} from "@/lib/sabwa/types";

import {
  ScheduleDialog,
  targetTypeMeta,
  type ScheduleDialogInitial,
} from "../_components/schedule-dialog";

// ─── Types ─────────────────────────────────────────────────────────────────

interface QueueRow {
  id: string;
  sessionId: string;
  targets: SabwaScheduled["targets"];
  primaryTargetJid: string;
  primaryTargetLabel: string;
  primaryTargetType: SabwaScheduledTargetType;
  payloadPreview: string;
  scheduledFor: Date;
  cron?: string;
  status: SabwaScheduledStatus;
  sentAt?: Date;
  raw: SabwaScheduled;
}

type StatusFilter = "all" | SabwaScheduledStatus;

const STATUS_LABEL: Record<SabwaScheduledStatus, string> = {
  pending: "Pending",
  paused: "Paused",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_BADGE_CLASS: Record<SabwaScheduledStatus, string> = {
  pending:
    "border-zoru-line bg-zoru-surface text-zoru-ink",
  paused:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  sent: "border-zoru-line-strong bg-zoru-surface-2 text-zoru-ink",
  failed: "border-zoru-line-strong bg-zoru-surface-2 text-zoru-ink",
  cancelled:
    "border-zoru-line bg-zoru-surface text-zoru-ink-muted",
};

// ─── Mapping ────────────────────────────────────────────────────────────────

function toQueueRow(item: SabwaScheduled): QueueRow {
  const firstTarget = item.targets?.[0];
  const date = new Date(item.scheduledFor);
  return {
    id: String(item._id),
    sessionId: String(item.sessionId),
    targets: item.targets,
    primaryTargetJid: firstTarget?.jid ?? "",
    primaryTargetLabel: firstTarget?.jid ?? "—",
    primaryTargetType: firstTarget?.type ?? "individual",
    payloadPreview:
      item.payload?.body || item.payload?.caption || "(no preview)",
    scheduledFor: date,
    cron: item.cron,
    status: item.status,
    sentAt: item.sentAt ? new Date(item.sentAt) : undefined,
    raw: item,
  };
}

function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, , , dow] = parts;
  const hh = Number(hour);
  const mm = Number(min);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return cron;
  const time = `${String(hh % 12 === 0 ? 12 : hh % 12)}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
  if (dow === "1-5") return `Every weekday at ${time}`;
  if (dow === "*") return `Daily at ${time}`;
  return cron;
}

function recurrenceLabel(row: QueueRow): string {
  if (!row.cron) return "Once";
  return describeCron(row.cron);
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SchedulerQueuePage() {
  const toast = useZoruToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const resolve = useResolveJid(sessionId);

  const [rows, setRows] = React.useState<QueueRow[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [search, setSearch] = React.useState("");
  const [from, setFrom] = React.useState<Date | undefined>();
  const [to, setTo] = React.useState<Date | undefined>();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogInitial, setDialogInitial] = React.useState<
    ScheduleDialogInitial | undefined
  >();

  const [bulkRescheduleOpen, setBulkRescheduleOpen] = React.useState(false);
  const [bulkRescheduleDate, setBulkRescheduleDate] = React.useState<
    Date | undefined
  >();
  const [bulkRescheduling, setBulkRescheduling] = React.useState(false);

  // ─ Load ───────────────────────────────────────────────────────────────
  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await listScheduledMessages(sessionId);
      if (res.ok && Array.isArray(res.items)) {
        setRows(res.items.map(toQueueRow));
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [sessionId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // ─ Filtering ──────────────────────────────────────────────────────────
  const visibleRows = React.useMemo(() => {
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (from && row.scheduledFor < from) return false;
      if (to && row.scheduledFor > to) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !row.primaryTargetLabel.toLowerCase().includes(q) &&
          !row.payloadPreview.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, status, from, to, search]);

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));
  const partiallySelected =
    !allVisibleSelected && visibleRows.some((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((curr) => {
      const next = new Set(curr);
      if (allVisibleSelected) {
        for (const r of visibleRows) next.delete(r.id);
      } else {
        for (const r of visibleRows) next.add(r.id);
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─ Mutations ──────────────────────────────────────────────────────────
  function reportError(action: string, message: string) {
    toast.toast({ title: action, description: message, variant: "destructive" });
  }

  const handleCancel = React.useCallback(
    async (id: string) => {
      // Optimistic
      setRows((curr) =>
        curr.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)),
      );
      try {
        const res = await cancelScheduledMessage(id);
        if (!res.ok) {
          reportError("Couldn't cancel", res.error);
          void refresh();
        }
      } catch (err) {
        reportError(
          "Couldn't cancel",
          err instanceof Error ? err.message : "Unknown error",
        );
        void refresh();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refresh],
  );

  const handleTogglePause = React.useCallback(
    async (id: string, isPaused: boolean) => {
      const nextStatus: SabwaScheduledStatus = isPaused ? "pending" : "paused";
      // Optimistic
      setRows((curr) =>
        curr.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)),
      );
      try {
        const res = await updateScheduledMessage(id, { status: nextStatus });
        if (!res.ok) {
          reportError(isPaused ? "Couldn't resume" : "Couldn't pause", res.error);
          void refresh();
        } else {
          toast.toast({
            title: isPaused ? "Message resumed" : "Message paused",
          });
        }
      } catch (err) {
        reportError(
          isPaused ? "Couldn't resume" : "Couldn't pause",
          err instanceof Error ? err.message : "Unknown error",
        );
        void refresh();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refresh, toast],
  );

  const handleBulkCancel = React.useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setRows((curr) =>
      curr.map((r) => (selected.has(r.id) ? { ...r, status: "cancelled" } : r)),
    );
    setSelected(new Set());
    let lastError: string | null = null;
    for (const id of ids) {
      try {
        const res = await cancelScheduledMessage(id);
        if (!res.ok) lastError = res.error;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Unknown error";
      }
    }
    if (lastError) {
      reportError("Bulk cancel — some rows failed", lastError);
      void refresh();
    } else {
      toast.toast({
        title: `Cancelled ${ids.length} schedule${ids.length === 1 ? "" : "s"}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, refresh, toast]);

  const handleBulkReschedule = React.useCallback(async () => {
    if (!bulkRescheduleDate) return;
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkRescheduling(true);
    const targetDate = bulkRescheduleDate;
    setRows((curr) =>
      curr.map((r) => {
        if (!selected.has(r.id)) return r;
        const next = new Date(r.scheduledFor);
        next.setFullYear(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
        );
        return { ...r, scheduledFor: next };
      }),
    );
    let lastError: string | null = null;
    for (const id of ids) {
      const row = rows.find((r) => r.id === id);
      const next = new Date(row?.scheduledFor ?? new Date());
      next.setFullYear(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
      );
      try {
        const res = await updateScheduledMessage(id, {
          scheduledFor: next,
        });
        if (!res.ok) lastError = res.error;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Unknown error";
      }
    }
    setBulkRescheduling(false);
    setBulkRescheduleOpen(false);
    setSelected(new Set());
    if (lastError) {
      reportError("Bulk reschedule — some rows failed", lastError);
      void refresh();
    } else {
      toast.toast({
        title: `Rescheduled ${ids.length} item${ids.length === 1 ? "" : "s"}`,
        description: targetDate.toLocaleDateString(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bulkRescheduleDate,
    selected,
    rows,
    refresh,
    toast,
  ]);

  // ─ Row actions ────────────────────────────────────────────────────────
  const openEdit = (row: QueueRow) => {
    setDialogInitial({
      scheduledId: row.id,
      sessionId: row.sessionId,
      targets: row.targets,
      body: row.payloadPreview,
      scheduledFor: row.scheduledFor,
      cron: row.cron,
      recurrence: row.cron ? "custom" : "none",
    });
    setDialogOpen(true);
  };

  // ─ Render ─────────────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* ─── Breadcrumb ──────────────────────────────────────────── */}
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa/scheduler">
              Scheduler
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Queue</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-zoru-ink">
                Scheduled Queue
              </h1>
            </div>
            <p className="text-sm text-zoru-ink-muted mt-1">
              Triage every pending, sent, failed, or cancelled scheduled
              message — with bulk reschedule and cancel.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/sabwa/scheduler">
              <CalendarClock className="mr-1.5 h-4 w-4" />
              Calendar
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn(
                "mr-1.5 h-4 w-4",
                refreshing && "animate-spin",
              )}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setDialogInitial(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New schedule
          </Button>
        </div>
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
        <div className="flex flex-1 min-w-[180px] flex-col gap-1">
          <Label htmlFor="queue-search" className="text-[11px]">
            Search target or message
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted" />
            <Input
              id="queue-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter…"
              className="pl-7"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px]">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusFilter)}
          >
            <ZoruSelectTrigger className="w-[140px]">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All</ZoruSelectItem>
              <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
              <ZoruSelectItem value="paused">Paused</ZoruSelectItem>
              <ZoruSelectItem value="sent">Sent</ZoruSelectItem>
              <ZoruSelectItem value="failed">Failed</ZoruSelectItem>
              <ZoruSelectItem value="cancelled">Cancelled</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>
        </div>
        <DateRangeField label="From" value={from} onChange={setFrom} />
        <DateRangeField label="To" value={to} onChange={setTo} />
        {(from || to || status !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom(undefined);
              setTo(undefined);
              setStatus("all");
              setSearch("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* ─── Bulk bar ────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-3 py-2 text-sm text-zoru-ink">
          <span>
            <strong>{selected.size}</strong> selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Popover
              open={bulkRescheduleOpen}
              onOpenChange={setBulkRescheduleOpen}
            >
              <ZoruPopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="mr-1.5 h-4 w-4" />
                  Reschedule to…
                </Button>
              </ZoruPopoverTrigger>
              <ZoruPopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={bulkRescheduleDate}
                  onSelect={setBulkRescheduleDate}
                />
                <div className="flex justify-end gap-2 border-t border-zoru-line p-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setBulkRescheduleOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkReschedule}
                    disabled={!bulkRescheduleDate || bulkRescheduling}
                  >
                    Apply
                  </Button>
                </div>
              </ZoruPopoverContent>
            </Popover>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkCancel}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ─── Table ──────────────────────────────────────────────────── */}
      <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg overflow-x-auto">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead className="w-8">
                <Checkbox
                  checked={
                    allVisibleSelected
                      ? true
                      : partiallySelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={toggleAll}
                  aria-label="Select all visible"
                />
              </ZoruTableHead>
              <ZoruTableHead>Target</ZoruTableHead>
              <ZoruTableHead>Message</ZoruTableHead>
              <ZoruTableHead>Scheduled for</ZoruTableHead>
              <ZoruTableHead>Recurrence</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead>Sent at</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {!loaded && rows.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <ZoruTableRow key={`queue-skeleton-${i}`}>
                  <ZoruTableCell colSpan={8} className="py-2">
                    <Skeleton className="h-[56px] w-full rounded-[var(--zoru-radius-lg)]" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            {visibleRows.length === 0 && loaded && rows.length > 0 && (
              <ZoruTableRow>
                <ZoruTableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-zoru-ink-muted"
                >
                  No scheduled messages match these filters.
                </ZoruTableCell>
              </ZoruTableRow>
            )}
            {rows.length === 0 && loaded && (
              <ZoruTableRow>
                <ZoruTableCell colSpan={8} className="py-10">
                  <EmptyState
                    icon={<CalendarClock />}
                    title="No scheduled messages yet"
                    description="Schedule your first WhatsApp message to see it appear here."
                    action={
                      <Button
                        size="md"
                        onClick={() => {
                          setDialogInitial(undefined);
                          setDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        New schedule
                      </Button>
                    }
                  />
                </ZoruTableCell>
              </ZoruTableRow>
            )}
            {visibleRows.map((row) => {
              const meta = targetTypeMeta(row.primaryTargetType);
              const Icon = meta.Icon;
              const isSelected = selected.has(row.id);
              return (
                <ZoruTableRow
                  key={row.id}
                  data-state={isSelected ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => openEdit(row)}
                >
                  <ZoruTableCell
                    onClick={(e) => e.stopPropagation()}
                    className="w-8"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(row.id)}
                      aria-label={`Select schedule ${row.id}`}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface text-zoru-ink",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-zoru-ink">
                          {row.primaryTargetJid
                            ? resolve(row.primaryTargetJid)
                            : row.primaryTargetLabel}
                        </div>
                        <div className="truncate font-mono text-[10px] text-zoru-ink-muted">
                          {row.primaryTargetJid
                            ? formatJid(row.primaryTargetJid)
                            : ''}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-zoru-ink-muted">
                          {meta.label}
                          {row.targets.length > 1 &&
                            ` +${row.targets.length - 1}`}
                        </div>
                      </div>
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell className="max-w-[28ch]">
                    <span className="block truncate text-xs text-zoru-ink">
                      {row.payloadPreview}
                    </span>
                  </ZoruTableCell>
                  <ZoruTableCell className="whitespace-nowrap text-xs text-zoru-ink">
                    {row.scheduledFor.toLocaleString()}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-xs text-zoru-ink">
                    {recurrenceLabel(row)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        STATUS_BADGE_CLASS[row.status],
                      )}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </ZoruTableCell>
                  <ZoruTableCell className="whitespace-nowrap text-xs text-zoru-ink-muted">
                    {row.sentAt ? row.sentAt.toLocaleString() : "—"}
                  </ZoruTableCell>
                  <ZoruTableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </Button>
                    {row.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(row.id)}
                      >
                        Cancel
                      </Button>
                    )}
                    {row.cron && (row.status === "pending" || row.status === "paused") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePause(row.id, row.status === "paused")}
                      >
                        {row.status === "paused" ? "Resume" : "Pause"}
                      </Button>
                    )}
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })}
          </ZoruTableBody>
        </Table>
      </div>

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogInitial?.scheduledId ? "edit" : "create"}
        initial={dialogInitial}
        sessionId={sessionId || undefined}
        onSaved={() => void refresh()}
      />
    </div>
  );
}

// ─── Filter helpers ─────────────────────────────────────────────────────────

function DateRangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Date;
  onChange: (d: Date | undefined) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px]">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <ZoruPopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "w-[140px] justify-start font-normal",
              !value && "text-zoru-ink-muted",
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {value ? value.toLocaleDateString() : "Any"}
          </Button>
        </ZoruPopoverTrigger>
        <ZoruPopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              onChange(d ?? undefined);
              setOpen(false);
            }}
            initialFocus
          />
          {value && (
            <div className="border-t border-zoru-line p-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </ZoruPopoverContent>
      </Popover>
    </div>
  );
}
