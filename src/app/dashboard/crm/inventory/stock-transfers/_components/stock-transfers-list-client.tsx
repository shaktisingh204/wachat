'use client';

import {
  Badge,
  Button,
  Checkbox,
  Label,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { useDebouncedCallback } from 'use-debounce';
import {
  Activity,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  FileText,
  ListChecks,
  Plus,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

/**
 * <StockTransfersListClient /> — KPI strip · filters · table · bulk bar · pagination.
 *
 * Mirrors the §1D adjustments list pattern: 4-card KPI strip,
 * status + warehouse filters, checkbox-gated bulk bar (approve / cancel /
 * delete), export CSV + XLSX, and inline row delete.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

import {
  bulkStockTransferAction,
  deleteStockTransfer,
  getStockTransfers,
  type CrmStockTransfer,
  type CrmStockTransferFilters,
  type CrmStockTransferKpis,
  type CrmStockTransferStatus,
} from '@/app/actions/crm-stock-transfers.actions';
import type { WithId } from 'mongodb';

const PER_PAGE = 20;
const BASE = '/dashboard/crm/inventory/stock-transfers';

const EMPTY_KPIS: CrmStockTransferKpis = {
  total: 0,
  inTransit: 0,
  received: 0,
  draft: 0,
};

type StatusFilterValue = '' | CrmStockTransferStatus;

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusBadge(status: string) {
  if (status === 'Received')
    return <Badge variant="success">Received</Badge>;
  if (status === 'InTransit')
    return <Badge variant="info">In Transit</Badge>;
  if (status === 'Approved')
    return <Badge variant="info">Approved</Badge>;
  if (status === 'Cancelled')
    return <Badge variant="danger">Cancelled</Badge>;
  if (status === 'archived')
    return <Badge variant="default">Archived</Badge>;
  return <Badge variant="warning">Draft</Badge>;
}

export function StockTransfersListClient() {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<WithId<CrmStockTransfer>[]>([]);
  const [total, setTotal] = React.useState(0);
  const [kpis, setKpis] = React.useState<CrmStockTransferKpis>(EMPTY_KPIS);
  const [page, setPage] = React.useState(1);
  const [isPending, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilterValue>('');
  const [fromWarehouseId, setFromWarehouseId] = React.useState('');
  const [toWarehouseId, setToWarehouseId] = React.useState('');

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [bulkOp, setBulkOp] = React.useState<'approve' | 'cancel' | 'delete' | null>(null);

  const filters: CrmStockTransferFilters = React.useMemo(() => {
    const f: CrmStockTransferFilters = {};
    if (statusFilter) f.status = statusFilter;
    if (fromWarehouseId) f.fromWarehouseId = fromWarehouseId;
    if (toWarehouseId) f.toWarehouseId = toWarehouseId;
    return f;
  }, [statusFilter, fromWarehouseId, toWarehouseId]);

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      const res = await getStockTransfers(page, PER_PAGE, search, filters);
      setRows(res.transfers);
      setTotal(res.total);
      setKpis(res.kpis);
    });
  }, [page, search, filters]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const clearFilters = React.useCallback(() => {
    setStatusFilter('');
    setFromWarehouseId('');
    setToWarehouseId('');
    setSearch('');
    setPage(1);
  }, []);

  const hasActiveFilters =
    !!statusFilter || !!fromWarehouseId || !!toWarehouseId || !!search;

  /* Selection */
  const toggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(
    (all: boolean) => {
      setSelected(all ? new Set(rows.map((r) => String(r._id))) : new Set());
    },
    [rows],
  );

  const headChecked =
    rows.length > 0 && rows.every((r) => selected.has(String(r._id)));

  const deleteTarget = React.useMemo(
    () => rows.find((r) => String(r._id) === deleteTargetId) ?? null,
    [rows, deleteTargetId],
  );

  /* Export helpers */
  function buildExportRows(subset: WithId<CrmStockTransfer>[]): ExportRow[] {
    return subset.map((r) => ({
      transfer_no: r.transferNumber || `ST-${String(r._id).slice(-6)}`,
      date: fmtDate(r.transferDate),
      from_warehouse: r.fromWarehouseName || String(r.fromWarehouseId),
      to_warehouse: r.toWarehouseName || String(r.toWarehouseId),
      items_count: Array.isArray(r.lineItems) ? r.lineItems.length : 0,
      status: r.status || 'Draft',
      requester: r.requesterName || '',
      notes: r.notes || '',
    }));
  }

  const EXPORT_HEADERS = [
    'transfer_no',
    'date',
    'from_warehouse',
    'to_warehouse',
    'items_count',
    'status',
    'requester',
    'notes',
  ];

  function exportCsv() {
    const subset =
      selected.size > 0
        ? rows.filter((r) => selected.has(String(r._id)))
        : rows;
    if (subset.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    downloadCsv(
      `stock-transfers-${dateStamp()}.csv`,
      EXPORT_HEADERS,
      buildExportRows(subset),
    );
    toast({ title: 'Exported', description: `${subset.length} transfers saved to CSV.` });
  }

  async function exportXlsx() {
    const subset =
      selected.size > 0
        ? rows.filter((r) => selected.has(String(r._id)))
        : rows;
    if (subset.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    await downloadXlsx(
      `stock-transfers-${dateStamp()}.xlsx`,
      EXPORT_HEADERS,
      buildExportRows(subset),
      'Stock Transfers',
    );
    toast({ title: 'Exported', description: `${subset.length} transfers saved to XLSX.` });
  }

  /* Single-row delete */
  async function handleConfirmDelete() {
    if (!deleteTargetId) return;
    const res = await deleteStockTransfer(deleteTargetId);
    if (res.success) {
      toast({ title: 'Stock transfer deleted' });
      fetchData();
    } else {
      toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
    }
    setDeleteTargetId(null);
  }

  /* Bulk confirm */
  async function handleBulkConfirm() {
    if (!bulkOp || selected.size === 0) return;
    const res = await bulkStockTransferAction(Array.from(selected), bulkOp);
    if (res.success) {
      toast({
        title: `${res.processed} transfer${res.processed === 1 ? '' : 's'} ${bulkOp === 'delete' ? 'deleted' : bulkOp === 'approve' ? 'approved' : 'cancelled'}`,
      });
      setSelected(new Set());
      fetchData();
    } else {
      toast({ title: 'Bulk action failed', description: res.error, variant: 'destructive' });
    }
    setBulkOp(null);
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <EntityListShell
        title="Stock transfers"
        subtitle="Move inventory between warehouses with full audit trail."
        search={{
          value: search,
          onChange: (v) => handleSearch(v),
          placeholder: 'Search transfer #, notes…',
        }}
        primaryAction={
          <Button asChild>
            <Link href={`${BASE}/new`}>
              <Plus className="h-4 w-4" /> New transfer
            </Link>
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40 space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Status
              </Label>
              <EnumFilterField
                enumName="stockTransferStatus"
                value={statusFilter || 'all'}
                onChange={(v) => {
                  setStatusFilter(v === 'all' ? '' : (v as CrmStockTransferStatus));
                  setPage(1);
                }}
                allLabel="Any status"
              />
            </div>
            <div className="w-56 space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                From
              </Label>
              <EntityFormField
                entity="warehouse"
                name="filter_fromWarehouseId"
                initialId={fromWarehouseId || null}
                placeholder="Any source"
                onChange={(id) => {
                  setFromWarehouseId(id ?? '');
                  setPage(1);
                }}
              />
            </div>
            <div className="w-56 space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                To
              </Label>
              <EntityFormField
                entity="warehouse"
                name="filter_toWarehouseId"
                initialId={toWarehouseId || null}
                placeholder="Any destination"
                onChange={(id) => {
                  setToWarehouseId(id ?? '');
                  setPage(1);
                }}
              />
            </div>
            {hasActiveFilters ? (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X className="mr-1 h-3.5 w-3.5" /> Clear filters
              </Button>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <ListChecks className="h-4 w-4 text-zoru-primary" />
                {selected.size} selected
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => setBulkOp('approve')}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkOp('cancel')}>
                  Cancel
                </Button>
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button size="sm" variant="outline" onClick={exportXlsx}>
                  <Download className="h-3.5 w-3.5" /> XLSX
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkOp('delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null
        }
        empty={
          !isPending && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <ArrowRightLeft className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">
                No stock transfers yet
              </h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Move stock between warehouses with a clear audit trail.
              </p>
              <Button asChild>
                <Link href={`${BASE}/new`}>
                  <Plus className="h-4 w-4" /> New transfer
                </Link>
              </Button>
            </div>
          ) : null
        }
        loading={isPending && rows.length === 0}
        pagination={
          rows.length > 0 ? (
            <PaginationBar
              page={page}
              limit={PER_PAGE}
              hasMore={page < totalPages}
              total={total}
              controlled={{ onChange: (n) => setPage(n.page) }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total"
              value={kpis.total}
              icon={<FileText className="h-4 w-4" />}
            />
            <StatCard
              label="In Transit"
              value={kpis.inTransit}
              icon={<Truck className="h-4 w-4" />}
            />
            <StatCard
              label="Received"
              value={kpis.received}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              label="Draft"
              value={kpis.draft}
              icon={<Activity className="h-4 w-4" />}
            />
          </div>

          {/* Export row (shown when no selection) */}
          {selected.size === 0 && rows.length > 0 ? (
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={exportXlsx}>
                <Download className="h-3.5 w-3.5" /> Export XLSX
              </Button>
            </div>
          ) : null}

          {/* Table */}
          <div className="overflow-x-auto rounded-md border border-zoru-line">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-8">
                    <Checkbox
                      checked={headChecked}
                      onCheckedChange={(c) => toggleAll(Boolean(c))}
                      aria-label="Select all"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead>Transfer #</ZoruTableHead>
                  <ZoruTableHead>Date</ZoruTableHead>
                  <ZoruTableHead>From</ZoruTableHead>
                  <ZoruTableHead>To</ZoruTableHead>
                  <ZoruTableHead className="text-right">Items</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="w-12" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isPending && rows.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <ZoruTableRow key={i}>
                        <ZoruTableCell colSpan={8}>
                          <Skeleton className="h-6 w-full" />
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))
                  : rows.map((r) => {
                      const id = String(r._id);
                      const lineCount = Array.isArray(r.lineItems)
                        ? r.lineItems.length
                        : 0;
                      const checked = selected.has(id);
                      return (
                        <ZoruTableRow key={id}>
                          <ZoruTableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleOne(id)}
                              aria-label={`Select ${r.transferNumber ?? id.slice(-6)}`}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <EntityRowLink
                              href={`${BASE}/${id}`}
                              label={
                                <span className="font-mono">
                                  {r.transferNumber || `ST-${id.slice(-6)}`}
                                </span>
                              }
                              subtitle={
                                lineCount
                                  ? `${lineCount} line${lineCount === 1 ? '' : 's'}`
                                  : undefined
                              }
                            />
                          </ZoruTableCell>
                          <ZoruTableCell>{fmtDate(r.transferDate)}</ZoruTableCell>
                          <ZoruTableCell>
                            <EntityPickerChip
                              entity="warehouse"
                              id={String(r.fromWarehouseId)}
                              fallback={r.fromWarehouseName || 'Warehouse'}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <EntityPickerChip
                              entity="warehouse"
                              id={String(r.toWarehouseId)}
                              fallback={r.toWarehouseName || 'Warehouse'}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right font-mono">
                            {lineCount}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            {statusBadge(String(r.status || 'Draft'))}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
                              onClick={() => setDeleteTargetId(id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })}
              </ZoruTableBody>
            </Table>
          </div>
        </div>
      </EntityListShell>

      {/* Single-row delete */}
      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this stock transfer?"
        description={`This permanently removes "${
          deleteTarget?.transferNumber ?? String(deleteTarget?._id ?? '').slice(-6)
        }". Inventory already moved is NOT reversed automatically.`}
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      {/* Bulk approve */}
      <ConfirmDialog
        open={bulkOp === 'approve'}
        onOpenChange={(o) => !o && setBulkOp(null)}
        title={`Approve ${selected.size} transfer${selected.size === 1 ? '' : 's'}?`}
        description="Selected transfers will be set to Approved status."
        confirmLabel="Approve"
        confirmTone="primary"
        onConfirm={handleBulkConfirm}
      />

      {/* Bulk cancel */}
      <ConfirmDialog
        open={bulkOp === 'cancel'}
        onOpenChange={(o) => !o && setBulkOp(null)}
        title={`Cancel ${selected.size} transfer${selected.size === 1 ? '' : 's'}?`}
        description="Selected transfers will be marked as Cancelled. This cannot be undone."
        confirmLabel="Cancel transfers"
        confirmTone="primary"
        onConfirm={handleBulkConfirm}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkOp === 'delete'}
        onOpenChange={(o) => !o && setBulkOp(null)}
        title={`Delete ${selected.size} transfer${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected transfers. Inventory already moved is NOT reversed automatically."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkConfirm}
      />
    </>
  );
}

export default StockTransfersListClient;
