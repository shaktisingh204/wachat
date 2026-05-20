'use client';

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import { ObjectId } from 'mongodb';
import {
    Download,
    MoreHorizontal,
    Package,
    Plus,
    Trash2,
    X,
} from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCheckbox,
    ZoruDropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuSeparator,
    ZoruDropdownMenuTrigger,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruStatCard,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';

import {
    bulkProductAction,
    deleteCrmProduct,
    getCrmProductKpis,
    getCrmProducts,
    type CrmProductKpis,
} from '@/app/actions/crm-products.actions';
import type { CrmProduct } from '@/lib/definitions';

const PRODUCTS_PER_PAGE = 20;

const EMPTY_KPIS: CrmProductKpis = {
    total: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    avgMargin: 0,
    totalValue: 0,
};

type StockFilter = 'all' | 'inStock' | 'outOfStock' | 'lowStock';
type TypeFilter = 'all' | 'goods' | 'service';
type TrackFilter = 'all' | 'tracked' | 'untracked';

type ProductRow = CrmProduct & { _id: string | ObjectId };

function toIdString(id: unknown): string {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (typeof (id as { toString?: () => string }).toString === 'function') {
        return (id as { toString: () => string }).toString();
    }
    return String(id);
}

function formatCurrency(value: number, currency: string = 'INR'): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value || 0);
    } catch {
        return `${currency} ${(value || 0).toFixed(2)}`;
    }
}

function isLowStock(p: ProductRow): boolean {
    if (!p.isTrackInventory) return false;
    const items = p.inventory || [];
    for (const inv of items) {
        const rp = Number(inv?.reorderPoint ?? 0);
        const st = Number(inv?.stock ?? 0);
        if (rp > 0 && st <= rp) return true;
    }
    return false;
}

export default function ProductsPage() {
    const { toast } = useZoruToast();

    // List + KPIs
    const [products, setProducts] = React.useState<ProductRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<CrmProductKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [stockFilter, setStockFilter] = React.useState<StockFilter>('all');
    const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all');
    const [trackFilter, setTrackFilter] = React.useState<TrackFilter>('all');

    // Selection + dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkConfirm, setBulkConfirm] = React.useState<'delete' | null>(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ products: rows, total: count }, kpiData] = await Promise.all([
                getCrmProducts(page, PRODUCTS_PER_PAGE, search),
                getCrmProductKpis(),
            ]);
            setProducts(rows as ProductRow[]);
            setTotal(count);
            setKpis(kpiData ?? EMPTY_KPIS);
        });
    }, [page, search]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const displayedProducts = React.useMemo(() => {
        return products.filter((p) => {
            if (typeFilter !== 'all') {
                const t = p.itemType || 'goods';
                if (t !== typeFilter) return false;
            }
            if (trackFilter === 'tracked' && !p.isTrackInventory) return false;
            if (trackFilter === 'untracked' && p.isTrackInventory) return false;
            if (stockFilter !== 'all') {
                const ts = Number(p.totalStock ?? 0);
                if (stockFilter === 'inStock' && !(ts > 0 || !p.isTrackInventory)) return false;
                if (stockFilter === 'outOfStock' && !(p.isTrackInventory && ts <= 0)) return false;
                if (stockFilter === 'lowStock' && !isLowStock(p)) return false;
            }
            return true;
        });
    }, [products, typeFilter, trackFilter, stockFilter]);

    const hasActiveFilters =
        stockFilter !== 'all' ||
        typeFilter !== 'all' ||
        trackFilter !== 'all' ||
        !!search;

    const clearFilters = React.useCallback(() => {
        setStockFilter('all');
        setTypeFilter('all');
        setTrackFilter('all');
        setSearch('');
        setPage(1);
    }, []);

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
                all ? new Set(displayedProducts.map((p) => toIdString(p._id))) : new Set(),
            );
        },
        [displayedProducts],
    );

    const deleteTarget = React.useMemo(
        () => products.find((p) => toIdString(p._id) === deleteTargetId) ?? null,
        [products, deleteTargetId],
    );

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmProduct(deleteTargetId);
        if (res.success) {
            toast({ title: 'Product deleted' });
            fetchData();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, fetchData, toast]);

    const handleBulkDelete = React.useCallback(async () => {
        if (selected.size === 0) return;
        const res = await bulkProductAction(Array.from(selected), 'delete');
        if (res.success) {
            toast({
                title: `${res.processed ?? 0} product${res.processed === 1 ? '' : 's'} deleted`,
            });
            setSelected(new Set());
            fetchData();
        } else {
            toast({
                title: 'Bulk delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setBulkConfirm(null);
    }, [selected, fetchData, toast]);

    const exportRows = React.useCallback(
        async (format: 'csv' | 'xlsx') => {
            const rows =
                selected.size > 0
                    ? products.filter((p) => selected.has(toIdString(p._id)))
                    : displayedProducts;
            if (rows.length === 0) {
                toast({ title: 'Nothing to export' });
                return;
            }
            const header = [
                'Name',
                'SKU',
                'Type',
                'Cost Price',
                'Selling Price',
                'Currency',
                'Tracked',
                'Total Stock',
                'HSN/SAC',
                'Created At',
            ];
            const data = rows.map((p) => [
                p.name ?? '',
                p.sku ?? '',
                p.itemType ?? 'goods',
                Number(p.costPrice ?? 0),
                Number(p.sellingPrice ?? 0),
                p.currency ?? 'INR',
                p.isTrackInventory ? 'Yes' : 'No',
                Number(p.totalStock ?? 0),
                p.hsnSac ?? '',
                p.createdAt ? new Date(p.createdAt).toISOString() : '',
            ]);
            const date = new Date().toISOString().slice(0, 10);
            const filename = `products-${date}.${format}`;
            if (format === 'csv') {
                const esc = (v: unknown) =>
                    `"${String(v ?? '').replace(/"/g, '""')}"`;
                const csv = [
                    header.join(','),
                    ...data.map((r) => r.map(esc).join(',')),
                ].join('\n');
                triggerDownload(
                    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
                    filename,
                );
                return;
            }
            try {
                const xlsx = await import('xlsx');
                const ws = xlsx.utils.aoa_to_sheet([header, ...data]);
                const wb = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(wb, ws, 'Products');
                const buf = xlsx.write(wb, {
                    type: 'array',
                    bookType: 'xlsx',
                }) as ArrayBuffer;
                triggerDownload(
                    new Blob([buf], {
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    }),
                    filename,
                );
            } catch {
                toast({
                    title: 'Export failed',
                    description: 'Could not generate XLSX file.',
                    variant: 'destructive',
                });
            }
        },
        [selected, products, displayedProducts, toast],
    );

    const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
    const allSelectedOnPage =
        displayedProducts.length > 0 &&
        displayedProducts.every((p) => selected.has(toIdString(p._id)));

    return (
        <>
            <EntityListShell
                title="Products"
                subtitle="Catalog of goods and services used across deals, quotes and invoices."
                search={{
                    value: search,
                    onChange: handleSearch,
                    placeholder: 'Search name or SKU…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <ZoruDropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <ZoruButton variant="outline" size="sm">
                                    <Download className="h-4 w-4" /> Export
                                </ZoruButton>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                                <ZoruDropdownMenuItem onSelect={() => exportRows('csv')}>
                                    Export as CSV
                                </ZoruDropdownMenuItem>
                                <ZoruDropdownMenuItem onSelect={() => exportRows('xlsx')}>
                                    Export as XLSX
                                </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                        <ZoruButton asChild>
                            <Link href="/dashboard/crm/inventory/items/new">
                                <Plus className="h-4 w-4" /> New product
                            </Link>
                        </ZoruButton>
                    </div>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <ZoruSelect
                            value={stockFilter}
                            onValueChange={(v) => {
                                setStockFilter(v as StockFilter);
                                setPage(1);
                            }}
                        >
                            <ZoruSelectTrigger className="w-[160px]">
                                <ZoruSelectValue placeholder="Stock" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All stock</ZoruSelectItem>
                                <ZoruSelectItem value="inStock">In stock</ZoruSelectItem>
                                <ZoruSelectItem value="lowStock">Low stock</ZoruSelectItem>
                                <ZoruSelectItem value="outOfStock">Out of stock</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruSelect
                            value={typeFilter}
                            onValueChange={(v) => {
                                setTypeFilter(v as TypeFilter);
                                setPage(1);
                            }}
                        >
                            <ZoruSelectTrigger className="w-[150px]">
                                <ZoruSelectValue placeholder="Type" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All types</ZoruSelectItem>
                                <ZoruSelectItem value="goods">Goods</ZoruSelectItem>
                                <ZoruSelectItem value="service">Service</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruSelect
                            value={trackFilter}
                            onValueChange={(v) => {
                                setTrackFilter(v as TrackFilter);
                                setPage(1);
                            }}
                        >
                            <ZoruSelectTrigger className="w-[160px]">
                                <ZoruSelectValue placeholder="Tracking" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All tracking</ZoruSelectItem>
                                <ZoruSelectItem value="tracked">Tracked</ZoruSelectItem>
                                <ZoruSelectItem value="untracked">Untracked</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        {hasActiveFilters ? (
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                            >
                                <X className="h-4 w-4" /> Clear
                            </ZoruButton>
                        ) : null}
                    </div>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-[13px] text-zoru-ink">
                                <span className="font-medium">{selected.size}</span> selected
                            </div>
                            <div className="flex items-center gap-2">
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportRows('csv')}
                                >
                                    <Download className="h-4 w-4" /> Export CSV
                                </ZoruButton>
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportRows('xlsx')}
                                >
                                    <Download className="h-4 w-4" /> Export XLSX
                                </ZoruButton>
                                <ZoruButton
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setBulkConfirm('delete')}
                                >
                                    <Trash2 className="h-4 w-4" /> Delete
                                </ZoruButton>
                                <ZoruButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelected(new Set())}
                                >
                                    <X className="h-4 w-4" /> Clear
                                </ZoruButton>
                            </div>
                        </div>
                    ) : null
                }
                empty={
                    !isPending && displayedProducts.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Package className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No products found
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                {hasActiveFilters
                                    ? 'No products match the current filters.'
                                    : 'Start your catalog by adding the first product.'}
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/inventory/items/new">
                                    <Plus className="h-4 w-4" /> Add product
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isPending && products.length === 0}
                pagination={
                    products.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={PRODUCTS_PER_PAGE}
                            hasMore={page < totalPages}
                            total={total}
                            controlled={{ onChange: (next) => setPage(next.page) }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ZoruStatCard
                            label="Total products"
                            value={kpis.total.toLocaleString()}
                            icon={<Package />}
                        />
                        <ZoruStatCard
                            label="In stock"
                            value={kpis.inStock.toLocaleString()}
                        />
                        <ZoruStatCard
                            label="Low stock"
                            value={kpis.lowStock.toLocaleString()}
                            invertDelta
                        />
                        <ZoruStatCard
                            label="Inventory value"
                            value={formatCurrency(kpis.totalValue)}
                        />
                    </div>

                    {/* Table */}
                    <ZoruCard className="p-0">
                        <div className="overflow-x-auto rounded-lg">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                        <ZoruTableHead className="w-10">
                                            <ZoruCheckbox
                                                checked={allSelectedOnPage}
                                                onCheckedChange={(c) =>
                                                    handleToggleAll(Boolean(c))
                                                }
                                                aria-label="Select all"
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Name
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            SKU
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Type
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-right text-zoru-ink-muted">
                                            Cost
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-right text-zoru-ink-muted">
                                            Price
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-right text-zoru-ink-muted">
                                            Stock
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Status
                                        </ZoruTableHead>
                                        <ZoruTableHead className="w-10" />
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {displayedProducts.map((p) => {
                                        const id = toIdString(p._id);
                                        const low = isLowStock(p);
                                        const out =
                                            p.isTrackInventory &&
                                            Number(p.totalStock ?? 0) <= 0;
                                        return (
                                            <ZoruTableRow
                                                key={id}
                                                className="border-zoru-line"
                                                data-state={
                                                    selected.has(id) ? 'selected' : undefined
                                                }
                                            >
                                                <ZoruTableCell>
                                                    <ZoruCheckbox
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() =>
                                                            handleToggleOne(id)
                                                        }
                                                        aria-label={`Select ${p.name}`}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/inventory/items/${id}`}
                                                        label={p.name || 'Untitled product'}
                                                        subtitle={p.description?.slice(0, 60)}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {p.sku || '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {p.itemType === 'service'
                                                        ? 'Service'
                                                        : 'Goods'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right text-zoru-ink">
                                                    {formatCurrency(
                                                        Number(p.costPrice ?? 0),
                                                        p.currency,
                                                    )}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right text-zoru-ink">
                                                    {formatCurrency(
                                                        Number(p.sellingPrice ?? 0),
                                                        p.currency,
                                                    )}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right text-zoru-ink">
                                                    {p.isTrackInventory
                                                        ? Number(p.totalStock ?? 0).toLocaleString()
                                                        : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    {out ? (
                                                        <ZoruBadge variant="destructive">
                                                            Out of stock
                                                        </ZoruBadge>
                                                    ) : low ? (
                                                        <ZoruBadge variant="warning">
                                                            Low stock
                                                        </ZoruBadge>
                                                    ) : p.isTrackInventory ? (
                                                        <ZoruBadge variant="success">
                                                            In stock
                                                        </ZoruBadge>
                                                    ) : (
                                                        <ZoruBadge variant="ghost">
                                                            Untracked
                                                        </ZoruBadge>
                                                    )}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <ZoruDropdownMenu>
                                                        <ZoruDropdownMenuTrigger asChild>
                                                            <ZoruButton
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label="Row actions"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </ZoruButton>
                                                        </ZoruDropdownMenuTrigger>
                                                        <ZoruDropdownMenuContent align="end">
                                                            <ZoruDropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/dashboard/crm/inventory/items/${id}`}
                                                                >
                                                                    View
                                                                </Link>
                                                            </ZoruDropdownMenuItem>
                                                            <ZoruDropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/dashboard/crm/inventory/items/${id}/edit`}
                                                                >
                                                                    Edit
                                                                </Link>
                                                            </ZoruDropdownMenuItem>
                                                            <ZoruDropdownMenuSeparator />
                                                            <ZoruDropdownMenuItem
                                                                onSelect={() =>
                                                                    setDeleteTargetId(id)
                                                                }
                                                                className="text-zoru-danger"
                                                            >
                                                                Delete
                                                            </ZoruDropdownMenuItem>
                                                        </ZoruDropdownMenuContent>
                                                    </ZoruDropdownMenu>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })}
                                </ZoruTableBody>
                            </ZoruTable>
                        </div>
                    </ZoruCard>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this product?"
                description={`"${deleteTarget?.name ?? 'This product'}" will be permanently removed.`}
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
            <ConfirmDialog
                open={bulkConfirm === 'delete'}
                onOpenChange={(o) => !o && setBulkConfirm(null)}
                title={`Delete ${selected.size} product${selected.size === 1 ? '' : 's'}?`}
                description="These products will be permanently removed. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleBulkDelete}
            />
        </>
    );
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
