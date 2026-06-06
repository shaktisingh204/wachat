'use client';

import {
    Button,
    Card,
    ZoruCardContent,
    Checkbox,
    Input,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import {
    AlertTriangle,
    Calculator,
    Download,
    ListChecks,
    RefreshCcw,
    Search,
    X,
} from 'lucide-react';

import * as React from 'react';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusPillProps } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import type {
    PosPaymentMethod,
    PosRefundDoc,
    PosRefundStatus,
} from '@/app/actions/crm-pos.actions.types';

interface Props {
    refunds: PosRefundDoc[];
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

function statusTone(status: PosRefundStatus): StatusPillProps['tone'] {
    switch (status) {
        case 'completed':
            return 'green';
        case 'pending':
            return 'amber';
        case 'failed':
            return 'red';
        default:
            return 'neutral';
    }
}

interface KpiTileProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    tone?: 'default' | 'accent';
    hint?: string;
}

function KpiTile({ label, value, icon: Icon, tone, hint }: KpiTileProps) {
    return (
        <Card className="overflow-hidden">
            <ZoruCardContent className="flex items-start justify-between gap-2 p-3.5">
                <div className="min-w-0">
                    <p className="text-[10.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                        {label}
                    </p>
                    <p
                        className={
                            tone === 'accent'
                                ? 'mt-0.5 truncate text-xl font-semibold text-[var(--st-accent)]'
                                : 'mt-0.5 truncate text-xl font-semibold text-[var(--st-text)]'
                        }
                    >
                        {value}
                    </p>
                    {hint ? (
                        <p className="mt-0.5 truncate text-[11px] text-[var(--st-text-secondary)]">
                            {hint}
                        </p>
                    ) : null}
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--st-bg-muted)]">
                    <Icon className="h-3.5 w-3.5 text-[var(--st-text)]" strokeWidth={1.75} />
                </div>
            </ZoruCardContent>
        </Card>
    );
}

export function PosRefundsListClient({ refunds }: Props) {
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        PosRefundStatus | 'all'
    >('all');
    const [methodFilter, setMethodFilter] = React.useState<
        PosPaymentMethod | 'all'
    >('all');
    const [dateFromFilter, setDateFromFilter] = React.useState('');
    const [dateToFilter, setDateToFilter] = React.useState('');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(20);

    /* ── KPIs (this month) ───────────────────────────────────────── */
    const kpis = React.useMemo(() => {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const thisMonth = refunds.filter((r) => {
            if (!r.createdAt) return false;
            return new Date(r.createdAt).getTime() >= monthStart.getTime();
        });
        const totalAmt = thisMonth.reduce(
            (sum, r) => sum + (r.refundTotal ?? 0),
            0,
        );
        const avg = thisMonth.length > 0 ? totalAmt / thisMonth.length : 0;

        // Top refund reason
        const reasons = new Map<string, number>();
        for (const r of thisMonth) {
            const key = (r.reason || 'Unspecified').trim();
            reasons.set(key, (reasons.get(key) ?? 0) + 1);
        }
        const topReason = Array.from(reasons.entries()).sort(
            (a, b) => b[1] - a[1],
        )[0];

        return {
            count: thisMonth.length,
            total: totalAmt,
            avg,
            topReason,
        };
    }, [refunds]);

    /* ── Filtering ───────────────────────────────────────────────── */
    const filtered = React.useMemo(() => {
        const needle = search.trim().toLowerCase();
        const from = dateFromFilter ? new Date(dateFromFilter).getTime() : NaN;
        const to = dateToFilter ? new Date(dateToFilter).getTime() : NaN;
        return refunds.filter((r) => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (methodFilter !== 'all' && r.refundMethod !== methodFilter) {
                return false;
            }
            if (needle) {
                const hay = [
                    r.originalTransactionNumber ?? '',
                    r.originalTransactionId,
                    r.reason ?? '',
                ]
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            if (Number.isFinite(from) || Number.isFinite(to)) {
                const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
                if (!Number.isFinite(t)) return false;
                if (Number.isFinite(from) && t < from) return false;
                if (Number.isFinite(to) && t > to + 24 * 60 * 60 * 1000) {
                    return false;
                }
            }
            return true;
        });
    }, [
        refunds,
        search,
        statusFilter,
        methodFilter,
        dateFromFilter,
        dateToFilter,
    ]);

    React.useEffect(() => {
        setPage(1);
    }, [
        search,
        statusFilter,
        methodFilter,
        dateFromFilter,
        dateToFilter,
        pageSize,
    ]);

    const pageStart = (page - 1) * pageSize;
    const paged = filtered.slice(pageStart, pageStart + pageSize);
    const hasPrev = page > 1;
    const hasNext = pageStart + pageSize < filtered.length;

    /* ── Selection ───────────────────────────────────────────────── */
    const headChecked =
        paged.length > 0 && paged.every((r) => selected.has(r._id));
    const toggleAll = (all: boolean) => {
        if (all) {
            setSelected((prev) => {
                const next = new Set(prev);
                paged.forEach((r) => next.add(r._id));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                paged.forEach((r) => next.delete(r._id));
                return next;
            });
        }
    };
    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    /* ── Export ──────────────────────────────────────────────────── */
    const buildRows = () => {
        const subset =
            selected.size > 0
                ? filtered.filter((r) => selected.has(r._id))
                : filtered;
        return subset.map((r) => ({
            'Original txn': r.originalTransactionNumber ?? r.originalTransactionId,
            Reason: r.reason,
            Method: r.refundMethod,
            'Refund total': r.refundTotal,
            Status: r.status,
            'Processed at': r.processedAt ?? '',
            'Created at': r.createdAt,
        }));
    };
    const headers = [
        'Original txn',
        'Reason',
        'Method',
        'Refund total',
        'Status',
        'Processed at',
        'Created at',
    ];
    const exportCsv = () =>
        downloadCsv(`pos-refunds-${dateStamp()}.csv`, headers, buildRows());
    const exportXlsx = () =>
        downloadXlsx(
            `pos-refunds-${dateStamp()}.xlsx`,
            headers,
            buildRows(),
            'POS refunds',
        );

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setMethodFilter('all');
        setDateFromFilter('');
        setDateToFilter('');
    };
    const hasFilters =
        !!search.trim() ||
        statusFilter !== 'all' ||
        methodFilter !== 'all' ||
        !!dateFromFilter ||
        !!dateToFilter;

    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <KpiTile
                    label="Total this month"
                    value={fmtMoney(kpis.total)}
                    icon={RefreshCcw}
                    tone="accent"
                />
                <KpiTile label="Count (mo)" value={kpis.count} icon={ListChecks} />
                <KpiTile
                    label="Avg refund"
                    value={fmtMoney(kpis.avg)}
                    icon={Calculator}
                />
                <KpiTile
                    label="Top reason"
                    value={kpis.topReason ? kpis.topReason[0] : '—'}
                    icon={AlertTriangle}
                    hint={
                        kpis.topReason
                            ? `${kpis.topReason[1]} occurrence${kpis.topReason[1] === 1 ? '' : 's'}`
                            : undefined
                    }
                />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search txn # or reason…"
                        className="h-9 pl-9 text-[13px]"
                    />
                </div>
                <Select
                    value={statusFilter}
                    onValueChange={(v) =>
                        setStatusFilter(v as PosRefundStatus | 'all')
                    }
                >
                    <ZoruSelectTrigger className="h-9 w-[150px] text-[13px]">
                        <ZoruSelectValue placeholder="Status" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                        <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                        <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
                        <ZoruSelectItem value="failed">Failed</ZoruSelectItem>
                    </ZoruSelectContent>
                </Select>
                <Select
                    value={methodFilter}
                    onValueChange={(v) =>
                        setMethodFilter(v as PosPaymentMethod | 'all')
                    }
                >
                    <ZoruSelectTrigger className="h-9 w-[150px] text-[13px]">
                        <ZoruSelectValue placeholder="Method" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All methods</ZoruSelectItem>
                        <ZoruSelectItem value="cash">Cash</ZoruSelectItem>
                        <ZoruSelectItem value="card">Card</ZoruSelectItem>
                        <ZoruSelectItem value="upi">UPI</ZoruSelectItem>
                        <ZoruSelectItem value="split">Split</ZoruSelectItem>
                        <ZoruSelectItem value="other">Other</ZoruSelectItem>
                    </ZoruSelectContent>
                </Select>
                <Input
                    type="date"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                    className="h-9 w-[150px] text-[13px]"
                    aria-label="From"
                />
                <Input
                    type="date"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                    className="h-9 w-[150px] text-[13px]"
                    aria-label="To"
                />
                {hasFilters ? (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-3.5 w-3.5" /> Clear
                    </Button>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={exportCsv}>
                        <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportXlsx}>
                        <Download className="h-3.5 w-3.5" /> XLSX
                    </Button>
                </div>
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 ? (
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
                    <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
                        <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
                        {selected.size} selected
                    </div>
                    <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={exportCsv}>
                            Export CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={exportXlsx}>
                            Export XLSX
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
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                                <ZoruTableHead className="w-8">
                                    <Checkbox
                                        checked={headChecked}
                                        onCheckedChange={(c) =>
                                            toggleAll(Boolean(c))
                                        }
                                        aria-label="Select all"
                                    />
                                </ZoruTableHead>
                                <ZoruTableHead>Original txn</ZoruTableHead>
                                <ZoruTableHead>Reason</ZoruTableHead>
                                <ZoruTableHead>Method</ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Refund total
                                </ZoruTableHead>
                                <ZoruTableHead>Status</ZoruTableHead>
                                <ZoruTableHead>Processed</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {paged.length === 0 ? (
                                <ZoruTableRow>
                                    <ZoruTableCell
                                        colSpan={7}
                                        className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                                    >
                                        {refunds.length === 0
                                            ? 'No refunds recorded yet.'
                                            : 'No refunds match these filters.'}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                paged.map((r) => (
                                    <ZoruTableRow key={r._id}>
                                        <ZoruTableCell>
                                            <Checkbox
                                                checked={selected.has(r._id)}
                                                onCheckedChange={() =>
                                                    toggleOne(r._id)
                                                }
                                                aria-label="Select refund"
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {r.sessionId ? (
                                                <EntityRowLink
                                                    href={`/dashboard/crm/pos/sessions/${r.sessionId}`}
                                                    label={
                                                        r.originalTransactionNumber ||
                                                        r.originalTransactionId.slice(-8)
                                                    }
                                                    subtitle={
                                                        r.originalTransactionNumber
                                                            ? r.originalTransactionId.slice(-8)
                                                            : undefined
                                                    }
                                                />
                                            ) : (
                                                <span className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {r.originalTransactionNumber ||
                                                        r.originalTransactionId.slice(-8)}
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="max-w-[260px] truncate text-[12.5px]">
                                            {r.reason}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="capitalize">
                                            {r.refundMethod}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right tabular-nums">
                                            {fmtMoney(r.refundTotal)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <StatusPill
                                                label={r.status}
                                                tone={statusTone(r.status)}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtDateTime(r.processedAt)}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {filtered.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--st-border)] px-3 py-2.5">
                        <div className="flex items-center gap-2 text-[12px] text-[var(--st-text-secondary)]">
                            <span>Rows per page</span>
                            <Select
                                value={String(pageSize)}
                                onValueChange={(v) => setPageSize(Number(v))}
                            >
                                <ZoruSelectTrigger className="h-8 w-[80px] text-[12px]">
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {[10, 20, 50, 100].map((n) => (
                                        <ZoruSelectItem
                                            key={n}
                                            value={String(n)}
                                        >
                                            {n}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-3 text-[12px] text-[var(--st-text-secondary)]">
                            <span>
                                {pageStart + 1}–
                                {Math.min(pageStart + pageSize, filtered.length)}{' '}
                                of {filtered.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!hasPrev}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Prev
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!hasNext}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </Card>
        </div>
    );
}
