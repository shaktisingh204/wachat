'use client';

import { Button, Card, CardBody, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, toast } from '@/components/sabcrm/20ui';
import {
    Banknote,
    Clock,
    Download,
    ListChecks,
    Search,
    Store,
    Timer,
    X,
} from 'lucide-react';

/**
 * POS sessions list — client island. KPI strip, terminal + status
 * + date filters, bulk select with CSV/XLSX export, click-through
 * to detail, inline Close / Reconcile actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusPillProps } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import {
    closePosSession,
    reconcilePosSession,
    archivePosSession,
    type PosSessionDoc,
    type PosSessionStatus,
    type PosTransactionDoc,
} from '@/app/actions/crm-pos.actions';
import { PosCashCounterDialog } from './pos-cash-counter-dialog';

interface Props {
    sessions: PosSessionDoc[];
    transactions: PosTransactionDoc[];
    initialTerminalId: string;
    initialStatus: PosSessionStatus | 'all';
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

function fmtDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

function statusTone(status: PosSessionStatus): StatusPillProps['tone'] {
    switch (status) {
        case 'open':
            return 'green';
        case 'closed':
            return 'amber';
        case 'reconciled':
            return 'blue';
        case 'archived':
            return 'neutral';
        default:
            return 'neutral';
    }
}

interface KpiTileProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    tone?: 'default' | 'accent';
}

function KpiTile({ label, value, icon: Icon, tone }: KpiTileProps) {
    return (
        <Card className="overflow-hidden">
            <CardBody className="flex items-start justify-between gap-2 p-3.5">
                <div className="min-w-0">
                    <p className="text-[10.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                        {label}
                    </p>
                    <p
                        className={
                            tone === 'accent'
                                ? 'mt-0.5 text-xl font-semibold text-[var(--st-accent)]'
                                : 'mt-0.5 text-xl font-semibold text-[var(--st-text)]'
                        }
                    >
                        {value}
                    </p>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--st-bg-muted)]">
                    <Icon className="h-3.5 w-3.5 text-[var(--st-text)]" strokeWidth={1.75} />
                </div>
            </CardBody>
        </Card>
    );
}

export function PosSessionsListClient({
    sessions,
    transactions,
    initialTerminalId,
    initialStatus,
}: Props) {
    const [search, setSearch] = React.useState(initialTerminalId);
    const [statusFilter, setStatusFilter] = React.useState<
        PosSessionStatus | 'all'
    >(initialStatus);
    const [dateFromFilter, setDateFromFilter] = React.useState('');
    const [dateToFilter, setDateToFilter] = React.useState('');
    const [pendingId, setPendingId] = React.useState<string | null>(null);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(20);
    const [showCounterId, setShowCounterId] = React.useState<string | null>(null);

    /* ── KPIs (computed from full set, ignoring filters) ──────────── */
    const kpis = React.useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const today = sessions.filter((s) => {
            if (!s.openedAt) return false;
            return new Date(s.openedAt).getTime() >= startOfDay.getTime();
        });
        const open = sessions.filter((s) => s.status === 'open');
        const closed = sessions.filter(
            (s) => s.status === 'closed' || s.status === 'reconciled',
        );
        const durations: number[] = [];
        for (const s of closed) {
            if (s.openedAt && s.closedAt) {
                const d =
                    new Date(s.closedAt).getTime() -
                    new Date(s.openedAt).getTime();
                if (Number.isFinite(d) && d > 0) durations.push(d);
            }
        }
        const avgDuration =
            durations.length > 0
                ? durations.reduce((a, b) => a + b, 0) / durations.length
                : 0;

        // Revenue today — sum transactions made today against any session
        const todaysTxns = transactions.filter((t) => {
            if (!t.createdAt) return false;
            return new Date(t.createdAt).getTime() >= startOfDay.getTime();
        });
        const completed = todaysTxns.filter(
            (t) => t.status === 'completed' || t.status === 'partially_refunded',
        );
        const revenueToday = completed.reduce(
            (sum, t) => sum + (t.total ?? 0),
            0,
        );

        return {
            totalToday: today.length,
            open: open.length,
            closed: closed.length,
            avgDuration,
            revenueToday,
        };
    }, [sessions, transactions]);

    /* ── Filtering ────────────────────────────────────────────────── */
    const filtered = React.useMemo(() => {
        const needle = search.trim().toLowerCase();
        const from = dateFromFilter ? new Date(dateFromFilter).getTime() : NaN;
        const to = dateToFilter ? new Date(dateToFilter).getTime() : NaN;
        return sessions.filter((s) => {
            if (statusFilter !== 'all' && s.status !== statusFilter) return false;
            if (needle) {
                const hay = [s.terminalId ?? '', s.openedByName ?? '']
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            if (Number.isFinite(from) || Number.isFinite(to)) {
                const t = s.openedAt ? new Date(s.openedAt).getTime() : NaN;
                if (!Number.isFinite(t)) return false;
                if (Number.isFinite(from) && t < from) return false;
                if (Number.isFinite(to) && t > to + 24 * 60 * 60 * 1000) {
                    return false;
                }
            }
            return true;
        });
    }, [sessions, search, statusFilter, dateFromFilter, dateToFilter]);

    // Reset page when filters change
    React.useEffect(() => {
        setPage(1);
    }, [search, statusFilter, dateFromFilter, dateToFilter, pageSize]);

    const pageStart = (page - 1) * pageSize;
    const paged = filtered.slice(pageStart, pageStart + pageSize);
    const hasPrev = page > 1;
    const hasNext = pageStart + pageSize < filtered.length;

    /* ── Selection ────────────────────────────────────────────────── */
    const headChecked =
        paged.length > 0 && paged.every((s) => selected.has(s._id));
    const toggleAll = (all: boolean) => {
        if (all) {
            setSelected((prev) => {
                const next = new Set(prev);
                paged.forEach((s) => next.add(s._id));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                paged.forEach((s) => next.delete(s._id));
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

    /* ── Inline actions ──────────────────────────────────────────── */
    const onClose = (id: string) => {
        setShowCounterId(id);
    };

    const handleConfirmClose = async (closingCash: number) => {
        if (!showCounterId) return;
        const id = showCounterId;
        setShowCounterId(null);
        setPendingId(id);
        try {
            const res = await closePosSession({ id, closingCash });
            if (res.success) {
                toast.success(
                    `Session closed. Discrepancy: ${fmtMoney(res.discrepancy ?? 0)}.`,
                );
            } else {
                toast.error(res.error ?? 'Failed to close session.');
            }
        } finally {
            setPendingId(null);
        }
    };

    const onReconcile = async (id: string) => {
        setPendingId(id);
        try {
            const res = await reconcilePosSession(id);
            if (res.success) {
                toast.success('Session reconciled.');
            } else {
                toast.error(res.error ?? 'Failed to reconcile.');
            }
        } finally {
            setPendingId(null);
        }
    };

    /* ── Bulk archive ────────────────────────────────────────────── */
    const bulkArchive = async () => {
        if (selected.size === 0) return;
        const confirmed = window.confirm(
            `Archive ${selected.size} session${selected.size > 1 ? 's' : ''}? Only closed / reconciled sessions can be archived.`,
        );
        if (!confirmed) return;
        let ok = 0;
        let fail = 0;
        for (const id of Array.from(selected)) {
            const target = sessions.find((s) => s._id === id);
            if (
                !target ||
                (target.status !== 'closed' && target.status !== 'reconciled')
            ) {
                fail += 1;
                continue;
            }
            const res = await archivePosSession(id);
            if (res.success) ok += 1;
            else fail += 1;
        }
        if (ok > 0) toast.success(`Archived ${ok} session(s).`);
        if (fail > 0) {
            toast.error(
                `${fail} session(s) skipped — only closed/reconciled can be archived.`,
            );
        }
        setSelected(new Set());
    };

    /* ── Export ──────────────────────────────────────────────────── */
    const buildExportRows = () => {
        const subset =
            selected.size > 0
                ? filtered.filter((s) => selected.has(s._id))
                : filtered;
        return subset.map((s) => ({
            Terminal: s.terminalId,
            Cashier: s.openedByName ?? '',
            'Opened at': s.openedAt,
            'Closed at': s.closedAt ?? '',
            'Opening cash': s.openingCash,
            'Closing cash': s.closingCash ?? '',
            'Expected cash': s.expectedCash ?? '',
            Discrepancy: s.discrepancy ?? '',
            Status: s.status,
            Notes: s.notes ?? '',
        }));
    };
    const exportHeaders = [
        'Terminal',
        'Cashier',
        'Opened at',
        'Closed at',
        'Opening cash',
        'Closing cash',
        'Expected cash',
        'Discrepancy',
        'Status',
        'Notes',
    ];
    const exportCsv = () =>
        downloadCsv(`pos-sessions-${dateStamp()}.csv`, exportHeaders, buildExportRows());
    const exportXlsx = () =>
        downloadXlsx(
            `pos-sessions-${dateStamp()}.xlsx`,
            exportHeaders,
            buildExportRows(),
            'POS sessions',
        );

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setDateFromFilter('');
        setDateToFilter('');
    };
    const hasFilters =
        !!search.trim() ||
        statusFilter !== 'all' ||
        !!dateFromFilter ||
        !!dateToFilter;

    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
                <KpiTile
                    label="Total today"
                    value={kpis.totalToday}
                    icon={Store}
                />
                <KpiTile label="Open" value={kpis.open} icon={Store} />
                <KpiTile label="Closed" value={kpis.closed} icon={Clock} />
                <KpiTile
                    label="Avg duration"
                    value={fmtDuration(kpis.avgDuration)}
                    icon={Timer}
                />
                <KpiTile
                    label="Revenue today"
                    value={fmtMoney(kpis.revenueToday)}
                    icon={Banknote}
                    tone="accent"
                />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search terminal or cashier…"
                        className="h-9 pl-9 text-[13px]"
                    />
                </div>
                <Select
                    value={statusFilter}
                    onValueChange={(v) =>
                        setStatusFilter(v as PosSessionStatus | 'all')
                    }
                >
                    <SelectTrigger className="h-9 w-[160px] text-[13px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="reconciled">Reconciled</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
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
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--st-shadow-sm)]">
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
                        <Button size="sm" variant="outline" onClick={bulkArchive}>
                            Archive
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
                                <Th>Terminal</Th>
                                <Th>Cashier</Th>
                                <Th>Opened</Th>
                                <Th>Opening cash</Th>
                                <Th>Drift</Th>
                                <Th>Status</Th>
                                <Th className="text-right">
                                    Actions
                                </Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {paged.length === 0 ? (
                                <Tr>
                                    <Td
                                        colSpan={8}
                                        className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                                    >
                                        {sessions.length === 0
                                            ? 'No POS sessions yet. Open one to start ringing up sales.'
                                            : 'No sessions match these filters.'}
                                    </Td>
                                </Tr>
                            ) : (
                                paged.map((s) => (
                                    <Tr key={s._id}>
                                        <Td>
                                            <Checkbox
                                                checked={selected.has(s._id)}
                                                onCheckedChange={() =>
                                                    toggleOne(s._id)
                                                }
                                                aria-label="Select session"
                                            />
                                        </Td>
                                        <Td>
                                            <EntityRowLink
                                                href={`/dashboard/crm/pos/sessions/${s._id}`}
                                                label={s.terminalId}
                                                subtitle={
                                                    s.openedByName ??
                                                    undefined
                                                }
                                            />
                                        </Td>
                                        <Td>
                                            {s.openedByName || '—'}
                                        </Td>
                                        <Td>
                                            {fmtDateTime(s.openedAt)}
                                        </Td>
                                        <Td className="tabular-nums">
                                            {fmtMoney(s.openingCash)}
                                        </Td>
                                        <Td className="tabular-nums">
                                            {typeof s.discrepancy === 'number'
                                                ? fmtMoney(s.discrepancy)
                                                : '—'}
                                        </Td>
                                        <Td>
                                            <StatusPill
                                                label={s.status}
                                                tone={statusTone(s.status)}
                                            />
                                        </Td>
                                        <Td className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`/dashboard/crm/pos/sessions/${s._id}`}
                                                    >
                                                        View
                                                    </Link>
                                                </Button>
                                                {s.status === 'open' ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={
                                                            pendingId === s._id
                                                        }
                                                        onClick={() =>
                                                            onClose(s._id)
                                                        }
                                                    >
                                                        Close
                                                    </Button>
                                                ) : null}
                                                {s.status === 'closed' ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={
                                                            pendingId === s._id
                                                        }
                                                        onClick={() =>
                                                            onReconcile(s._id)
                                                        }
                                                    >
                                                        Reconcile
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </Td>
                                    </Tr>
                                ))
                            )}
                        </TBody>
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
                                <SelectTrigger className="h-8 w-[80px] text-[12px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[10, 20, 50, 100].map((n) => (
                                        <SelectItem
                                            key={n}
                                            value={String(n)}
                                        >
                                            {n}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
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

            <PosCashCounterDialog 
                open={!!showCounterId}
                onOpenChange={(open) => { if (!open) setShowCounterId(null); }}
                onConfirm={handleConfirmClose}
            />
        </div>
    );
}
