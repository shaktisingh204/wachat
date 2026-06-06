'use client';

/**
 * Store orders list — `/dashboard/crm/store/orders`
 *
 * KPI strip (total, pending, fulfilled, cancelled, revenue), filter
 * (status, date range, storefront), bulk fulfill/cancel/delete, export CSV.
 */

import * as React from 'react';
import Link from 'next/link';
import { Download, ShoppingBag, Trash2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import {
    Badge,
    Button,
    Card,
    ZoruCardContent,
    Checkbox,
    ZoruDateRangePicker,
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
} from '@/components/sabcrm/20ui/compat';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    cancelOrder,
    getStorefrontList,
    getStoreOrders,
    markOrderFulfilled,
} from '@/app/actions/crm-store.actions';

type OrderItem = Record<string, unknown>;
type StatusFilter = 'all' | 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded';

function statusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'paid' || s === 'fulfilled') return 'success';
    if (s === 'pending' || s === 'awaiting_fulfillment') return 'warning';
    if (s === 'cancelled' || s === 'refunded') return 'danger';
    return 'ghost';
}

function fmtMoney(n: unknown, currency = 'INR'): string {
    const num = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
    if (Number.isNaN(num)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(num);
    } catch {
        return `${currency} ${num}`;
    }
}

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string | number | Date);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function oId(o: OrderItem): string {
    return String(o._id ?? '');
}
function oStatus(o: OrderItem): string {
    return String(o.status ?? 'pending');
}
function oTotal(o: OrderItem): number {
    const t =
        (o.totals as Record<string, unknown> | null)?.total ??
        o.total ??
        0;
    return typeof t === 'number' ? t : parseFloat(String(t)) || 0;
}

export default function StoreOrdersPage(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [items, setItems] = React.useState<OrderItem[]>([]);
    const [storefronts, setStorefronts] = React.useState<Array<{ id: string; name: string }>>([]);
    const [isPending, startTransition] = React.useTransition();
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [storefrontFilter, setStorefrontFilter] = React.useState('__all__');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ items: orders }, { items: sfList }] = await Promise.all([
                getStoreOrders(storefrontFilter === '__all__' ? undefined : storefrontFilter),
                getStorefrontList(),
            ]);
            setItems(Array.isArray(orders) ? orders : []);
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
        const pending = items.filter((o) => ['pending', 'awaiting_fulfillment'].includes(oStatus(o))).length;
        const fulfilled = items.filter((o) => oStatus(o) === 'fulfilled').length;
        const cancelled = items.filter((o) => ['cancelled', 'refunded'].includes(oStatus(o))).length;
        const revenue = items
            .filter((o) => ['paid', 'fulfilled'].includes(oStatus(o)))
            .reduce((sum, o) => sum + oTotal(o), 0);
        return { total, pending, fulfilled, cancelled, revenue };
    }, [items]);

    const filtered = React.useMemo(() => {
        return items.filter((o) => {
            if (statusFilter !== 'all' && oStatus(o) !== statusFilter) return false;
            if (dateRange?.from || dateRange?.to) {
                const d = new Date(o.createdAt as string | Date | null ?? '');
                if (Number.isNaN(d.getTime())) return false;
                if (dateRange.from && d < dateRange.from) return false;
                if (dateRange.to && d > dateRange.to) return false;
            }
            return true;
        });
    }, [items, statusFilter, dateRange]);

    const allSelected =
        filtered.length > 0 && filtered.every((o) => selected.has(oId(o)));

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
            setSelected(all ? new Set(filtered.map(oId)) : new Set());
        },
        [filtered],
    );

    const handleBulkFulfill = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await markOrderFulfilled(id);
            if (res.ok) ok++;
        }
        toast({ title: `${ok} order(s) fulfilled` });
        setSelected(new Set());
        fetchData();
    }, [selected, fetchData, toast]);

    const handleBulkCancel = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await cancelOrder(id);
            if (res.ok) ok++;
        }
        toast({ title: `${ok} order(s) cancelled` });
        setSelected(new Set());
        fetchData();
    }, [selected, fetchData, toast]);

    // Bulk delete uses cancel as a soft-delete equivalent
    const handleBulkDelete = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await cancelOrder(id);
            if (res.ok) ok++;
        }
        toast({ title: `${ok} order(s) cancelled/removed` });
        setSelected(new Set());
        setBulkDeleteOpen(false);
        fetchData();
    }, [selected, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const rows = selected.size > 0 ? filtered.filter((o) => selected.has(oId(o))) : filtered;
        const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            'OrderNo,Customer,Total,Currency,Placed,Status',
            ...rows.map((o) => {
                const orderNo = String((o as Record<string, unknown>).orderNo ?? `#${oId(o).slice(-6)}`);
                return [
                    escape(orderNo),
                    escape(o.customerEmail ?? o.customerName),
                    escape(oTotal(o).toFixed(2)),
                    escape(o.currency ?? 'INR'),
                    escape(fmtDate(o.createdAt)),
                    escape(oStatus(o)),
                ].join(',');
            }),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filtered, selected]);

    const hasActiveFilters = statusFilter !== 'all' || !!dateRange?.from || !!dateRange?.to;

    return (
        <>
            <EntityListShell
                title="Store orders"
                subtitle="Orders captured from the storefront — payment and fulfillment state."
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
                                        <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                                        <ZoruSelectItem value="paid">Paid</ZoruSelectItem>
                                        <ZoruSelectItem value="fulfilled">Fulfilled</ZoruSelectItem>
                                        <ZoruSelectItem value="cancelled">Cancelled</ZoruSelectItem>
                                        <ZoruSelectItem value="refunded">Refunded</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                            <div className="min-w-[220px] space-y-1">
                                <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Date placed
                                </Label>
                                <ZoruDateRangePicker value={dateRange} onChange={setDateRange} />
                            </div>
                            {hasActiveFilters ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStatusFilter('all');
                                        setDateRange(undefined);
                                    }}
                                >
                                    Clear filters
                                </Button>
                            ) : null}
                        </ZoruCardContent>
                    </Card>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-zoru-ink">{selected.size} selected</span>
                            <span className="flex-1" />
                            <Button size="sm" variant="outline" onClick={handleBulkFulfill}>
                                Fulfill
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleBulkCancel}>
                                Cancel
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
                            <ShoppingBag className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">No orders found</h3>
                        </div>
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <StatCard label="Total orders" value={kpis.total.toLocaleString()} icon={<ShoppingBag />} />
                        <StatCard label="Pending" value={kpis.pending.toLocaleString()} icon={<ShoppingBag />} period="awaiting action" />
                        <StatCard label="Fulfilled" value={kpis.fulfilled.toLocaleString()} icon={<ShoppingBag />} period="shipped" />
                        <StatCard label="Cancelled" value={kpis.cancelled.toLocaleString()} icon={<ShoppingBag />} period="cancelled / refunded" />
                        <StatCard
                            label="Revenue"
                            value={fmtMoney(kpis.revenue)}
                            icon={<ShoppingBag />}
                            period="paid + fulfilled"
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
                                        <ZoruTableHead>Order #</ZoruTableHead>
                                        <ZoruTableHead>Customer</ZoruTableHead>
                                        <ZoruTableHead>Total</ZoruTableHead>
                                        <ZoruTableHead>Placed</ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {filtered.map((o) => {
                                        const id = oId(o);
                                        const status = oStatus(o);
                                        const orderNo = String((o as Record<string, unknown>).orderNo ?? `#${id.slice(-6)}`);
                                        return (
                                            <ZoruTableRow
                                                key={id}
                                                data-state={selected.has(id) ? 'selected' : undefined}
                                            >
                                                <ZoruTableCell>
                                                    <Checkbox
                                                        aria-label={`Select ${orderNo}`}
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() => toggleOne(id)}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    <Link
                                                        href={`/dashboard/crm/store/orders/${id}`}
                                                        className="hover:underline"
                                                    >
                                                        {orderNo}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {String(o.customerEmail ?? o.customerName ?? '—')}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtMoney(oTotal(o), String(o.currency ?? 'INR'))}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                                    {fmtDate(o.createdAt)}
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
                title={`Cancel/delete ${selected.size} order${selected.size === 1 ? '' : 's'}?`}
                description="Selected orders will be cancelled. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Confirm"
                onConfirm={handleBulkDelete}
            />
        </>
    );
}
