'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  useDebouncedCallback } from 'use-debounce';
import {
    Activity,
  ArrowRightLeft,
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
  Truck,
  X,
  } from 'lucide-react';

/**
 * <StockTransfersListClient /> — KPI strip · filters · table · pagination.
 *
 * Mirrors the §1D adjustments list pattern but compact: 4-card KPI strip,
 * status + warehouse filters, a 6-col table, and inline row delete.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';

import {
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
        return <ZoruBadge variant="success">Received</ZoruBadge>;
    if (status === 'InTransit')
        return <ZoruBadge variant="info">In Transit</ZoruBadge>;
    if (status === 'Cancelled')
        return <ZoruBadge variant="danger">Cancelled</ZoruBadge>;
    if (status === 'archived')
        return <ZoruBadge variant="default">Archived</ZoruBadge>;
    return <ZoruBadge variant="warning">Draft</ZoruBadge>;
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
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
        null,
    );

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
        !!statusFilter ||
        !!fromWarehouseId ||
        !!toWarehouseId ||
        !!search;

    const deleteTarget = React.useMemo(
        () => rows.find((r) => String(r._id) === deleteTargetId) ?? null,
        [rows, deleteTargetId],
    );

    async function handleConfirmDelete() {
        if (!deleteTargetId) return;
        const res = await deleteStockTransfer(deleteTargetId);
        if (res.success) {
            toast({ title: 'Stock transfer deleted' });
            fetchData();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteTargetId(null);
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
                    <ZoruButton asChild>
                        <Link href={`${BASE}/new`}>
                            <Plus className="h-4 w-4" /> New transfer
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-40 space-y-1">
                            <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                Status
                            </ZoruLabel>
                            <EnumFilterField
                                enumName="stockTransferStatus"
                                value={statusFilter || 'all'}
                                onChange={(v) => {
                                    setStatusFilter(v === 'all' ? '' : v as CrmStockTransferStatus);
                                    setPage(1);
                                }}
                                allLabel="Any status"
                            />
                        </div>
                        <div className="w-56 space-y-1">
                            <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                From
                            </ZoruLabel>
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
                            <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                To
                            </ZoruLabel>
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
                            <ZoruButton
                                size="sm"
                                variant="ghost"
                                onClick={clearFilters}
                            >
                                <X className="mr-1 h-3.5 w-3.5" /> Clear filters
                            </ZoruButton>
                        ) : null}
                    </div>
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
                            <ZoruButton asChild>
                                <Link href={`${BASE}/new`}>
                                    <Plus className="h-4 w-4" /> New transfer
                                </Link>
                            </ZoruButton>
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
                        <ZoruStatCard
                            label="Total"
                            value={kpis.total}
                            icon={<FileText className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="In Transit"
                            value={kpis.inTransit}
                            icon={<Truck className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Received"
                            value={kpis.received}
                            icon={<CheckCircle2 className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Draft"
                            value={kpis.draft}
                            icon={<Activity className="h-4 w-4" />}
                        />
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-md border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Transfer #</ZoruTableHead>
                                    <ZoruTableHead>Date</ZoruTableHead>
                                    <ZoruTableHead>From</ZoruTableHead>
                                    <ZoruTableHead>To</ZoruTableHead>
                                    <ZoruTableHead className="text-right">
                                        Items
                                    </ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead className="w-12" />
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isPending && rows.length === 0
                                    ? Array.from({ length: 5 }).map((_, i) => (
                                          <ZoruTableRow key={i}>
                                              <ZoruTableCell colSpan={7}>
                                                  <ZoruSkeleton className="h-6 w-full" />
                                              </ZoruTableCell>
                                          </ZoruTableRow>
                                      ))
                                    : rows.map((r) => {
                                          const id = String(r._id);
                                          const lineCount = Array.isArray(
                                              r.lineItems,
                                          )
                                              ? r.lineItems.length
                                              : 0;
                                          return (
                                              <ZoruTableRow key={id}>
                                                  <ZoruTableCell>
                                                      <Link
                                                          href={`${BASE}/${id}`}
                                                          className="font-mono text-zoru-link hover:underline"
                                                      >
                                                          {r.transferNumber ||
                                                              `ST-${id.slice(-6)}`}
                                                      </Link>
                                                  </ZoruTableCell>
                                                  <ZoruTableCell>
                                                      {fmtDate(r.transferDate)}
                                                  </ZoruTableCell>
                                                  <ZoruTableCell>
                                                      <EntityPickerChip
                                                          entity="warehouse"
                                                          id={String(
                                                              r.fromWarehouseId,
                                                          )}
                                                          fallback={
                                                              r.fromWarehouseName ||
                                                              'Warehouse'
                                                          }
                                                      />
                                                  </ZoruTableCell>
                                                  <ZoruTableCell>
                                                      <EntityPickerChip
                                                          entity="warehouse"
                                                          id={String(
                                                              r.toWarehouseId,
                                                          )}
                                                          fallback={
                                                              r.toWarehouseName ||
                                                              'Warehouse'
                                                          }
                                                      />
                                                  </ZoruTableCell>
                                                  <ZoruTableCell className="text-right font-mono">
                                                      {lineCount}
                                                  </ZoruTableCell>
                                                  <ZoruTableCell>
                                                      {statusBadge(
                                                          String(r.status || 'Draft'),
                                                      )}
                                                  </ZoruTableCell>
                                                  <ZoruTableCell className="text-right">
                                                      <ZoruButton
                                                          variant="ghost"
                                                          size="icon"
                                                          aria-label="Delete"
                                                          onClick={() =>
                                                              setDeleteTargetId(id)
                                                          }
                                                      >
                                                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                      </ZoruButton>
                                                  </ZoruTableCell>
                                              </ZoruTableRow>
                                          );
                                      })}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this stock transfer?"
                description={`This permanently removes "${
                    deleteTarget?.transferNumber ??
                    String(deleteTarget?._id ?? '').slice(-6)
                }". Inventory already moved is NOT reversed automatically.`}
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
        </>
    );
}

export default StockTransfersListClient;
