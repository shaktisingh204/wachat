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
    zoruSonnerToast,
} from '@/components/zoruui';
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
        <ZoruCard className="overflow-hidden">
            <ZoruCardContent className="flex items-start justify-between gap-2 p-3.5">
                <div className="min-w-0">
                    <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                        {label}
                    </p>
                    <p
                        className={
                            tone === 'accent'
                                ? 'mt-0.5 text-xl font-semibold text-zoru-accent'
                                : 'mt-0.5 text-xl font-semibold text-zoru-ink'
                        }
                    >
                        {value}
                    </p>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zoru-surface-2">
                    <Icon className="h-3.5 w-3.5 text-zoru-ink" strokeWidth={1.75} />
                </div>
            </ZoruCardContent>
        </ZoruCard>
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

    /* ── KPIs (computed from full set, ignoring filters) ──────────── */
    const kpis = React.useMemo(() => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
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
    const onClose = async (id: string) => {
        const raw = window.prompt('Closing cash counted (₹)?');
        if (raw == null) return;
        const closingCash = Number(raw);
        if (!Number.isFinite(closingCash) || closingCash < 0) {
            zoruSonnerToast.error('Closing cash must be a non-negative number.');
            return;
        }
        setPendingId(id);
        try {
            const res = await closePosSession({ id, closingCash });
            if (res.success) {
                zoruSonnerToast.success(
                    `Session closed. Discrepancy: ${fmtMoney(res.discrepancy ?? 0)}.`,
                );
            } else {
                zoruSonnerToast.error(res.error ?? 'Failed to close session.');
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
                zoruSonnerToast.success('Session reconciled.');
            } else {
                zoruSonnerToast.error(res.error ?? 'Failed to reconcile.');
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
        if (ok > 0) zoruSonnerToast.success(`Archived ${ok} session(s).`);
        if (fail > 0) {
            zoruSonnerToast.error(
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
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
                    <ZoruInput
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search terminal or cashier…"
                        className="h-9 pl-9 text-[13px]"
                    />
                </div>
                <ZoruSelect
                    value={statusFilter}
                    onValueChange={(v) =>
                        setStatusFilter(v as PosSessionStatus | 'all')
                    }
                >
                    <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                        <ZoruSelectValue placeholder="Status" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                        <ZoruSelectItem value="open">Open</ZoruSelectItem>
                        <ZoruSelectItem value="closed">Closed</ZoruSelectItem>
                        <ZoruSelectItem value="reconciled">Reconciled</ZoruSelectItem>
                        <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
                <ZoruInput
                    type="date"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                    className="h-9 w-[150px] text-[13px]"
                    aria-label="From"
                />
                <ZoruInput
                    type="date"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                    className="h-9 w-[150px] text-[13px]"
                    aria-label="To"
                />
                {hasFilters ? (
                    <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-3.5 w-3.5" /> Clear
                    </ZoruButton>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                    <ZoruButton size="sm" variant="outline" onClick={exportCsv}>
                        <Download className="h-3.5 w-3.5" /> CSV
                    </ZoruButton>
                    <ZoruButton size="sm" variant="outline" onClick={exportXlsx}>
                        <Download className="h-3.5 w-3.5" /> XLSX
                    </ZoruButton>
                </div>
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 ? (
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
                    <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                        <ListChecks className="h-4 w-4 text-zoru-primary" />
                        {selected.size} selected
                    </div>
                    <div className="flex items-center gap-1">
                        <ZoruButton size="sm" variant="outline" onClick={exportCsv}>
                            Export CSV
                        </ZoruButton>
                        <ZoruButton size="sm" variant="outline" onClick={exportXlsx}>
                            Export XLSX
                        </ZoruButton>
                        <ZoruButton size="sm" variant="outline" onClick={bulkArchive}>
                            Archive
                        </ZoruButton>
                        <ZoruButton
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(new Set())}
                            aria-label="Clear selection"
                        >
                            <X className="h-3.5 w-3.5" />
                        </ZoruButton>
                    </div>
                </div>
            ) : null}

            <ZoruCard className="p-0">
                <div className="overflow-x-auto">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="w-8">
                                    <ZoruCheckbox
                                        checked={headChecked}
                                        onCheckedChange={(c) =>
                                            toggleAll(Boolean(c))
                                        }
                                        aria-label="Select all"
                                    />
                                </ZoruTableHead>
                                <ZoruTableHead>Terminal</ZoruTableHead>
                                <ZoruTableHead>Cashier</ZoruTableHead>
                                <ZoruTableHead>Opened</ZoruTableHead>
                                <ZoruTableHead>Opening cash</ZoruTableHead>
                                <ZoruTableHead>Drift</ZoruTableHead>
                                <ZoruTableHead>Status</ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Actions
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {paged.length === 0 ? (
                                <ZoruTableRow>
                                    <ZoruTableCell
                                        colSpan={8}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        {sessions.length === 0
                                            ? 'No POS sessions yet. Open one to start ringing up sales.'
                                            : 'No sessions match these filters.'}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                paged.map((s) => (
                                    <ZoruTableRow key={s._id}>
                                        <ZoruTableCell>
                                            <ZoruCheckbox
                                                checked={selected.has(s._id)}
                                                onCheckedChange={() =>
                                                    toggleOne(s._id)
                                                }
                                                aria-label="Select session"
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <EntityRowLink
                                                href={`/dashboard/crm/pos/sessions/${s._id}`}
                                                label={s.terminalId}
                                                subtitle={
                                                    s.openedByName ??
                                                    undefined
                                                }
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {s.openedByName || '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtDateTime(s.openedAt)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="tabular-nums">
                                            {fmtMoney(s.openingCash)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="tabular-nums">
                                            {typeof s.discrepancy === 'number'
                                                ? fmtMoney(s.discrepancy)
                                                : '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <StatusPill
                                                label={s.status}
                                                tone={statusTone(s.status)}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`/dashboard/crm/pos/sessions/${s._id}`}
                                                    >
                                                        View
                                                    </Link>
                                                </ZoruButton>
                                                {s.status === 'open' ? (
                                                    <ZoruButton
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
                                                    </ZoruButton>
                                                ) : null}
                                                {s.status === 'closed' ? (
                                                    <ZoruButton
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
                                                    </ZoruButton>
                                                ) : null}
                                            </div>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>

                {/* Pagination */}
                {filtered.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zoru-line px-3 py-2.5">
                        <div className="flex items-center gap-2 text-[12px] text-zoru-ink-muted">
                            <span>Rows per page</span>
                            <ZoruSelect
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
                            </ZoruSelect>
                        </div>
                        <div className="flex items-center gap-3 text-[12px] text-zoru-ink-muted">
                            <span>
                                {pageStart + 1}–
                                {Math.min(pageStart + pageSize, filtered.length)}{' '}
                                of {filtered.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <ZoruButton
                                    size="sm"
                                    variant="outline"
                                    disabled={!hasPrev}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Prev
                                </ZoruButton>
                                <ZoruButton
                                    size="sm"
                                    variant="outline"
                                    disabled={!hasNext}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Next
                                </ZoruButton>
                            </div>
                        </div>
                    </div>
                ) : null}
            </ZoruCard>
        </div>
    );
}
