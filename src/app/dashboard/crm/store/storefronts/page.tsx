'use client';

/**
 * Storefronts list — `/dashboard/crm/store/storefronts`
 *
 * KPI strip (total, published, draft, total products), filter (status),
 * bulk publish/archive/delete, export CSV.
 */

import * as React from 'react';
import Link from 'next/link';
import {
    Download,
    Globe,
    Package,
    Plus,
    Store,
    Trash2,
} from 'lucide-react';

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
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    deleteStorefront,
    getProductList,
    getStorefrontList,
    publishStorefront,
    unpublishStorefront,
} from '@/app/actions/crm-store.actions';

type StorefrontItem = Record<string, unknown>;
type StatusFilter = 'all' | 'published' | 'draft' | 'archived';

function statusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'published') return 'success';
    if (s === 'archived') return 'danger';
    return 'ghost';
}

function sfId(sf: StorefrontItem): string {
    return String(sf._id ?? '');
}
function sfStatus(sf: StorefrontItem): string {
    return String(sf.status ?? 'draft');
}

export default function StorefrontListPage(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [items, setItems] = React.useState<StorefrontItem[]>([]);
    const [productCount, setProductCount] = React.useState(0);
    const [isPending, startTransition] = React.useTransition();
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ items: storefronts }, { items: products }] = await Promise.all([
                getStorefrontList(),
                getProductList(),
            ]);
            setItems(Array.isArray(storefronts) ? storefronts : []);
            setProductCount(Array.isArray(products) ? products.length : 0);
        });
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const kpis = React.useMemo(() => {
        const total = items.length;
        const published = items.filter((sf) => sfStatus(sf) === 'published').length;
        const draft = items.filter((sf) => sfStatus(sf) === 'draft').length;
        return { total, published, draft, products: productCount };
    }, [items, productCount]);

    const filtered = React.useMemo(() => {
        if (statusFilter === 'all') return items;
        return items.filter((sf) => sfStatus(sf) === statusFilter);
    }, [items, statusFilter]);

    const allSelected =
        filtered.length > 0 && filtered.every((sf) => selected.has(sfId(sf)));

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
            setSelected(all ? new Set(filtered.map(sfId)) : new Set());
        },
        [filtered],
    );

    const handleBulkPublish = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await publishStorefront(id);
            if (res.ok) ok++;
        }
        toast({ title: `${ok} storefront(s) published` });
        setSelected(new Set());
        fetchData();
    }, [selected, fetchData, toast]);

    const handleBulkArchive = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await unpublishStorefront(id);
            if (res.ok) ok++;
        }
        toast({ title: `${ok} storefront(s) archived` });
        setSelected(new Set());
        fetchData();
    }, [selected, fetchData, toast]);

    const handleBulkDelete = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await deleteStorefront(id);
            if (res.ok) ok++;
        }
        toast({ title: `${ok} storefront(s) deleted` });
        setSelected(new Set());
        setBulkDeleteOpen(false);
        fetchData();
    }, [selected, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const rows = selected.size > 0 ? filtered.filter((sf) => selected.has(sfId(sf))) : filtered;
        const header = ['Name', 'Slug', 'Domain', 'Currency', 'Status'];
        const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...rows.map((sf) =>
                [
                    escape(sf.name),
                    escape(sf.slug),
                    escape(sf.domain),
                    escape(sf.currency ?? 'INR'),
                    escape(sfStatus(sf)),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `storefronts-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filtered, selected]);

    return (
        <>
            <EntityListShell
                title="Storefronts"
                subtitle="Manage online stores, custom domains and homepage layout."
                primaryAction={
                    <ZoruButton variant="outline" asChild>
                        <Link href="/dashboard/crm/store/storefronts/new">
                            <Plus className="h-4 w-4" /> New storefront
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <ZoruCard>
                        <ZoruCardContent className="flex flex-wrap items-end gap-3 pt-4">
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
                                        <ZoruSelectItem value="published">Published</ZoruSelectItem>
                                        <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                                        <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-zoru-ink">
                                {selected.size} selected
                            </span>
                            <span className="flex-1" />
                            <ZoruButton size="sm" variant="outline" onClick={handleBulkPublish}>
                                Publish
                            </ZoruButton>
                            <ZoruButton size="sm" variant="outline" onClick={handleBulkArchive}>
                                Archive
                            </ZoruButton>
                            <ZoruDropdownMenu>
                                <ZoruDropdownMenuTrigger asChild>
                                    <ZoruButton size="sm" variant="outline">
                                        <Download className="h-3.5 w-3.5" /> Export
                                    </ZoruButton>
                                </ZoruDropdownMenuTrigger>
                                <ZoruDropdownMenuContent align="end">
                                    <ZoruDropdownMenuItem onClick={exportCsv}>
                                        Export as CSV
                                    </ZoruDropdownMenuItem>
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
                            <Store className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                {statusFilter !== 'all' ? 'No storefronts match this filter' : 'No storefronts yet'}
                            </h3>
                            <ZoruButton variant="outline" asChild>
                                <Link href="/dashboard/crm/store/storefronts/new">
                                    <Plus className="h-4 w-4" /> New storefront
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ZoruStatCard label="Total storefronts" value={kpis.total.toLocaleString()} icon={<Store />} />
                        <ZoruStatCard label="Published" value={kpis.published.toLocaleString()} icon={<Globe />} period="live stores" />
                        <ZoruStatCard label="Draft" value={kpis.draft.toLocaleString()} icon={<Store />} period="not published" />
                        <ZoruStatCard label="Total products" value={kpis.products.toLocaleString()} icon={<Package />} period="across all stores" />
                    </div>

                    {/* Table */}
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
                                        <ZoruTableHead>Slug</ZoruTableHead>
                                        <ZoruTableHead>Domain</ZoruTableHead>
                                        <ZoruTableHead>Currency</ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {filtered.map((sf) => {
                                        const id = sfId(sf);
                                        const status = sfStatus(sf);
                                        return (
                                            <ZoruTableRow
                                                key={id}
                                                data-state={selected.has(id) ? 'selected' : undefined}
                                            >
                                                <ZoruTableCell>
                                                    <ZoruCheckbox
                                                        aria-label={`Select ${String(sf.name ?? '')}`}
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() => toggleOne(id)}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/store/storefronts/${id}`}
                                                        label={String(sf.name ?? 'Untitled')}
                                                        subtitle={String(sf.slug ?? '')}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {String(sf.slug ?? '—')}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {String(sf.domain ?? '—')}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {String(sf.currency ?? 'INR')}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <ZoruBadge variant={statusVariant(status)}>
                                                        {status}
                                                    </ZoruBadge>
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
                title={`Delete ${selected.size} storefront${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected storefronts and their associated data. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleBulkDelete}
            />
        </>
    );
}
