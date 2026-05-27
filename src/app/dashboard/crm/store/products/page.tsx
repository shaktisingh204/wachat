'use client';

/**
 * Products list — `/dashboard/crm/store/products`
 *
 * KPI strip (total, published/active, draft, low stock), filter (status,
 * category, storefront), bulk publish/archive/delete, export CSV.
 */

import * as React from 'react';
import Link from 'next/link';
import { Download, Package, Plus, Trash2 } from 'lucide-react';

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
    deleteProduct,
    getProductList,
    getStorefrontList,
    saveProduct,
} from '@/app/actions/crm-store.actions';

type ProductItem = Record<string, unknown>;
type StatusFilter = 'all' | 'active' | 'draft' | 'archived';

const LOW_STOCK_THRESHOLD = 5;

function statusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'archived') return 'danger';
    return 'ghost';
}

function pId(p: ProductItem): string {
    return String(p._id ?? '');
}
function pStatus(p: ProductItem): string {
    return String(p.status ?? 'draft');
}
function pInventory(p: ProductItem): number {
    const qty = p.inventoryQuantity ?? p.inventory_quantity ?? p.stock;
    return typeof qty === 'number' ? qty : parseInt(String(qty ?? '99'), 10) || 99;
}

export default function ProductListPage(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [items, setItems] = React.useState<ProductItem[]>([]);
    const [storefronts, setStorefronts] = React.useState<Array<{ id: string; name: string }>>([]);
    const [isPending, startTransition] = React.useTransition();
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [storefrontFilter, setStorefrontFilter] = React.useState('__all__');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ items: products }, { items: sfList }] = await Promise.all([
                getProductList(storefrontFilter === '__all__' ? undefined : storefrontFilter),
                getStorefrontList(),
            ]);
            setItems(Array.isArray(products) ? products : []);
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
        const total = items.length;
        const active = items.filter((p) => pStatus(p) === 'active').length;
        const draft = items.filter((p) => pStatus(p) === 'draft').length;
        const lowStock = items.filter(
            (p) => (p.inventoryTracked || p.inventory_tracked) && pInventory(p) < LOW_STOCK_THRESHOLD,
        ).length;
        return { total, active, draft, lowStock };
    }, [items]);

    const filtered = React.useMemo(() => {
        if (statusFilter === 'all') return items;
        return items.filter((p) => pStatus(p) === statusFilter);
    }, [items, statusFilter]);

    const allSelected =
        filtered.length > 0 && filtered.every((p) => selected.has(pId(p)));

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
            setSelected(all ? new Set(filtered.map(pId)) : new Set());
        },
        [filtered],
    );

    const handleBulkSetStatus = React.useCallback(
        async (nextStatus: 'active' | 'archived') => {
            let ok = 0;
            for (const id of Array.from(selected)) {
                const target = items.find((p) => pId(p) === id);
                if (!target) continue;
                const fd = new FormData();
                fd.set('productId', id);
                fd.set('status', nextStatus);
                // carry forward required fields
                fd.set('title', String(target.title ?? ''));
                fd.set('storefrontId', String(target.storefrontId ?? target.storefront_id ?? ''));
                const res = await saveProduct(undefined, fd);
                if (!res?.error) ok++;
            }
            toast({ title: `${ok} product(s) set to ${nextStatus}` });
            setSelected(new Set());
            fetchData();
        },
        [selected, items, fetchData, toast],
    );

    const handleBulkDelete = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await deleteProduct(id);
            if (res.ok) ok++;
        }
        toast({ title: `${ok} product(s) deleted` });
        setSelected(new Set());
        setBulkDeleteOpen(false);
        fetchData();
    }, [selected, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const rows = selected.size > 0 ? filtered.filter((p) => selected.has(pId(p))) : filtered;
        const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            'Title,SKU,Price,Currency,Inventory,Status',
            ...rows.map((p) =>
                [
                    escape(p.title),
                    escape(p.sku),
                    escape(p.price),
                    escape(p.currency ?? 'INR'),
                    escape(p.inventoryQuantity ?? p.inventory_quantity ?? ''),
                    escape(pStatus(p)),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filtered, selected]);

    const newHref = storefrontFilter !== '__all__'
        ? `/dashboard/crm/store/products/new?storefrontId=${storefrontFilter}`
        : '/dashboard/crm/store/products/new';

    return (
        <>
            <EntityListShell
                title="Products"
                subtitle="Catalog with images, pricing and inventory toggles."
                primaryAction={
                    <Button variant="outline" asChild>
                        <Link href={newHref}>
                            <Plus className="h-4 w-4" /> New product
                        </Link>
                    </Button>
                }
                filters={
                    <Card>
                        <ZoruCardContent className="flex flex-wrap items-end gap-3 pt-4">
                            <div className="min-w-[180px] space-y-1">
                                <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Storefront
                                </Label>
                                <Select value={storefrontFilter} onValueChange={setStorefrontFilter}>
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="All storefronts" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="__all__">All storefronts</ZoruSelectItem>
                                        {storefronts.map((sf) => (
                                            <ZoruSelectItem key={sf.id} value={sf.id}>
                                                {sf.name}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                            <div className="min-w-[160px] space-y-1">
                                <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Status
                                </Label>
                                <Select
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
                                </Select>
                            </div>
                        </ZoruCardContent>
                    </Card>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-zoru-ink">{selected.size} selected</span>
                            <span className="flex-1" />
                            <Button size="sm" variant="outline" onClick={() => handleBulkSetStatus('active')}>
                                Publish
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleBulkSetStatus('archived')}>
                                Archive
                            </Button>
                            <DropdownMenu>
                                <ZoruDropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline">
                                        <Download className="h-3.5 w-3.5" /> Export
                                    </Button>
                                </ZoruDropdownMenuTrigger>
                                <ZoruDropdownMenuContent align="end">
                                    <ZoruDropdownMenuItem onClick={exportCsv}>Export as CSV</ZoruDropdownMenuItem>
                                </ZoruDropdownMenuContent>
                            </DropdownMenu>
                            <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                                Clear
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending && items.length === 0}
                empty={
                    !isPending && filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-8">
                            <Package className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">No products found</h3>
                            <Button variant="outline" asChild>
                                <Link href={newHref}>
                                    <Plus className="h-4 w-4" /> New product
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Total products" value={kpis.total.toLocaleString()} icon={<Package />} />
                        <StatCard label="Published" value={kpis.active.toLocaleString()} icon={<Package />} period="active listings" />
                        <StatCard label="Draft" value={kpis.draft.toLocaleString()} icon={<Package />} period="not live" />
                        <StatCard
                            label="Low stock"
                            value={kpis.lowStock.toLocaleString()}
                            icon={<Package />}
                            period={`below ${LOW_STOCK_THRESHOLD} units`}
                        />
                    </div>

                    {filtered.length > 0 ? (
                        <Card className="overflow-hidden p-0">
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow>
                                        <ZoruTableHead className="w-10">
                                            <Checkbox
                                                aria-label="Select all"
                                                checked={allSelected}
                                                onCheckedChange={(c) => toggleAll(c === true)}
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead>Title</ZoruTableHead>
                                        <ZoruTableHead>SKU</ZoruTableHead>
                                        <ZoruTableHead>Price</ZoruTableHead>
                                        <ZoruTableHead>Inventory</ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {filtered.map((p) => {
                                        const id = pId(p);
                                        const status = pStatus(p);
                                        return (
                                            <ZoruTableRow
                                                key={id}
                                                data-state={selected.has(id) ? 'selected' : undefined}
                                            >
                                                <ZoruTableCell>
                                                    <Checkbox
                                                        aria-label={`Select ${String(p.title ?? '')}`}
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() => toggleOne(id)}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/store/products/${id}`}
                                                        label={String(p.title ?? 'Untitled product')}
                                                        subtitle={String(p.sku ?? '')}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {String(p.sku ?? '—')}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {typeof p.price === 'number'
                                                        ? `${String(p.currency ?? 'INR')} ${(p.price as number).toFixed(2)}`
                                                        : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {p.inventoryTracked || p.inventory_tracked
                                                        ? String(p.inventoryQuantity ?? p.inventory_quantity ?? 0)
                                                        : 'Untracked'}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge variant={statusVariant(status)}>{status}</Badge>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })}
                                </ZoruTableBody>
                            </Table>
                        </Card>
                    ) : null}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Delete ${selected.size} product${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected products. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleBulkDelete}
            />
        </>
    );
}
