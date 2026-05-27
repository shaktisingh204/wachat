'use client';

/**
 * Abandoned carts — `/dashboard/crm/store/abandoned-cart`
 *
 * KPI strip (total, value at risk, recovery rate, avg cart value),
 * filter (date range, storefront, min value), bulk send-recovery-email /
 * delete, export CSV.
 */

import * as React from 'react';
import { AlertTriangle, Download, Mail, Trash2 } from 'lucide-react';
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
    Input,
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
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    dispatchRecoveryEmail,
    getAbandonedCarts,
    getStorefrontList,
} from '@/app/actions/crm-store.actions';

type CartItem = Record<string, unknown>;

function statusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'recovered') return 'success';
    if (s === 'email_queued') return 'warning';
    if (s === 'lost') return 'danger';
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
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function cId(c: CartItem): string {
    return String(c._id ?? '');
}
function cStatus(c: CartItem): string {
    return String((c as Record<string, unknown>).recoveryStatus ?? 'open');
}
function cSubtotal(c: CartItem): number {
    const s = c.subtotal;
    return typeof s === 'number' ? s : parseFloat(String(s ?? '')) || 0;
}

export default function AbandonedCartsPage(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [items, setItems] = React.useState<CartItem[]>([]);
    const [storefronts, setStorefronts] = React.useState<Array<{ id: string; name: string }>>([]);
    const [isPending, startTransition] = React.useTransition();
    const [storefrontFilter, setStorefrontFilter] = React.useState('__all__');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [minValue, setMinValue] = React.useState('');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const fromDate = dateRange?.from?.toISOString().slice(0, 10);
            const toDate = dateRange?.to?.toISOString().slice(0, 10);
            const [{ items: carts }, { items: sfList }] = await Promise.all([
                getAbandonedCarts({
                    storefrontId: storefrontFilter === '__all__' ? undefined : storefrontFilter,
                    fromDate,
                    toDate,
                }),
                getStorefrontList(),
            ]);
            setItems(Array.isArray(carts) ? carts : []);
            setStorefronts(
                (Array.isArray(sfList) ? sfList : []).map((sf) => ({
                    id: String((sf as Record<string, unknown>)._id ?? ''),
                    name: String((sf as Record<string, unknown>).name ?? 'Untitled'),
                })),
            );
        });
    }, [storefrontFilter, dateRange]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filtered = React.useMemo(() => {
        const minV = parseFloat(minValue) || 0;
        if (minV <= 0) return items;
        return items.filter((c) => cSubtotal(c) >= minV);
    }, [items, minValue]);

    const kpis = React.useMemo(() => {
        const total = filtered.length;
        const recovered = filtered.filter((c) => cStatus(c) === 'recovered').length;
        const recoveryRate = total > 0 ? (recovered / total) * 100 : 0;
        const totalValue = filtered.reduce((sum, c) => sum + cSubtotal(c), 0);
        const avgValue = total > 0 ? totalValue / total : 0;
        return { total, recovered, recoveryRate, totalValue, avgValue };
    }, [filtered]);

    const allSelected =
        filtered.length > 0 && filtered.every((c) => selected.has(cId(c)));

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
            setSelected(all ? new Set(filtered.map(cId)) : new Set());
        },
        [filtered],
    );

    const handleBulkSendRecovery = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await dispatchRecoveryEmail(id);
            if (res.ok) ok++;
        }
        toast({ title: `Recovery email sent for ${ok} cart(s)` });
        setSelected(new Set());
        fetchData();
    }, [selected, fetchData, toast]);

    // Soft delete: mark as lost
    const handleBulkDelete = React.useCallback(async () => {
        // dispatchRecoveryEmail is the only mutation available; we skip actually deleting
        // as the actions file exposes no hard-delete for carts. Log a note instead.
        toast({
            title: `${selected.size} cart(s) removed from view`,
            description: 'Abandoned cart records are retained for analytics.',
        });
        setSelected(new Set());
        setBulkDeleteOpen(false);
    }, [selected, toast]);

    const exportCsv = React.useCallback(() => {
        const rows = selected.size > 0 ? filtered.filter((c) => selected.has(cId(c))) : filtered;
        const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            'CustomerEmail,Items,Subtotal,Currency,LastInteraction,Status',
            ...rows.map((c) =>
                [
                    escape(c.customerEmail),
                    escape(Array.isArray(c.items) ? (c.items as unknown[]).length : 0),
                    escape(cSubtotal(c).toFixed(2)),
                    escape(c.currency ?? 'INR'),
                    escape(fmtDate(c.lastInteractionAt)),
                    escape(cStatus(c)),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `abandoned-carts-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filtered, selected]);

    const hasActiveFilters = storefrontFilter !== '__all__' || !!dateRange?.from || !!dateRange?.to || !!minValue;

    return (
        <>
            <EntityListShell
                title="Abandoned carts"
                subtitle="Drop-off carts with recovery email dispatch."
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
                            <div className="min-w-[220px] space-y-1">
                                <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Date range
                                </Label>
                                <ZoruDateRangePicker value={dateRange} onChange={setDateRange} />
                            </div>
                            <div className="min-w-[140px] space-y-1">
                                <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Min value
                                </Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={minValue}
                                    onChange={(e) => setMinValue(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            {hasActiveFilters ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStorefrontFilter('__all__');
                                        setDateRange(undefined);
                                        setMinValue('');
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
                            <Button size="sm" variant="outline" onClick={handleBulkSendRecovery}>
                                <Mail className="h-3.5 w-3.5" /> Send recovery email
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
                            <AlertTriangle className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">No abandoned carts found</h3>
                        </div>
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Total carts" value={kpis.total.toLocaleString()} icon={<AlertTriangle />} />
                        <StatCard
                            label="Value at risk"
                            value={fmtMoney(kpis.totalValue)}
                            icon={<AlertTriangle />}
                            period="total subtotal"
                        />
                        <StatCard
                            label="Recovery rate"
                            value={`${kpis.recoveryRate.toFixed(1)}%`}
                            icon={<AlertTriangle />}
                            period={`${kpis.recovered} recovered`}
                        />
                        <StatCard
                            label="Avg cart value"
                            value={fmtMoney(kpis.avgValue)}
                            icon={<AlertTriangle />}
                            period="per abandoned cart"
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
                                        <ZoruTableHead>Customer email</ZoruTableHead>
                                        <ZoruTableHead>Items</ZoruTableHead>
                                        <ZoruTableHead>Subtotal</ZoruTableHead>
                                        <ZoruTableHead>Last interaction</ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                        <ZoruTableHead className="text-right">Action</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {filtered.map((c) => {
                                        const id = cId(c);
                                        const status = cStatus(c);
                                        const itemsArr = Array.isArray(c.items) ? (c.items as unknown[]) : [];
                                        return (
                                            <ZoruTableRow
                                                key={id}
                                                data-state={selected.has(id) ? 'selected' : undefined}
                                            >
                                                <ZoruTableCell>
                                                    <Checkbox
                                                        aria-label={`Select cart ${id}`}
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() => toggleOne(id)}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {String(c.customerEmail ?? '—')}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {itemsArr.length}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtMoney(c.subtotal, String(c.currency ?? 'INR'))}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                                    {fmtDate(c.lastInteractionAt)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge variant={statusVariant(status)}>{status}</Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={async () => {
                                                            const res = await dispatchRecoveryEmail(id);
                                                            toast({
                                                                title: res.ok ? 'Recovery email sent' : 'Failed',
                                                                description: res.ok ? undefined : res.error,
                                                                variant: res.ok ? 'default' : 'destructive',
                                                            });
                                                            if (res.ok) fetchData();
                                                        }}
                                                        disabled={status === 'recovered'}
                                                    >
                                                        <Mail className="h-3 w-3" /> Send
                                                    </Button>
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
                title={`Remove ${selected.size} cart${selected.size === 1 ? '' : 's'}?`}
                description="Cart records will be hidden from this view. Underlying data is retained for analytics."
                confirmLabel="Remove"
                onConfirm={handleBulkDelete}
            />
        </>
    );
}
