'use client';

import { Button, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Factory,
  Plus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * <PoListClient> — production-order list orchestrator per §1D.
 *
 * Ships:
 *   • KPI strip (5 cards)
 *   • Filters (status · BOM · date range · machine · operator · yield bucket)
 *   • Bulk action bar (change status · export · delete)
 *   • 11-col table (select · PO # · BOM ref · finished good chip · planned
 *     qty · actual yield · scrap · start · end · status · actions)
 */

import * as React from 'react';
import Link from 'next/link';

import {
    bulkProductionOrderAction,
    deleteProductionOrder,
    setProductionOrderStatus,
} from '@/app/actions/crm-production-orders.actions';
import type {
    CrmProductionOrderDoc,
    CrmProductionOrderKpis,
} from '@/app/actions/crm-production-orders.actions.types';

import { PoKpiStrip, type PoStatusFilter } from './po-kpi-strip';
import {
    PoBulkBar,
    PoFiltersRow,
    type PoBulkOp,
    type PoYieldBucket,
} from './po-filters';
import { PoTable, type PoStatusTarget } from './po-table';

export interface PoListClientProps {
    initialOrders: CrmProductionOrderDoc[];
    initialKpis: CrmProductionOrderKpis;
}

function toCsv(rows: CrmProductionOrderDoc[]): string {
    const head = [
        'orderNo',
        'bomRef',
        'finishedGood',
        'plannedQty',
        'actualYield',
        'scrap',
        'unit',
        'plannedStart',
        'plannedEnd',
        'machine',
        'operator',
        'status',
    ];
    const lines = rows.map((r) =>
        [
            r.orderNo,
            r.bomRef ?? r.bomId ?? '',
            r.finishedGoodName,
            r.plannedQty,
            r.actualYield ?? 0,
            r.scrap ?? 0,
            r.unit ?? '',
            r.plannedStart ?? '',
            r.plannedEnd ?? '',
            r.machineId ?? '',
            r.machineOperator ?? '',
            r.status,
        ]
            .map((cell) => {
                const v = String(cell ?? '');
                return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
            })
            .join(','),
    );
    return [head.join(','), ...lines].join('\n');
}

export function PoListClient({ initialOrders, initialKpis }: PoListClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { toast } = useZoruToast();

    // Use a state for orders to allow real-time updates
    const [orders, setOrders] = React.useState<CrmProductionOrderDoc[]>(initialOrders);

    // WebSocket real-time updates placeholder
    React.useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws/inventory`;
        let ws: WebSocket;
        try {
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'PO_UPDATE') {
                        setOrders((prev) => {
                            const idx = prev.findIndex((o) => o._id === data.payload._id);
                            if (idx >= 0) {
                                const copy = [...prev];
                                copy[idx] = { ...copy[idx], ...data.payload };
                                return copy;
                            }
                            return [data.payload, ...prev];
                        });
                    } else if (data.type === 'PO_DELETE') {
                        setOrders((prev) => prev.filter((o) => o._id !== data.payload._id));
                    }
                } catch (e) {
                    console.error('WS parse error:', e);
                }
            };
        } catch (e) {
            console.warn('Real-time updates not available:', e);
        }
        return () => ws?.close();
    }, []);

    /* Filters */
    const [search, setSearch] = React.useState(searchParams.get('search') || '');
    const [statusFilter, setStatusFilter] = React.useState<PoStatusFilter>(
        (searchParams.get('status') as PoStatusFilter) || 'all'
    );
    const [bomFilter, setBomFilter] = React.useState(searchParams.get('bom') || '');
    const [machineFilter, setMachineFilter] = React.useState(searchParams.get('machine') || '');
    const [operatorFilter, setOperatorFilter] = React.useState(searchParams.get('operator') || '');
    const [dateFrom, setDateFrom] = React.useState(searchParams.get('dateFrom') || '');
    const [dateTo, setDateTo] = React.useState(searchParams.get('dateTo') || '');
    const [yieldBucket, setYieldBucket] = React.useState<PoYieldBucket>(
        (searchParams.get('yieldBucket') as PoYieldBucket) || 'all'
    );

    // Deep linking: Sync state to URL params
    React.useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (search) params.set('search', search); else params.delete('search');
        if (statusFilter !== 'all') params.set('status', statusFilter); else params.delete('status');
        if (bomFilter) params.set('bom', bomFilter); else params.delete('bom');
        if (machineFilter) params.set('machine', machineFilter); else params.delete('machine');
        if (operatorFilter) params.set('operator', operatorFilter); else params.delete('operator');
        if (dateFrom) params.set('dateFrom', dateFrom); else params.delete('dateFrom');
        if (dateTo) params.set('dateTo', dateTo); else params.delete('dateTo');
        if (yieldBucket !== 'all') params.set('yieldBucket', yieldBucket); else params.delete('yieldBucket');
        
        const q = params.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }, [search, statusFilter, bomFilter, machineFilter, operatorFilter, dateFrom, dateTo, yieldBucket, pathname, router, searchParams]);


    /* Selection + dialogs */
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkOp, setBulkOp] = React.useState<PoBulkOp | null>(null);

    const hasActiveFilters =
        Boolean(search) ||
        statusFilter !== 'all' ||
        Boolean(bomFilter) ||
        Boolean(machineFilter) ||
        Boolean(operatorFilter) ||
        Boolean(dateFrom) ||
        Boolean(dateTo) ||
        yieldBucket !== 'all';

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
        const toTs = dateTo ? new Date(dateTo).getTime() : null;
        return orders.filter((o) => {
            if (q) {
                const hay = `${o.orderNo ?? ''} ${o.finishedGoodName ?? ''} ${o.bomRef ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (statusFilter !== 'all') {
                const s = (o.status ?? '').toLowerCase();
                if (statusFilter === 'planned' && s !== 'planned' && s !== 'draft') return false;
                if (statusFilter === 'in_progress' && s !== 'in_progress' && s !== 'released') return false;
                if (statusFilter === 'completed' && s !== 'completed' && s !== 'closed') return false;
            }
            if (bomFilter) {
                const ref = String(o.bomRef ?? o.bomId ?? '');
                if (!ref.includes(bomFilter)) return false;
            }
            if (machineFilter && o.machineId !== machineFilter) return false;
            if (operatorFilter) {
                const opId = String(o.machineOperatorId ?? o.machineOperator ?? '');
                if (opId !== operatorFilter) return false;
            }
            if (fromTs && o.plannedStart) {
                const t = new Date(o.plannedStart).getTime();
                if (!Number.isNaN(t) && t < fromTs) return false;
            }
            if (toTs && o.plannedStart) {
                const t = new Date(o.plannedStart).getTime();
                if (!Number.isNaN(t) && t > toTs) return false;
            }
            if (yieldBucket !== 'all') {
                const pct = o.plannedQty > 0 ? (o.actualYield ?? 0) / o.plannedQty : 0;
                if (yieldBucket === 'low' && pct >= 0.6) return false;
                if (yieldBucket === 'mid' && (pct < 0.6 || pct >= 0.9)) return false;
                if (yieldBucket === 'high' && pct < 0.9) return false;
            }
            return true;
        });
    }, [
        orders,
        search,
        statusFilter,
        bomFilter,
        machineFilter,
        operatorFilter,
        dateFrom,
        dateTo,
        yieldBucket,
    ]);

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
            setSelected(all ? new Set(filtered.map((o) => o._id)) : new Set());
        },
        [filtered],
    );

    const clearFilters = React.useCallback(() => {
        setSearch('');
        setStatusFilter('all');
        setBomFilter('');
        setMachineFilter('');
        setOperatorFilter('');
        setDateFrom('');
        setDateTo('');
        setYieldBucket('all');
    }, []);

    const exportCsv = React.useCallback(() => {
        const rows =
            selected.size > 0
                ? orders.filter((o) => selected.has(o._id))
                : filtered;
        if (rows.length === 0) {
            toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
            return;
        }
        const csv = toCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `production-orders-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: 'Exported', description: `${rows.length} orders saved to CSV.` });
    }, [orders, filtered, selected, toast]);

    const handleDeleteConfirm = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteProductionOrder(deleteTargetId);
        if (res.success) {
            toast({ title: 'Production order deleted' });
            router.refresh();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, router, toast]);

    const handleRowStatus = React.useCallback(
        async (id: string, status: PoStatusTarget) => {
            const res = await setProductionOrderStatus(id, status);
            if (res.success) {
                toast({ title: `Status → ${status}` });
                router.refresh();
            } else {
                toast({
                    title: 'Status update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [router, toast],
    );

    const runBulkConfirm = React.useCallback(async () => {
        if (!bulkOp || selected.size === 0) return;
        const ids = Array.from(selected);
        const res = await bulkProductionOrderAction(ids, bulkOp);
        if (res.success) {
            toast({ title: `${res.processed} orders updated` });
            setSelected(new Set());
            router.refresh();
        } else {
            toast({
                title: 'Bulk action failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setBulkOp(null);
    }, [bulkOp, router, selected, toast]);

    return (
        <>
            <EntityListShell
                title="Production Orders"
                subtitle="Manufacturing job cards — track planned vs. actual yield and scrap."
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search order #, finished good, BOM ref…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/crm/inventory/bom">
                                <Factory className="h-4 w-4" /> BOMs
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/dashboard/crm/inventory/production-orders/new">
                                <Plus className="h-4 w-4" /> New order
                            </Link>
                        </Button>
                    </div>
                }
                filters={
                    <PoFiltersRow
                        status={statusFilter}
                        onStatusChange={setStatusFilter}
                        bomFilter={bomFilter}
                        onBomFilterChange={setBomFilter}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        onDateFromChange={setDateFrom}
                        onDateToChange={setDateTo}
                        machineFilter={machineFilter}
                        onMachineFilterChange={setMachineFilter}
                        operatorFilter={operatorFilter}
                        onOperatorFilterChange={setOperatorFilter}
                        yieldBucket={yieldBucket}
                        onYieldBucketChange={setYieldBucket}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <PoBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onDelete={() => setBulkOp('delete')}
                            onExport={exportCsv}
                            onChangeStatus={(op) => setBulkOp(op)}
                        />
                    ) : null
                }
                empty={
                    filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Factory className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No production orders yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Create one from a BOM to start tracking manufacturing job cards.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/inventory/production-orders/new">
                                    <Plus className="h-4 w-4" /> New order
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <PoKpiStrip
                        kpis={initialKpis}
                        activeFilter={statusFilter}
                        onPick={setStatusFilter}
                    />
                    <PoTable
                        orders={filtered}
                        selectedIds={selected}
                        onToggleOne={toggleOne}
                        onToggleAll={toggleAll}
                        onRowStatus={handleRowStatus}
                        onDelete={(id) => setDeleteTargetId(id)}
                    />
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this production order permanently?"
                description="This permanently removes the production order. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDeleteConfirm}
            />
            <ConfirmDialog
                open={!!bulkOp}
                onOpenChange={(o) => !o && setBulkOp(null)}
                title={
                    bulkOp === 'delete'
                        ? `Delete ${selected.size} order${selected.size === 1 ? '' : 's'}?`
                        : `Update ${selected.size} order${selected.size === 1 ? '' : 's'}?`
                }
                description={
                    bulkOp === 'delete'
                        ? 'This permanently removes the selected orders. This action cannot be undone.'
                        : 'The selected orders will be updated.'
                }
                requireTyped={bulkOp === 'delete' ? 'DELETE' : undefined}
                confirmLabel={bulkOp === 'delete' ? 'Delete' : 'Update'}
                confirmTone={bulkOp === 'delete' ? 'danger' : 'primary'}
                onConfirm={runBulkConfirm}
            />
        </>
    );
}

export default PoListClient;
