'use client';

import { Button, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useDebouncedCallback } from 'use-debounce';
import { Plus,
  Warehouse as WarehouseIcon } from 'lucide-react';

/**
 * §1D Warehouses list client.
 *
 * Composition: `<EntityListShell>` with
 *   - 4-card KPI strip
 *   - 5-field filter row + cascade country/state/city + default toggle
 *   - 10-col `<WarehousesTable>` (separate file for line-cap)
 *   - Bulk bar (archive / delete / export)
 *   - Pagination
 *
 * Server actions wired:
 *   - `getCrmWarehousesPaginated` + `getCrmWarehouseKpis`
 *   - `archiveCrmWarehouse` / `unarchiveCrmWarehouse`
 *   - `deleteCrmWarehouse` / `setDefaultCrmWarehouse`
 *   - `bulkWarehouseAction`
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

import {
    archiveCrmWarehouse,
    bulkWarehouseAction,
    deleteCrmWarehouse,
    getCrmWarehouseKpis,
    getCrmWarehousesPaginated,
    setDefaultCrmWarehouse,
    unarchiveCrmWarehouse,
    type CrmWarehouseFilters,
    type CrmWarehouseKpis,
} from '@/app/actions/crm-warehouses.actions';
import type { CrmWarehouse } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import {
    WarehousesBulkBar,
    WarehousesFiltersRow,
    WarehousesKpiStrip,
    warehousesToCsv,
    type WarehouseStatusFilter,
    type WarehouseTypeFilter,
} from './warehouses-bits';
import { WarehousesTable } from './warehouses-table';

const PER_PAGE = 20;

const EMPTY_KPIS: CrmWarehouseKpis = {
    total: 0,
    active: 0,
    climateControlled: 0,
    byType: [],
};

export function WarehousesListClient() {
    const { toast } = useZoruToast();

    const [rows, setRows] = React.useState<WithId<CrmWarehouse>[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [kpis, setKpis] = React.useState<CrmWarehouseKpis>(EMPTY_KPIS);
    const [isPending, startTransition] = React.useTransition();

    const [search, setSearch] = React.useState('');
    const [typeFilter, setTypeFilter] = React.useState<WarehouseTypeFilter>('');
    const [statusFilter, setStatusFilter] =
        React.useState<WarehouseStatusFilter>('');
    const [managerId, setManagerId] = React.useState('');
    const [country, setCountry] = React.useState('');
    const [stateVal, setStateVal] = React.useState('');
    const [city, setCity] = React.useState('');
    const [isDefault, setIsDefault] = React.useState<'' | 'yes' | 'no'>('');
    const [climateOnly, setClimateOnly] = React.useState(false);

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(
        null,
    );
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
        null,
    );

    const filters: CrmWarehouseFilters = React.useMemo(() => {
        const f: CrmWarehouseFilters = {};
        if (typeFilter) f.type = typeFilter;
        if (statusFilter) f.status = statusFilter;
        if (statusFilter === 'archived') f.includeArchived = true;
        if (managerId) f.managerId = managerId;
        if (country) f.country = country;
        if (stateVal) f.state = stateVal;
        if (city) f.city = city;
        if (isDefault) f.isDefault = isDefault;
        return f;
    }, [typeFilter, statusFilter, managerId, country, stateVal, city, isDefault]);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ warehouses, total: count }, kpiData] = await Promise.all([
                getCrmWarehousesPaginated(page, PER_PAGE, search, filters),
                getCrmWarehouseKpis(),
            ]);
            setRows(warehouses);
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
        setTypeFilter('');
        setStatusFilter('');
        setManagerId('');
        setCountry('');
        setStateVal('');
        setCity('');
        setIsDefault('');
        setClimateOnly(false);
        setSearch('');
        setPage(1);
    }, []);

    // KPI "climate-controlled" works as a client predicate (no server flag yet).
    const displayedRows = React.useMemo(() => {
        if (!climateOnly) return rows;
        return rows.filter((w) => !!w.climateControlled);
    }, [rows, climateOnly]);

    const hasActiveFilters =
        !!typeFilter ||
        !!statusFilter ||
        !!managerId ||
        !!country ||
        !!stateVal ||
        !!city ||
        !!isDefault ||
        !!search ||
        climateOnly;

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
                all ? new Set(displayedRows.map((r) => String(r._id))) : new Set(),
            );
        },
        [displayedRows],
    );

    const archiveTarget = React.useMemo(
        () => rows.find((r) => String(r._id) === archiveTargetId) ?? null,
        [rows, archiveTargetId],
    );
    const deleteTarget = React.useMemo(
        () => rows.find((r) => String(r._id) === deleteTargetId) ?? null,
        [rows, deleteTargetId],
    );

    async function handleConfirmArchive() {
        if (!archiveTargetId || !archiveTarget) return;
        const archived =
            !!archiveTarget.archived ||
            archiveTarget.status?.toLowerCase() ===
                'archived';
        const res = archived
            ? await unarchiveCrmWarehouse(archiveTargetId)
            : await archiveCrmWarehouse(archiveTargetId);
        if (res.success) {
            toast({
                title: archived ? 'Warehouse restored' : 'Warehouse archived',
            });
            fetchData();
        } else {
            toast({
                title: archived ? 'Restore failed' : 'Archive failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setArchiveTargetId(null);
    }

    async function handleConfirmDelete() {
        if (!deleteTargetId) return;
        const res = await deleteCrmWarehouse(deleteTargetId);
        if (res.success) {
            toast({ title: 'Warehouse deleted' });
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

    async function handleSetDefault(id: string) {
        const res = await setDefaultCrmWarehouse(id);
        if (res.success) {
            toast({ title: 'Default warehouse updated' });
            fetchData();
        } else {
            toast({
                title: 'Update failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    async function runBulk(op: 'archive' | 'delete') {
        if (selected.size === 0) return;
        const res = await bulkWarehouseAction(Array.from(selected), op);
        if (res.success) {
            toast({
                title: `${res.processed} warehouse${
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
    }

    function exportCsv() {
        const subset =
            selected.size > 0
                ? displayedRows.filter((r) => selected.has(String(r._id)))
                : displayedRows;
        const csv = warehousesToCsv(
            subset.map((w) => ({
                code: w.code,
                name: w.name,
                type: w.type,
                city: w.city,
                managerName: w.managerName,
                capacityUnits: w.capacityUnits,
                capacitySqft: w.capacitySqft,
                isDefault: w.isDefault,
                status: w.status,
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `warehouses-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    return (
        <>
            <EntityListShell
                title="Warehouses"
                subtitle="Stock locations — managers, capacity, defaults and addresses."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search name, code, city…',
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/inventory/warehouses/new">
                            <Plus className="h-4 w-4" /> New Warehouse
                        </Link>
                    </Button>
                }
                filters={
                    <WarehousesFiltersRow
                        filters={{
                            type: typeFilter,
                            status: statusFilter,
                            managerId,
                            country,
                            state: stateVal,
                            city,
                            isDefault,
                        }}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                        onChange={(next) => {
                            if ('type' in next)
                                setTypeFilter(
                                    (next.type as WarehouseTypeFilter) ?? '',
                                );
                            if ('status' in next)
                                setStatusFilter(
                                    (next.status as WarehouseStatusFilter) ?? '',
                                );
                            if ('managerId' in next)
                                setManagerId(next.managerId ?? '');
                            if ('country' in next) setCountry(next.country ?? '');
                            if ('state' in next) setStateVal(next.state ?? '');
                            if ('city' in next) setCity(next.city ?? '');
                            if ('isDefault' in next)
                                setIsDefault(
                                    (next.isDefault as '' | 'yes' | 'no') ?? '',
                                );
                            setPage(1);
                        }}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <WarehousesBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => runBulk('archive')}
                            onDelete={() => runBulk('delete')}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && displayedRows.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <WarehouseIcon className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                No warehouses yet
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                Add your first storage location so items can be
                                tracked across branches.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/inventory/warehouses/new">
                                    <Plus className="h-4 w-4" /> Add warehouse
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
                    <WarehousesKpiStrip
                        kpis={kpis}
                        typeFilter={typeFilter}
                        statusFilter={statusFilter}
                        climateOnly={climateOnly}
                        onClearAll={clearFilters}
                        onPickStatus={(s) => {
                            setStatusFilter(s);
                            setPage(1);
                        }}
                        onToggleClimate={() => setClimateOnly((v) => !v)}
                        onPickType={(t) => {
                            setTypeFilter(t);
                            setPage(1);
                        }}
                    />

                    <WarehousesTable
                        rows={displayedRows}
                        loading={isPending}
                        selected={selected}
                        onToggleOne={toggleOne}
                        onToggleAll={toggleAll}
                        onArchive={(id) => setArchiveTargetId(id)}
                        onDelete={(id) => setDeleteTargetId(id)}
                        onSetDefault={handleSetDefault}
                    />
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!archiveTargetId}
                onOpenChange={(o) => !o && setArchiveTargetId(null)}
                title={
                    archiveTarget?.archived
                        ? 'Restore this warehouse?'
                        : 'Archive this warehouse?'
                }
                description={
                    archiveTarget?.archived
                        ? `"${archiveTarget?.name}" will be restored to your active list.`
                        : `"${archiveTarget?.name}" will be hidden from default views. You can restore it later.`
                }
                confirmLabel={
                    archiveTarget?.archived ? 'Restore' : 'Archive'
                }
                confirmTone="primary"
                onConfirm={handleConfirmArchive}
            />

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this warehouse permanently?"
                description={`This permanently removes "${deleteTarget?.name}". The action cannot be undone and is blocked if the warehouse holds stock.`}
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
        </>
    );
}

export default WarehousesListClient;
