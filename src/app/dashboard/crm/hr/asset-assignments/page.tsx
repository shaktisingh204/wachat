'use client';

/**
 * HR Asset Assignments — Deep list page (§1D.1).
 *
 * KPI strip (assigned · returned · lost-or-damaged · top asset type) ·
 * search · status filter · asset-id quick filter · date range · row
 * selection with bulk return / archive / delete · CSV + XLSX export ·
 * pagination · `EntityRowLink` for the primary cell. Multi-tenant via
 * `getSession()` in the server actions.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDateRangePicker,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import {
  bulkAssetAssignmentAction,
  deleteAssetAssignment,
  getAssetAssignmentKpis,
  getAssetAssignments,
} from '@/app/actions/crm-asset-assignments.actions';
import type {
  CrmAssetAssignmentDoc,
  CrmAssetAssignmentKpis,
  CrmAssetAssignmentStatus,
} from '@/app/actions/crm-asset-assignments.actions';

const BASE = '/dashboard/crm/hr/asset-assignments';
const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{
  value: CrmAssetAssignmentStatus | 'all';
  label: string;
}> = [
  { value: 'all', label: 'All statuses' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'returned', label: 'Returned' },
  { value: 'lost', label: 'Lost' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmAssetAssignmentStatus, StatusTone> = {
  assigned: 'blue',
  returned: 'green',
  lost: 'red',
  damaged: 'red',
  archived: 'neutral',
};

const EMPTY_KPIS: CrmAssetAssignmentKpis = {
  assigned: 0,
  returned: 0,
  lostOrDamaged: 0,
};

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function withinRange(value: unknown, range: DateRange | undefined): boolean {
  if (!range?.from && !range?.to) return true;
  if (!value) return false;
  const t = new Date(value as string).getTime();
  if (!Number.isFinite(t)) return false;
  if (range.from && t < range.from.getTime()) return false;
  if (range.to && t > range.to.getTime() + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

export default function AssetAssignmentsListPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<CrmAssetAssignmentDoc[]>([]);
  const [kpis, setKpis] = React.useState<CrmAssetAssignmentKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<
    CrmAssetAssignmentStatus | 'all'
  >('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<
    'delete' | 'archive' | 'return' | null
  >(null);
  const [bulkPending, startBulkTransition] = React.useTransition();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, k] = await Promise.all([
        getAssetAssignments({
          q: search.trim() || undefined,
          status: statusFilter,
        }),
        getAssetAssignmentKpis(),
      ]);
      setRows(items);
      setKpis(k);
    } catch {
      setRows([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  const filtered = React.useMemo(() => {
    return rows.filter((r) =>
      withinRange(r.assigned_at ?? r.createdAt, dateRange),
    );
  }, [rows, dateRange]);

  const pageRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  const toggleAll = (check: boolean): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (check) for (const r of pageRows) next.add(r._id);
      else for (const r of pageRows) next.delete(r._id);
      return next;
    });
  };

  const toggleOne = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportRows = React.useCallback(() => {
    const source =
      selected.size > 0
        ? filtered.filter((r) => selected.has(r._id))
        : filtered;
    return source.map((r) => ({
      asset: r.asset_name || r.asset_id,
      employee: r.employee_name || r.employee_id,
      assignedAt: fmtDate(r.assigned_at),
      returnedAt: fmtDate(r.returned_at),
      status: r.status ?? 'assigned',
    }));
  }, [filtered, selected]);

  const handleCsv = (): void => {
    downloadCsv(
      `asset-assignments-${dateStamp()}.csv`,
      ['asset', 'employee', 'assignedAt', 'returnedAt', 'status'],
      exportRows(),
    );
  };

  const handleXlsx = (): void => {
    void downloadXlsx(
      `asset-assignments-${dateStamp()}.xlsx`,
      ['asset', 'employee', 'assignedAt', 'returnedAt', 'status'],
      exportRows(),
      'Assignments',
    );
  };

  const runBulk = (op: 'delete' | 'archive' | 'return'): void => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const r = await bulkAssetAssignmentAction(ids, op);
      if (r.success) {
        toast({
          title: `${r.affected} ${op === 'delete' ? 'deleted' : op === 'archive' ? 'archived' : 'marked returned'}`,
        });
        setSelected(new Set());
        setPendingBulk(null);
        await refresh();
      } else {
        toast({
          title: 'Bulk action failed',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleSingleDelete = (): void => {
    if (!pendingDeleteId) return;
    startBulkTransition(async () => {
      const r = await deleteAssetAssignment(pendingDeleteId);
      if (r.success) {
        toast({ title: 'Assignment deleted' });
        setPendingDeleteId(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(pendingDeleteId);
          return next;
        });
        await refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  const resetFilters = (): void => {
    setSearch('');
    setStatusFilter('all');
    setDateRange(undefined);
    setPage(1);
  };

  const hasFilters =
    !!search ||
    statusFilter !== 'all' ||
    !!dateRange?.from ||
    !!dateRange?.to;

  return (
    <>
      <EntityListShell
        title="Asset assignments"
        subtitle="Issue and return events between assets and employees."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onSelect={handleCsv}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Download CSV
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem onSelect={handleXlsx}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Download XLSX
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="h-3.5 w-3.5" /> New assignment
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: 'Search by asset or employee…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as CrmAssetAssignmentStatus | 'all');
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[170px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruDateRangePicker
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
              placeholder="Assigned date range"
              className="h-9 w-[230px]"
            />
            {hasFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" /> Reset
              </ZoruButton>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zoru-ink">{selected.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={handleCsv}>
                  <Download className="h-3.5 w-3.5" /> Export selected
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingBulk('return')}
                >
                  Mark returned
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingBulk('archive')}
                >
                  Archive
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setPendingBulk('delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
        pagination={
          <PaginationBar
            page={page}
            limit={PAGE_SIZE}
            hasMore={filtered.length > page * PAGE_SIZE}
            total={filtered.length}
            controlled={{ onChange: ({ page: p }) => setPage(p) }}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Currently assigned</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.assigned}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Returned</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.returned}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Lost or damaged</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.lostOrDamaged}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Top asset type</p>
              <p className="mt-1 truncate text-xl font-semibold text-zoru-ink">
                {kpis.topAssetType ?? '—'}
              </p>
            </ZoruCard>
          </div>

          {/* Table */}
          <ZoruCard className="p-0">
            <div className="overflow-x-auto rounded-[var(--zoru-radius)]">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      <ZoruCheckbox
                        aria-label="Select all"
                        checked={allOnPageSelected}
                        onCheckedChange={(v) => toggleAll(Boolean(v))}
                      />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Asset</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Assigned</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Returned</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {pageRows.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={7}
                        className="h-24 text-center text-zoru-ink-muted"
                      >
                        No assignments match this filter.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((r) => {
                      const status = (r.status ?? 'assigned') as CrmAssetAssignmentStatus;
                      const tone = STATUS_TONE[status] ?? 'neutral';
                      const isSelected = selected.has(r._id);
                      const assetLabel = r.asset_name || r.asset_id || '—';
                      const employeeLabel =
                        r.employee_name || r.employee_id || '—';
                      return (
                        <ZoruTableRow key={r._id} className="border-zoru-line">
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label={`Select assignment ${r._id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(r._id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="font-medium text-zoru-ink">
                            <EntityRowLink
                              href={`${BASE}/${r._id}`}
                              label={assetLabel}
                              subtitle={r.notes ?? undefined}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {employeeLabel}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {fmtDate(r.assigned_at)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {fmtDate(r.returned_at)}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill label={status} tone={tone} />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <ZoruButton variant="ghost" size="sm" asChild>
                              <Link href={`${BASE}/${r._id}/edit`}>Edit</Link>
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDeleteId(r._id)}
                              aria-label="Delete assignment"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            </ZoruButton>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })
                  )}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          </ZoruCard>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
        title="Delete assignment?"
        description="This removes the assignment row. The asset itself is unaffected."
        confirmLabel={bulkPending ? 'Deleting…' : 'Delete'}
        onConfirm={handleSingleDelete}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} assignments?`}
        description="This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />

      <ConfirmDialog
        open={pendingBulk === 'archive'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Archive ${selected.size} assignments?`}
        description="Archived assignments are hidden from the active list."
        confirmTone="primary"
        confirmLabel="Archive"
        onConfirm={() => runBulk('archive')}
      />

      <ConfirmDialog
        open={pendingBulk === 'return'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Mark ${selected.size} as returned?`}
        description="Stamps each row with today's date and flips status to returned."
        confirmTone="primary"
        confirmLabel="Mark returned"
        onConfirm={() => runBulk('return')}
      />
    </>
  );
}
