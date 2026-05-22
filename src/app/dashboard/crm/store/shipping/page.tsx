'use client';

/**
 * Shipping zones list — `/dashboard/crm/store/shipping`
 *
 * KPI strip (total methods, active, free-shipping rules), filter
 * (status, zone/storefront), bulk activate/delete, export CSV,
 * RowDrawer on name.
 */

import * as React from 'react';
import Link from 'next/link';
import { Download, Plus, Trash2, Truck } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    ZoruCardContent,
    Checkbox,
    DropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuTrigger,
    Label,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    StatCard,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { RowDrawer } from '@/components/crm/row-drawer';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    deleteShippingZone,
    getShippingZoneList,
    getStorefrontList,
    saveShippingZone,
} from '@/app/actions/crm-store.actions';

type ZoneItem = Record<string, unknown>;
type StatusFilter = 'all' | 'active' | 'draft' | 'archived';

function statusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'archived') return 'danger';
    return 'ghost';
}

function zId(z: ZoneItem): string {
    return String(z._id ?? '');
}
function zStatus(z: ZoneItem): string {
    return String(z.status ?? 'draft');
}
function zMethods(z: ZoneItem): unknown[] {
    return Array.isArray(z.methods) ? (z.methods as unknown[]) : [];
}
function zCountries(z: ZoneItem): string[] {
    return Array.isArray(z.countries)
        ? (z.countries as unknown[]).map((c) => String(c))
        : [];
}
function hasFreeShipping(z: ZoneItem): boolean {
    return zMethods(z).some((m) => {
        const method = m as Record<string, unknown>;
        return (
            String(method.kind ?? method.type ?? '').toLowerCase().includes('free') ||
            (typeof method.rate === 'number' && method.rate === 0)
        );
    });
}

export default function ShippingZoneListPage(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [items, setItems] = React.useState<ZoneItem[]>([]);
    const [storefronts, setStorefronts] = React.useState<Array<{ id: string; name: string }>>([]);
    const [isPending, startTransition] = React.useTransition();
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [storefrontFilter, setStorefrontFilter] = React.useState('');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ items: zones }, { items: sfList }] = await Promise.all([
                getShippingZoneList(storefrontFilter || undefined),
                getStorefrontList(),
            ]);
            setItems(Array.isArray(zones) ? zones : []);
            setStorefronts(
                (Array.isArray(sfList) ? sfList : []).map((sf) => ({
                    id: String((sf as Record<string, unknown>)._id ?? ''),
                    name: String((sf as Record<string, unknown>).name ?? 'Untitled'),
                })),
            );
        });
    }, [storefrontFilter]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const kpis = React.useMemo(() => {
        const totalZones = items.length;
        const active = items.filter((z) => zStatus(z) === 'active').length;
        const totalMethods = items.reduce((sum, z) => sum + zMethods(z).length, 0);
        const freeShipping = items.filter(hasFreeShipping).length;
        return { totalZones, active, totalMethods, freeShipping };
    }, [items]);

    const filtered = React.useMemo(() => {
        if (statusFilter === 'all') return items;
        return items.filter((z) => zStatus(z) === statusFilter);
    }, [items, statusFilter]);

    const allSelected =
        filtered.length > 0 && filtered.every((z) => selected.has(zId(z)));

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
            setSelected(all ? new Set(filtered.map(zId)) : new Set());
        },
        [filtered],
    );

    const handleBulkActivate = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const target = items.find((z) => zId(z) === id);
            if (!target) continue;
            const fd = new FormData();
            fd.set('zoneId', id);
            fd.set('status', 'active');
            fd.set('name', String(target.name ?? ''));
            fd.set('storefrontId', String(target.storefrontId ?? target.storefront_id ?? ''));
            const res = await saveShippingZone(undefined, fd);
            if (!res?.error) ok++;
        }
        toast({ title: `${ok} zone(s) activated` });
        setSelected(new Set());
        fetchData();
    }, [selected, items, fetchData, toast]);

    const handleBulkDelete = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await deleteShippingZone(id);
            if (res.ok) ok++;
        }
        toast({ title: `${ok} zone(s) deleted` });
        setSelected(new Set());
        setBulkDeleteOpen(false);
        fetchData();
    }, [selected, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const rows = selected.size > 0 ? filtered.filter((z) => selected.has(zId(z))) : filtered;
        const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            'Name,Countries,Methods,HasFreeShipping,Status',
            ...rows.map((z) => {
                const countries = zCountries(z);
                return [
                    escape(z.name),
                    escape(countries.join('; ')),
                    escape(zMethods(z).length),
                    escape(hasFreeShipping(z) ? 'Yes' : 'No'),
                    escape(zStatus(z)),
                ].join(',');
            }),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shipping-zones-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filtered, selected]);

    const newHref = storefrontFilter
        ? `/dashboard/crm/store/shipping/new?storefrontId=${storefrontFilter}`
        : '/dashboard/crm/store/shipping/new';

    const hasActiveFilters = statusFilter !== 'all';

    return (
        <>
            <EntityListShell
                title="Shipping zones"
                subtitle="Country / state coverage with per-method rates."
                primaryAction={
                    <ZoruButton variant="outline" asChild>
                        <Link href={newHref}>
                            <Plus className="h-4 w-4" /> New zone
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <ZoruCard>
                        <ZoruCardContent className="flex flex-wrap items-end gap-3 pt-4">
                            <div className="min-w-[180px] space-y-1">
                                <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Storefront
                                </ZoruLabel>
                                <ZoruSelect value={storefrontFilter} onValueChange={setStorefrontFilter}>
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="All storefronts" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="">All storefronts</ZoruSelectItem>
                                        {storefronts.map((sf) => (
                                            <ZoruSelectItem key={sf.id} value={sf.id}>
                                                {sf.name}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="min-w-[160px] space-y-1">
                                <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Status
                                </ZoruLabel>
                                <ZoruSelect
                                    value={statusFilter}
                                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="All" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="all">All</ZoruSelectItem>
                                        <ZoruSelectItem value="active">Active</ZoruSelectItem>
                                        <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                                        <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            {hasActiveFilters ? (
                                <ZoruButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setStatusFilter('all')}
                                >
                                    Clear filters
                                </ZoruButton>
                            ) : null}
                        </ZoruCardContent>
                    </ZoruCard>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-zoru-ink">{selected.size} selected</span>
                            <span className="flex-1" />
                            <ZoruButton size="sm" variant="outline" onClick={handleBulkActivate}>
                                Activate
                            </ZoruButton>
                            <ZoruDropdownMenu>
                                <ZoruDropdownMenuTrigger asChild>
                                    <ZoruButton size="sm" variant="outline">
                                        <Download className="h-3.5 w-3.5" /> Export
                                    </ZoruButton>
                                </ZoruDropdownMenuTrigger>
                                <ZoruDropdownMenuContent align="end">
                                    <ZoruDropdownMenuItem onClick={exportCsv}>Export as CSV</ZoruDropdownMenuItem>
                                </ZoruDropdownMenuContent>
                            </ZoruDropdownMenu>
                            <ZoruButton size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </ZoruButton>
                            <ZoruButton size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                                Clear
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isPending && items.length === 0}
                empty={
                    !isPending && filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-8">
                            <Truck className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">No shipping zones found</h3>
                            <ZoruButton variant="outline" asChild>
                                <Link href={newHref}>
                                    <Plus className="h-4 w-4" /> New zone
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ZoruStatCard label="Total zones" value={kpis.totalZones.toLocaleString()} icon={<Truck />} />
                        <ZoruStatCard label="Active" value={kpis.active.toLocaleString()} icon={<Truck />} period="enabled zones" />
                        <ZoruStatCard label="Total methods" value={kpis.totalMethods.toLocaleString()} icon={<Truck />} period="across all zones" />
                        <ZoruStatCard
                            label="Free-shipping zones"
                            value={kpis.freeShipping.toLocaleString()}
                            icon={<Truck />}
                            period="with $0 method"
                        />
                    </div>

                    {filtered.length > 0 ? (
                        <ZoruCard className="overflow-hidden p-0">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow>
                                        <ZoruTableHead className="w-10">
                                            <ZoruCheckbox
                                                aria-label="Select all"
                                                checked={allSelected}
                                                onCheckedChange={(c) => toggleAll(c === true)}
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead>Name</ZoruTableHead>
                                        <ZoruTableHead>Countries</ZoruTableHead>
                                        <ZoruTableHead>Methods</ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {filtered.map((z) => {
                                        const id = zId(z);
                                        const status = zStatus(z);
                                        const countries = zCountries(z);
                                        const methodCount = zMethods(z).length;
                                        return (
                                            <ZoruTableRow
                                                key={id}
                                                data-state={selected.has(id) ? 'selected' : undefined}
                                            >
                                                <ZoruTableCell>
                                                    <ZoruCheckbox
                                                        aria-label={`Select ${String(z.name ?? '')}`}
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() => toggleOne(id)}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <RowDrawer
                                                        label={String(z.name ?? 'Untitled')}
                                                        subtitle={
                                                            countries.length > 0
                                                                ? `${countries.length} countr${countries.length === 1 ? 'y' : 'ies'}`
                                                                : undefined
                                                        }
                                                        title={`Zone: ${String(z.name ?? '')}`}
                                                        description="View and edit this shipping zone's coverage and methods."
                                                    >
                                                        <EntityRowLink
                                                            href={`/dashboard/crm/store/shipping/${id}`}
                                                            label={String(z.name ?? 'Untitled')}
                                                        />
                                                    </RowDrawer>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {countries.length > 0 ? countries.join(', ') : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {methodCount}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })}
                                </ZoruTableBody>
                            </ZoruTable>
                        </ZoruCard>
                    ) : null}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Delete ${selected.size} zone${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected shipping zones. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleBulkDelete}
            />
        </>
    );
}
