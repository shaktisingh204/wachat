'use client';

import { Button, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useDebouncedCallback } from 'use-debounce';
import { Plus,
  SlidersHorizontal } from 'lucide-react';

/**
 * §1D Stock Adjustments list client.
 *
 * Composition: `<EntityListShell>` with
 *   - 4-card KPI strip (pending · approved · rejected · total impact)
 *   - 5-field filter row (status, warehouse, reason, approver, date range)
 *   - 10-col `<AdjustmentsTable>` (split out for line-cap)
 *   - Bulk bar (approve / reject / export / delete)
 *   - Pagination
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

import {
    approveCrmStockAdjustment,
    bulkStockAdjustmentAction,
    deleteCrmStockAdjustment,
    getCrmStockAdjustmentKpis,
    getCrmStockAdjustmentsPaginated,
    rejectCrmStockAdjustment,
    type CrmStockAdjustmentFilters,
    type CrmStockAdjustmentKpis,
} from '@/app/actions/crm-inventory.actions';
import type { CrmStockAdjustment } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { mapToStockAdjustmentDto, StockAdjustment } from '../types';

import {
    AdjustmentsBulkBar,
    AdjustmentsFiltersRow,
    AdjustmentsKpiStrip,
    adjustmentsToCsv,
    type AdjustmentStatusFilter,
} from './adjustments-bits';
import { AdjustmentsTable } from './adjustments-table';

const PER_PAGE = 20;

const EMPTY_KPIS: CrmStockAdjustmentKpis = {
    pending: 0,
    approved: 0,
    rejected: 0,
    totalImpactValue: 0,
};

function impactOf(adj: StockAdjustment): number {
    const qty = Number(adj.quantity || 0);
    const cost = Number(adj.costPerUnit || 0);
    if (!cost) return Math.abs(qty);
    return Math.abs(qty * cost);
}

export function AdjustmentsListClient() {
    const { toast } = useZoruToast();

    const [rows, setRows] = React.useState<StockAdjustment[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [kpis, setKpis] = React.useState<CrmStockAdjustmentKpis>(EMPTY_KPIS);
    const [isPending, startTransition] = React.useTransition();

    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] =
        React.useState<AdjustmentStatusFilter>('');
    const [warehouseId, setWarehouseId] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [approverId, setApproverId] = React.useState('');
    const [dateFrom, setDateFrom] = React.useState('');
    const [dateTo, setDateTo] = React.useState('');

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
        null,
    );
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const filters: CrmStockAdjustmentFilters = React.useMemo(() => {
        const f: CrmStockAdjustmentFilters = {};
        if (statusFilter) f.status = statusFilter;
        if (warehouseId) f.warehouseId = warehouseId;
        if (reason) f.reason = reason;
        if (approverId) f.approverId = approverId;
        if (dateFrom) f.dateFrom = dateFrom;
        if (dateTo) f.dateTo = dateTo;
        return f;
    }, [statusFilter, warehouseId, reason, approverId, dateFrom, dateTo]);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ adjustments, total: count }, kpiData] = await Promise.all([
                getCrmStockAdjustmentsPaginated(page, PER_PAGE, search, filters),
                getCrmStockAdjustmentKpis(),
            ]);
            setRows(adjustments.map(mapToStockAdjustmentDto));
            setTotal(count);
            setKpis(kpiData);
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
        setWarehouseId('');
        setReason('');
        setApproverId('');
        setDateFrom('');
        setDateTo('');
        setSearch('');
        setPage(1);
    }, []);

    const hasActiveFilters =
        !!statusFilter ||
        !!warehouseId ||
        !!reason ||
        !!approverId ||
        !!dateFrom ||
        !!dateTo ||
        !!search;

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
            setSelected(
                all ? new Set(rows.map((r) => String(r._id))) : new Set(),
            );
        },
        [rows],
    );

    const deleteTarget = React.useMemo(
        () => rows.find((r) => String(r._id) === deleteTargetId) ?? null,
        [rows, deleteTargetId],
    );

    async function handleApprove(id: string) {
        const res = await approveCrmStockAdjustment(id);
        if (res.success) {
            toast({ title: 'Adjustment approved' });
            fetchData();
        } else {
            toast({
                title: 'Approve failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    async function handleReject(id: string) {
        const res = await rejectCrmStockAdjustment(id);
        if (res.success) {
            toast({ title: 'Adjustment rejected' });
            fetchData();
        } else {
            toast({
                title: 'Reject failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    async function handleConfirmDelete() {
        if (!deleteTargetId) return;
        const res = await deleteCrmStockAdjustment(deleteTargetId);
        if (res.success) {
            toast({ title: 'Adjustment deleted' });
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

    async function runBulk(op: 'approve' | 'reject' | 'delete') {
        if (selected.size === 0) return;
        const res = await bulkStockAdjustmentAction(Array.from(selected), op);
        if (res.success) {
            toast({
                title: `${res.processed} adjustment${
                    res.processed === 1 ? '' : 's'
                } updated`,
            });
            setSelected(new Set());
            fetchData();
        } else {
            toast({
                title: 'Bulk action failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setBulkDeleteOpen(false);
    }

    function exportCsv() {
        const subset =
            selected.size > 0
                ? rows.filter((r) => selected.has(String(r._id)))
                : rows;
        const csv = adjustmentsToCsv(
            subset.map((r) => ({
                adjustmentNumber: r.adjustmentNumber,
                date: r.date,
                warehouseName: r.warehouseName,
                reason: r.reason,
                linesCount: r.lines?.length ?? 1,
                impact: impactOf(r),
                status: r.status,
                approvedByName: r.approvedByName,
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-adjustments-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    return (
        <>
            <EntityListShell
                title="Stock Adjustments"
                subtitle="Manual inventory corrections with approval workflow."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search adjustment #, reference, notes…',
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/inventory/adjustments/new">
                            <Plus className="h-4 w-4" /> New Adjustment
                        </Link>
                    </Button>
                }
                filters={
                    <AdjustmentsFiltersRow
                        filters={{
                            status: statusFilter,
                            warehouseId,
                            reason,
                            approverId,
                            dateFrom,
                            dateTo,
                        }}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                        onChange={(next) => {
                            if ('status' in next)
                                setStatusFilter(
                                    (next.status as AdjustmentStatusFilter) ?? '',
                                );
                            if ('warehouseId' in next)
                                setWarehouseId(next.warehouseId ?? '');
                            if ('reason' in next) setReason(next.reason ?? '');
                            if ('approverId' in next)
                                setApproverId(next.approverId ?? '');
                            if ('dateFrom' in next)
                                setDateFrom(next.dateFrom ?? '');
                            if ('dateTo' in next) setDateTo(next.dateTo ?? '');
                            setPage(1);
                        }}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <AdjustmentsBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onApprove={() => runBulk('approve')}
                            onReject={() => runBulk('reject')}
                            onDelete={() => setBulkDeleteOpen(true)}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && rows.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <SlidersHorizontal className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No adjustments yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Record stock corrections — damages, counts, receipts —
                                with full approval and audit trail.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/inventory/adjustments/new">
                                    <Plus className="h-4 w-4" /> New Adjustment
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
                            controlled={{
                                onChange: (n) => setPage(n.page),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <AdjustmentsKpiStrip
                        kpis={kpis}
                        statusFilter={statusFilter}
                        onClearAll={clearFilters}
                        onPickStatus={(s) => {
                            setStatusFilter(s);
                            setPage(1);
                        }}
                    />

                    <AdjustmentsTable
                        rows={rows}
                        loading={isPending}
                        selected={selected}
                        onToggleOne={toggleOne}
                        onToggleAll={toggleAll}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onDelete={(id) => setDeleteTargetId(id)}
                    />
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this adjustment?"
                description={`This permanently removes adjustment "${
                    deleteTarget?.adjustmentNumber ??
                    String(deleteTarget?._id ?? '').slice(-6)
                }". Stock that was already applied is NOT reverted automatically — create a new adjustment if needed.`}
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Delete ${selected.size} adjustment${
                    selected.size === 1 ? '' : 's'
                }?`}
                description="This permanently removes the selected adjustments. Stock that was already applied is NOT reverted automatically."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={() => runBulk('delete')}
            />
        </>
    );
}

export default AdjustmentsListClient;
