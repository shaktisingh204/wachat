"use client";

import { Button, useZoruToast } from "@/components/zoruui";
import { useDebouncedCallback } from "use-debounce";
import { Plus } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { EntityListShell } from "@/components/crm/entity-list-shell";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { PaginationBar } from "@/components/crm/pagination-bar";

/**
 * <TicketsListClient> — interactive shell for `/dashboard/sabdesk`.
 *
 * Owns the local filter state, the selected-row set, and the view
 * mode. Mounts `<EntityListShell>` with the KPI strip, filters, bulk
 * bar, view switcher, and one of three views (table / kanban / queue).
 *
 * The Rust list endpoint accepts a subset of filters (status,
 * severity, assignee, requester id, query). The remaining filters
 * (priority, channel, category, date range, requester KIND) are
 * applied client-side on the loaded page — same pattern as Leads.
 */

import * as React from "react";
import Link from "next/link";

import { useT } from "@/lib/i18n/client";

import {
  deleteTicketAction,
  listTickets,
  updateTicket,
} from "@/app/actions/crm/tickets.actions";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";
import { getSession } from "@/app/actions/user.actions";
import {
  exportTicketsCsv,
  requesterKindOf,
  runTicketsBulk,
  type TicketRequesterKind,
  type TicketsBulkOp,
} from "./tickets-bulk-runner";

import {
  TicketsBulkBar,
  TicketsFiltersRow,
  buildTicketsViewState,
  type TicketStatusFilter,
} from "./tickets-filters";
import {
  TicketsKpiStrip,
  computeTicketKpis,
  type TicketsKpiKey,
} from "./tickets-kpi-strip";
import {
  TicketsHeaderTools,
  type TicketsViewMode,
} from "./tickets-header-tools";
import { TicketsTable } from "./tickets-table";
import { TicketsKanban } from "./tickets-kanban";
import { TicketsQueue } from "./tickets-queue";
import { TicketsInbox } from "./tickets-inbox";

const TICKETS_PER_PAGE = 20;

interface TicketsListClientProps {
  initialTickets: CrmTicketDoc[];
  initialError?: string;
}

export function TicketsListClient({
  initialTickets,
  initialError,
}: TicketsListClientProps) {
  const { toast } = useZoruToast();
  const { t } = useT();

  const [tickets, setTickets] = React.useState<CrmTicketDoc[]>(initialTickets);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(
    initialTickets.length === TICKETS_PER_PAGE,
  );
  const [isPending, startTransition] = React.useTransition();

  // Search + filters.
  const [search, setSearch] = React.useState("");
  const [kpiKey, setKpiKey] = React.useState<TicketsKpiKey>("all");
  const [statusFilter, setStatusFilter] =
    React.useState<TicketStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState("");
  const [channelFilter, setChannelFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [assigneeFilter, setAssigneeFilter] = React.useState("");
  const [requesterKindFilter, setRequesterKindFilter] = React.useState<
    TicketRequesterKind | "all"
  >("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [activePresetId, setActivePresetId] = React.useState("all");
  const [clientPredicate, setClientPredicate] = React.useState<
    ((t: Record<string, unknown>) => boolean) | null
  >(null);
  const [currentUserId, setCurrentUserId] = React.useState<
    string | undefined
  >();

  React.useEffect(() => {
    let cancelled = false;
    getSession().then((s) => {
      if (cancelled) return;
      setCurrentUserId(s?.user?._id ? String(s.user._id) : undefined);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [view, setView] = React.useState<TicketsViewMode>("table");
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
    null,
  );
  const [mergeTargetId, setMergeTargetId] = React.useState<string | null>(null);
  const [mergeIntoId, setMergeIntoId] = React.useState("");

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      const res = await listTickets({
        page,
        limit: TICKETS_PER_PAGE,
        q: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        severity: severityFilter || undefined,
        assigneeId: assigneeFilter || undefined,
      });
      setTickets(res.tickets);
      setHasMore(res.hasMore);
      if (res.error) {
        toast({
          title: "Could not load tickets",
          description: res.error,
          variant: "destructive",
        });
      }
    });
  }, [page, search, statusFilter, severityFilter, assigneeFilter, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const clearFilters = React.useCallback(() => {
    setStatusFilter("all");
    setPriorityFilter("");
    setSeverityFilter("");
    setChannelFilter("");
    setCategoryFilter("");
    setAssigneeFilter("");
    setRequesterKindFilter("all");
    setDateRange(undefined);
    setSearch("");
    setPage(1);
    setActivePresetId("all");
    setClientPredicate(null);
    setKpiKey("all");
  }, []);

  const hasActiveFilters =
    statusFilter !== "all" ||
    !!priorityFilter ||
    !!severityFilter ||
    !!channelFilter ||
    !!categoryFilter ||
    !!assigneeFilter ||
    requesterKindFilter !== "all" ||
    !!dateRange?.from ||
    !!dateRange?.to ||
    activePresetId !== "all" ||
    kpiKey !== "all";

  /* ─── Client-side post-filters ─────────────────────────────────── */
  const visibleTickets = React.useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return tickets.filter((t) => {
      if (
        priorityFilter &&
        String(t.priority ?? "").toLowerCase() !== priorityFilter
      ) {
        return false;
      }
      if (
        channelFilter &&
        String(t.channel ?? "").toLowerCase() !== channelFilter
      ) {
        return false;
      }
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (
        requesterKindFilter !== "all" &&
        requesterKindOf(t) !== requesterKindFilter
      ) {
        return false;
      }
      if (dateRange?.from) {
        const created = t.createdAt
          ? new Date(t.createdAt).getTime()
          : t.audit?.createdAt
            ? new Date(t.audit.createdAt).getTime()
            : NaN;
        if (Number.isFinite(created) && created < dateRange.from.getTime())
          return false;
      }
      if (dateRange?.to) {
        const created = t.createdAt
          ? new Date(t.createdAt).getTime()
          : t.audit?.createdAt
            ? new Date(t.audit.createdAt).getTime()
            : NaN;
        if (Number.isFinite(created) && created > dateRange.to.getTime())
          return false;
      }
      // KPI-driven virtual filter
      const status = String(t.status ?? "").toLowerCase();
      switch (kpiKey) {
        case "open":
          if (status !== "open" && status !== "reopened") return false;
          break;
        case "pending":
          if (status !== "pending" && status !== "on_hold") return false;
          break;
        case "overdue": {
          const due = t.dueBy ? new Date(t.dueBy).getTime() : NaN;
          if (!Number.isFinite(due)) return false;
          if (status === "resolved" || status === "closed") return false;
          if (due >= now) return false;
          break;
        }
        case "resolvedWeek": {
          if (status !== "resolved") return false;
          const upd = t.updatedAt
            ? new Date(t.updatedAt).getTime()
            : t.audit?.updatedAt
              ? new Date(t.audit.updatedAt).getTime()
              : NaN;
          if (!Number.isFinite(upd) || upd < weekAgo) return false;
          break;
        }
        case "csat":
          if (
            typeof t.satisfactionRating !== "number" ||
            t.satisfactionRating <= 0
          )
            return false;
          break;
        default:
          break;
      }
      if (
        clientPredicate &&
        !clientPredicate(t as unknown as Record<string, unknown>)
      ) {
        return false;
      }
      return true;
    });
  }, [
    tickets,
    priorityFilter,
    channelFilter,
    categoryFilter,
    requesterKindFilter,
    dateRange,
    kpiKey,
    clientPredicate,
  ]);

  const kpiCounts = React.useMemo(() => computeTicketKpis(tickets), [tickets]);

  /* ─── Row actions ─────────────────────────────────────────────── */
  const handleToggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = React.useCallback(
    (all: boolean) => {
      setSelected(
        all ? new Set(visibleTickets.map((t) => String(t._id))) : new Set(),
      );
    },
    [visibleTickets],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetId) return;
    const res = await deleteTicketAction(deleteTargetId);
    if (res.success) {
      toast({ title: "Ticket deleted" });
      fetchData();
    } else {
      toast({
        title: "Delete failed",
        description: res.error,
        variant: "destructive",
      });
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, fetchData, toast]);

  /* ─── Bulk actions ────────────────────────────────────────────── */
  const runBulk = React.useCallback(
    async (op: TicketsBulkOp, payload?: string | null) => {
      if (selected.size === 0) return;
      const ids = Array.from(selected);
      const { ok } = await runTicketsBulk(ids, op, payload);
      toast({ title: `${ok} ticket${ok === 1 ? "" : "s"} updated` });
      setSelected(new Set());
      fetchData();
    },
    [selected, fetchData, toast],
  );

  const runBulkMerge = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length < 2) {
      toast({
        title: "Pick at least 2 tickets",
        description: "Merge needs a target plus one or more sources.",
        variant: "destructive",
      });
      return;
    }
    // First selected becomes the target; remaining selected merge into it.
    setMergeIntoId(ids[0]);
    setMergeTargetId(ids[1]);
  }, [selected, toast]);

  const handleConfirmMerge = React.useCallback(async () => {
    if (!mergeTargetId || !mergeIntoId) return;
    try {
      const sourceIds =
        selected.size >= 2
          ? Array.from(selected).filter((id) => id !== mergeIntoId)
          : [mergeTargetId];
      // Mark sources as closed with linkage to the canonical ticket.
      for (const id of sourceIds) {
        await updateTicket(id, {
          status: "closed",
          parentTicketId: mergeIntoId,
        });
      }
      toast({ title: `Merged ${sourceIds.length} ticket(s)` });
      setSelected(new Set());
      fetchData();
    } catch (e) {
      toast({
        title: "Merge failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setMergeTargetId(null);
      setMergeIntoId("");
    }
  }, [mergeTargetId, mergeIntoId, selected, fetchData, toast]);

  const exportCsv = React.useCallback(() => {
    const rows =
      selected.size > 0
        ? tickets.filter((t) => selected.has(String(t._id)))
        : visibleTickets;
    exportTicketsCsv(rows);
  }, [tickets, visibleTickets, selected]);

  /* ─── Saved-view presets ──────────────────────────────────────── */
  const applyPreset = React.useCallback(
    (presetId: string) => {
      const next = buildTicketsViewState(presetId, currentUserId);
      setActivePresetId(presetId);
      setStatusFilter(next.statusFilter);
      setPriorityFilter(next.priorityFilter);
      setSeverityFilter(next.severityFilter);
      setChannelFilter(next.channelFilter);
      setCategoryFilter(next.categoryFilter);
      setAssigneeFilter(next.assigneeFilter);
      setRequesterKindFilter(next.requesterKindFilter);
      setDateRange(next.dateRange);
      setClientPredicate(
        next.clientPredicate ? () => next.clientPredicate! : null,
      );
      setKpiKey("all");
      setPage(1);
    },
    [currentUserId],
  );

  return (
    <>
      <EntityListShell
        title={t("crm.tickets.list.title")}
        subtitle={t("crm.tickets.list.subtitle")}
        viewSwitcher={
          <TicketsHeaderTools
            view={view}
            onViewChange={setView}
            activePresetId={activePresetId}
            onSelectPreset={applyPreset}
          />
        }
        search={{
          value: search,
          onChange: (v) => handleSearch(v),
          placeholder: t("crm.tickets.list.search.placeholder"),
        }}
        primaryAction={
          <Button asChild>
            <Link href="/dashboard/sabdesk/new">
              <Plus className="h-4 w-4" /> {t("crm.tickets.list.action.new")}
            </Link>
          </Button>
        }
        filters={
          <TicketsFiltersRow
            statusFilter={statusFilter}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setActivePresetId("all");
              setClientPredicate(null);
              setPage(1);
            }}
            priorityFilter={priorityFilter}
            onPriorityChange={(v) => {
              setPriorityFilter(v);
              setActivePresetId("all");
              setClientPredicate(null);
            }}
            severityFilter={severityFilter}
            onSeverityChange={(v) => {
              setSeverityFilter(v);
              setActivePresetId("all");
              setClientPredicate(null);
              setPage(1);
            }}
            channelFilter={channelFilter}
            onChannelChange={(v) => {
              setChannelFilter(v);
              setActivePresetId("all");
              setClientPredicate(null);
            }}
            categoryFilter={categoryFilter}
            onCategoryChange={(v) => {
              setCategoryFilter(v);
              setActivePresetId("all");
              setClientPredicate(null);
            }}
            assigneeFilter={assigneeFilter}
            onAssigneeChange={(v) => {
              setAssigneeFilter(v);
              setActivePresetId("all");
              setClientPredicate(null);
              setPage(1);
            }}
            requesterKindFilter={requesterKindFilter}
            onRequesterKindChange={(v) => {
              setRequesterKindFilter(v);
              setActivePresetId("all");
              setClientPredicate(null);
            }}
            dateRange={dateRange}
            onDateRangeChange={(r) => {
              setDateRange(r);
              setActivePresetId("all");
              setClientPredicate(null);
            }}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
          />
        }
        bulkBar={
          selected.size > 0 ? (
            <TicketsBulkBar
              count={selected.size}
              onClear={() => setSelected(new Set())}
              onAssign={(userId) => runBulk("assign", userId ?? "")}
              onPriority={(p) => runBulk("priority", p)}
              onStatus={(s) => runBulk("status", s)}
              onMerge={runBulkMerge}
              onDelete={() => runBulk("delete")}
              onExport={exportCsv}
            />
          ) : null
        }
        empty={
          !isPending &&
          visibleTickets.length === 0 &&
          initialError === undefined ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <h3 className="text-base font-medium text-[var(--st-text)]">
                No tickets match
              </h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                Clear filters or log a new ticket to get started.
              </p>
              <Button asChild>
                <Link href="/dashboard/sabdesk/new">
                  <Plus className="h-4 w-4" /> New ticket
                </Link>
              </Button>
            </div>
          ) : null
        }
        loading={isPending && tickets.length === 0}
        pagination={
          tickets.length > 0 ? (
            <PaginationBar
              page={page}
              limit={TICKETS_PER_PAGE}
              hasMore={hasMore}
              controlled={{
                onChange: (next) => setPage(next.page),
              }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          <TicketsKpiStrip
            counts={kpiCounts}
            active={kpiKey}
            onPick={(next) => {
              setKpiKey(next);
              setPage(1);
            }}
          />

          {view === "table" ? (
            <TicketsTable
              tickets={visibleTickets}
              loading={isPending}
              selectedIds={selected}
              onToggleOne={handleToggleOne}
              onToggleAll={handleToggleAll}
              onDelete={(id) => setDeleteTargetId(id)}
              onMerge={(id) => {
                // Single-row merge — open dialog with that ticket selected
                // as the source. Target chosen in dialog.
                setMergeTargetId(id);
                setMergeIntoId("");
              }}
              requesterKindOf={requesterKindOf}
            />
          ) : view === "kanban" ? (
            <TicketsKanban tickets={visibleTickets} />
          ) : view === "queue" ? (
            <TicketsQueue tickets={visibleTickets} />
          ) : (
            <TicketsInbox tickets={visibleTickets} />
          )}
        </div>
      </EntityListShell>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this ticket permanently?"
        description="This permanently removes the ticket. The action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      {/* Merge confirmation */}
      <ConfirmDialog
        open={!!mergeTargetId}
        onOpenChange={(o) => {
          if (!o) {
            setMergeTargetId(null);
            setMergeIntoId("");
          }
        }}
        title={
          selected.size >= 2
            ? `Merge ${selected.size - 1} ticket(s) into the first selected?`
            : "Merge into another ticket?"
        }
        description={
          selected.size >= 2
            ? "Source tickets are closed and parented to the target. This cannot be undone."
            : "Use bulk-select to merge multiple tickets into one. For a single-row merge, edit the ticket and set its parent."
        }
        confirmLabel="Merge"
        confirmTone="primary"
        onConfirm={handleConfirmMerge}
      />
    </>
  );
}

export default TicketsListClient;
