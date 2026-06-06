'use client';

import { Button, Card, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, zoruSonnerToast } from '@/components/sabcrm/20ui/compat';
import {
    Download,
    ListChecks,
    RefreshCw,
    Search,
    ShoppingCart,
    X,
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { closePosSession } from '@/app/actions/crm-pos.actions';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

export interface TerminalRow {
    terminalId: string;
    status: 'online' | 'offline';
    lastHeartbeat: string | null;
    openSessionId: string | null;
    openedByName: string | null;
    sessionsCount: number;
    revenueToday: number;
    txnsToday: number;
}

interface Props {
    terminals: TerminalRow[];
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

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function relativeTime(iso: string | null): string {
    if (!iso) return 'Never';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
    const diffSec = Math.round((then - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    if (abs < 60) return RTF.format(diffSec, 'second');
    if (abs < 3600) return RTF.format(Math.round(diffSec / 60), 'minute');
    if (abs < 86_400) return RTF.format(Math.round(diffSec / 3600), 'hour');
    if (abs < 604_800) return RTF.format(Math.round(diffSec / 86_400), 'day');
    return new Date(iso).toLocaleDateString();
}

type StatusFilter = 'all' | 'online' | 'offline';

export function PosTerminalManagerClient({ terminals }: Props) {
    const router = useRouter();
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [pendingId, setPendingId] = React.useState<string | null>(null);

    const filtered = React.useMemo(() => {
        const needle = search.trim().toLowerCase();
        return terminals.filter((t) => {
            if (statusFilter !== 'all' && t.status !== statusFilter) {
                return false;
            }
            if (needle) {
                const hay = [t.terminalId, t.openedByName ?? '']
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        });
    }, [terminals, search, statusFilter]);

    const headChecked =
        filtered.length > 0 &&
        filtered.every((t) => selected.has(t.terminalId));

    const toggleAll = (all: boolean) =>
        setSelected(
            all ? new Set(filtered.map((t) => t.terminalId)) : new Set(),
        );

    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
    };
    const hasFilters = !!search.trim() || statusFilter !== 'all';

    /* ── Per-row actions ─────────────────────────────────────────── */
    const onCloseSession = async (row: TerminalRow) => {
        if (!row.openSessionId) return;
        const raw = window.prompt('Closing cash counted (₹)?');
        if (raw == null) return;
        const closingCash = Number(raw);
        if (!Number.isFinite(closingCash) || closingCash < 0) {
            zoruSonnerToast.error('Closing cash must be a non-negative number.');
            return;
        }
        setPendingId(row.terminalId);
        try {
            const res = await closePosSession({
                id: row.openSessionId,
                closingCash,
            });
            if (res.success) {
                zoruSonnerToast.success(
                    `Session closed. Discrepancy: ${fmtMoney(res.discrepancy ?? 0)}.`,
                );
                router.refresh();
            } else {
                zoruSonnerToast.error(res.error ?? 'Failed to close session.');
            }
        } finally {
            setPendingId(null);
        }
    };

    /* ── Export ─────────────────────────────────────────────────── */
    const buildRows = () => {
        const subset =
            selected.size > 0
                ? filtered.filter((t) => selected.has(t.terminalId))
                : filtered;
        return subset.map((t) => ({
            Terminal: t.terminalId,
            Status: t.status,
            'Last heartbeat': t.lastHeartbeat ?? '',
            'Active cashier': t.openedByName ?? '',
            'Sessions (total)': t.sessionsCount,
            'Txns today': t.txnsToday,
            'Revenue today': t.revenueToday,
        }));
    };
    const headers = [
        'Terminal',
        'Status',
        'Last heartbeat',
        'Active cashier',
        'Sessions (total)',
        'Txns today',
        'Revenue today',
    ];
    const exportCsv = () =>
        downloadCsv(`pos-terminals-${dateStamp()}.csv`, headers, buildRows());
    const exportXlsx = () =>
        downloadXlsx(
            `pos-terminals-${dateStamp()}.xlsx`,
            headers,
            buildRows(),
            'Terminals',
        );

    return (
        <div className="flex flex-col gap-4">
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
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                    <SelectTrigger className="h-9 w-[150px] text-[13px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All terminals</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                </Select>
                {hasFilters ? (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-3.5 w-3.5" /> Clear
                    </Button>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.refresh()}
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
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
                                <Th>Terminal</Th>
                                <Th>Status</Th>
                                <Th>Active cashier</Th>
                                <Th>Last heartbeat</Th>
                                <Th className="text-right">
                                    Txns today
                                </Th>
                                <Th className="text-right">
                                    Revenue today
                                </Th>
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
                                        {terminals.length === 0
                                            ? 'No terminals yet. Open a session on a terminal to register it.'
                                            : 'No terminals match these filters.'}
                                    </Td>
                                </Tr>
                            ) : (
                                filtered.map((t) => (
                                    <Tr key={t.terminalId}>
                                        <Td>
                                            <Checkbox
                                                checked={selected.has(
                                                    t.terminalId,
                                                )}
                                                onCheckedChange={() =>
                                                    toggleOne(t.terminalId)
                                                }
                                                aria-label="Select terminal"
                                            />
                                        </Td>
                                        <Td>
                                            {t.openSessionId ? (
                                                <EntityRowLink
                                                    href={`/dashboard/crm/pos/sessions/${t.openSessionId}`}
                                                    label={t.terminalId}
                                                    subtitle={`${t.sessionsCount} session${t.sessionsCount === 1 ? '' : 's'}`}
                                                />
                                            ) : (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium text-[var(--st-text)]">
                                                        {t.terminalId}
                                                    </span>
                                                    <span className="text-[12px] text-[var(--st-text-secondary)]">
                                                        {t.sessionsCount}{' '}
                                                        session
                                                        {t.sessionsCount === 1
                                                            ? ''
                                                            : 's'}
                                                    </span>
                                                </div>
                                            )}
                                        </Td>
                                        <Td>
                                            <span className="inline-flex items-center gap-2 text-[12.5px]">
                                                <span
                                                    className={
                                                        'inline-block h-2 w-2 rounded-full ' +
                                                        (t.status === 'online'
                                                            ? 'bg-[var(--st-text)]'
                                                            : 'bg-[var(--st-bg-muted)]')
                                                    }
                                                    aria-hidden="true"
                                                />
                                                <span className="capitalize">
                                                    {t.status}
                                                </span>
                                            </span>
                                        </Td>
                                        <Td>
                                            {t.openedByName || '—'}
                                        </Td>
                                        <Td>
                                            <span title={t.lastHeartbeat ?? ''}>
                                                {relativeTime(t.lastHeartbeat)}
                                            </span>
                                        </Td>
                                        <Td className="text-right tabular-nums">
                                            {t.txnsToday}
                                        </Td>
                                        <Td className="text-right tabular-nums">
                                            {fmtMoney(t.revenueToday)}
                                        </Td>
                                        <Td className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {t.status === 'online' ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            asChild
                                                        >
                                                            <Link
                                                                href={`/dashboard/crm/pos/terminal?live=1`}
                                                            >
                                                                <ShoppingCart className="h-3.5 w-3.5" />
                                                                Open
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={
                                                                pendingId ===
                                                                t.terminalId
                                                            }
                                                            onClick={() =>
                                                                onCloseSession(t)
                                                            }
                                                        >
                                                            Close
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`/dashboard/crm/pos/sessions/new?terminalId=${encodeURIComponent(t.terminalId)}`}
                                                        >
                                                            Reset · Open
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </Td>
                                    </Tr>
                                ))
                            )}
                        </TBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
