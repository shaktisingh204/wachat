'use client';

import { Button, Card, CardBody, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
    Clock,
    Download,
    ListChecks,
    Search,
    ShoppingCart,
    Trash2,
    X,
} from 'lucide-react';

/**
 * POS hold-recall list client — KPI strip, cashier + date filters,
 * bulk void, single-row Recall / Void, CSV export.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
    discardPosHold,
    bulkDiscardPosHolds,
    mergePosHolds,
    type PosHoldDoc,
} from '@/app/actions/crm-pos.actions';

interface Props {
    holds: PosHoldDoc[];
}

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function fmtMoney(v: number | null | undefined): string {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return inr.format(v);
}

function fmtDateTime(v: string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function ageMinutes(heldAt: string): number {
    const t = new Date(heldAt).getTime();
    return Number.isFinite(t) ? Math.floor((Date.now() - t) / 60_000) : 0;
}

function oldestHoldLabel(holds: PosHoldDoc[]): string {
    if (holds.length === 0) return '—';
    const oldest = holds.reduce((prev, cur) => {
        const pt = new Date(prev.heldAt).getTime();
        const ct = new Date(cur.heldAt).getTime();
        return ct < pt ? cur : prev;
    });
    const mins = ageMinutes(oldest.heldAt);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export function PosHoldRecallClient({ holds }: Props) {
    const { toast } = useToast();

    const [search, setSearch] = React.useState('');
    const [cashierFilter, setCashierFilter] = React.useState<'all' | string>('all');
    const [dateFrom, setDateFrom] = React.useState('');
    const [dateTo, setDateTo] = React.useState('');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [voiding, startVoid] = React.useTransition();
    const [bulkVoiding, startBulkVoid] = React.useTransition();
    const [merging, startMerge] = React.useTransition();

    /* ─── Derived options ────────────────────────────────────── */
    const cashierOptions = React.useMemo(() => {
        const m = new Map<string, string>();
        for (const h of holds) {
            if (h.heldBy) m.set(h.heldBy, h.heldByName || h.heldBy);
        }
        return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
    }, [holds]);

    /* ─── KPIs ───────────────────────────────────────────────── */
    const kpis = React.useMemo(() => {
        const byCashier = new Map<string, number>();
        for (const h of holds) {
            const k = h.heldBy || 'unknown';
            byCashier.set(k, (byCashier.get(k) ?? 0) + 1);
        }
        const topEntry = Array.from(byCashier.entries()).sort(
            (a, b) => b[1] - a[1],
        )[0];
        return {
            total: holds.length,
            byCashierCount: byCashier.size,
            topCashierLabel: topEntry
                ? cashierOptions.find((c) => c.id === topEntry[0])?.name ||
                  topEntry[0]
                : '—',
            oldestLabel: oldestHoldLabel(holds),
        };
    }, [holds, cashierOptions]);

    /* ─── Filtering ──────────────────────────────────────────── */
    const filtered = React.useMemo(() => {
        const needle = search.trim().toLowerCase();
        const from = dateFrom ? new Date(dateFrom).getTime() : NaN;
        const to = dateTo ? new Date(dateTo).getTime() : NaN;
        return holds.filter((h) => {
            if (needle) {
                const hay = [
                    h.customerName ?? '',
                    h.heldByName ?? '',
                    h.holdReason ?? '',
                ]
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            if (cashierFilter !== 'all' && h.heldBy !== cashierFilter)
                return false;
            if (Number.isFinite(from) || Number.isFinite(to)) {
                const t = new Date(h.heldAt).getTime();
                if (!Number.isFinite(t)) return false;
                if (Number.isFinite(from) && t < from) return false;
                if (Number.isFinite(to) && t > to + 24 * 60 * 60 * 1000)
                    return false;
            }
            return true;
        });
    }, [holds, search, cashierFilter, dateFrom, dateTo]);

    const hasActiveFilters =
        !!search.trim() ||
        cashierFilter !== 'all' ||
        !!dateFrom ||
        !!dateTo;

    const clearFilters = () => {
        setSearch('');
        setCashierFilter('all');
        setDateFrom('');
        setDateTo('');
    };

    /* ─── Selection ──────────────────────────────────────────── */
    const headChecked =
        filtered.length > 0 && filtered.every((h) => selected.has(h._id));

    const toggleAll = (all: boolean) =>
        setSelected(all ? new Set(filtered.map((h) => h._id)) : new Set());

    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    /* ─── Actions ────────────────────────────────────────────── */
    const voidOne = (holdId: string) => {
        startVoid(async () => {
            const res = await discardPosHold(holdId);
            if (res.success) {
                toast({ title: 'Hold voided' });
            } else {
                toast({
                    title: 'Could not void hold',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const voidBulk = () => {
        const ids = Array.from(selected);
        startBulkVoid(async () => {
            const res = await bulkDiscardPosHolds(ids);
            if (res.success) {
                toast({ title: `${res.processed} hold${res.processed === 1 ? '' : 's'} voided` });
                setSelected(new Set());
            } else {
                toast({
                    title: 'Bulk void failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const mergeBulk = () => {
        const ids = Array.from(selected);
        if (ids.length < 2) {
            toast({ title: 'Select at least 2 tickets to merge', variant: 'destructive' });
            return;
        }
        startMerge(async () => {
            const res = await mergePosHolds(ids);
            if (res.success) {
                toast({ title: `Tickets merged successfully` });
                setSelected(new Set());
            } else {
                toast({
                    title: 'Merge failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    /* ─── Export ─────────────────────────────────────────────── */
    const exportCsv = React.useCallback(() => {
        const subset =
            selected.size > 0
                ? filtered.filter((h) => selected.has(h._id))
                : filtered;
        const headers = [
            'Customer',
            'Lines',
            'Subtotal',
            'Cashier',
            'Held at',
            'Reason',
        ];
        const rows = subset.map((h) => ({
            Customer: h.customerName || 'Walk-in',
            Lines: h.lineItems.length,
            Subtotal: h.lineItems.reduce((s, l) => s + (l.total ?? 0), 0),
            Cashier: h.heldByName || h.heldBy || '',
            'Held at': h.heldAt,
            Reason: h.holdReason || '',
        }));
        downloadCsv(`held-tickets-${dateStamp()}.csv`, headers, rows);
    }, [filtered, selected]);

    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                    label="Total held"
                    value={kpis.total.toLocaleString()}
                    icon={<ShoppingCart className="h-4 w-4" />}
                />
                <Card>
                    <CardBody className="flex items-start justify-between p-3.5">
                        <div>
                            <p className="text-[10.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                Cashiers holding
                            </p>
                            <p className="mt-0.5 text-xl font-semibold text-[var(--st-text)]">
                                {kpis.byCashierCount}
                            </p>
                        </div>
                        <ListChecks className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    </CardBody>
                </Card>
                <Card>
                    <CardBody className="flex items-start justify-between p-3.5">
                        <div>
                            <p className="text-[10.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                Most holds by
                            </p>
                            <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--st-text)]">
                                {kpis.topCashierLabel}
                            </p>
                        </div>
                        <ListChecks className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    </CardBody>
                </Card>
                <Card>
                    <CardBody className="flex items-start justify-between p-3.5">
                        <div>
                            <p className="text-[10.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                Oldest hold
                            </p>
                            <p className="mt-0.5 text-[13px] font-medium text-[var(--st-text)]">
                                {kpis.oldestLabel}
                            </p>
                        </div>
                        <Clock className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    </CardBody>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search customer, cashier, reason…"
                        className="h-9 pl-9 text-[13px]"
                    />
                </div>
                <Select
                    value={cashierFilter}
                    onValueChange={setCashierFilter}
                >
                    <SelectTrigger className="h-9 w-[180px] text-[13px]">
                        <SelectValue placeholder="Cashier" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All cashiers</SelectItem>
                        {cashierOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 w-[150px] text-[13px]"
                    aria-label="From date"
                />
                <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 w-[150px] text-[13px]"
                    aria-label="To date"
                />
                {hasActiveFilters ? (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-3.5 w-3.5" /> Clear
                    </Button>
                ) : null}
            </div>

            {/* Bulk bar */}
            {selected.size > 0 ? (
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--st-shadow-sm)]">
                    <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
                        <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
                        {selected.size} selected
                    </div>
                    <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={exportCsv}>
                            <Download className="h-3.5 w-3.5" /> Export CSV
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={mergeBulk}
                            disabled={merging || selected.size < 2}
                        >
                            Merge
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={voidBulk}
                            disabled={bulkVoiding}
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Void
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(new Set())}
                            aria-label="Clear selection"
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            ) : null}

            {/* Table */}
            <Card className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <Th className="w-8">
                                    <Checkbox
                                        checked={headChecked}
                                        onCheckedChange={(c) =>
                                            toggleAll(Boolean(c))
                                        }
                                        aria-label="Select all"
                                    />
                                </Th>
                                <Th>Customer</Th>
                                <Th>Lines</Th>
                                <Th className="text-right">
                                    Subtotal
                                </Th>
                                <Th>Cashier</Th>
                                <Th>Held at</Th>
                                <Th>Reason</Th>
                                <Th className="text-right">
                                    Actions
                                </Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {filtered.length === 0 ? (
                                <Tr>
                                    <Td
                                        colSpan={8}
                                        className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                                    >
                                        {holds.length === 0
                                            ? 'No held tickets right now.'
                                            : 'No held tickets match these filters.'}
                                    </Td>
                                </Tr>
                            ) : (
                                filtered.map((h) => {
                                    const subtotal = h.lineItems.reduce(
                                        (sum, l) => sum + (l.total ?? 0),
                                        0,
                                    );
                                    return (
                                        <Tr key={h._id}>
                                            <Td>
                                                <Checkbox
                                                    checked={selected.has(h._id)}
                                                    onCheckedChange={() =>
                                                        toggleOne(h._id)
                                                    }
                                                    aria-label="Select"
                                                />
                                            </Td>
                                            <Td>
                                                <EntityRowLink
                                                    href={`/dashboard/crm/pos/hold-recall/${h._id}`}
                                                    label={
                                                        h.customerName || 'Walk-in'
                                                    }
                                                />
                                            </Td>
                                            <Td>
                                                {h.lineItems.length}
                                            </Td>
                                            <Td className="text-right tabular-nums">
                                                {fmtMoney(subtotal)}
                                            </Td>
                                            <Td>
                                                {h.heldByName || h.heldBy || '—'}
                                            </Td>
                                            <Td>
                                                {fmtDateTime(h.heldAt)}
                                            </Td>
                                            <Td className="max-w-[200px] truncate text-[12px] text-[var(--st-text-secondary)]">
                                                {h.holdReason || '—'}
                                            </Td>
                                            <Td className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`/dashboard/crm/pos/terminal?holdId=${h._id}`}
                                                        >
                                                            Recall
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            voidOne(h._id)
                                                        }
                                                        disabled={voiding}
                                                        className="text-[var(--st-danger)]"
                                                        aria-label="Void hold"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </Td>
                                        </Tr>
                                    );
                                })
                            )}
                        </TBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
