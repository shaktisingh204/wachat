'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  Search,
  X } from 'lucide-react';

/**
 * POS sessions list — client island. Free-text terminal + status
 * filters, click-through to detail, inline Close / Reconcile actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, type StatusPillProps } from '@/components/crm/status-pill';

import {
    closePosSession,
    reconcilePosSession,
    type PosSessionDoc,
    type PosSessionStatus,
} from '@/app/actions/crm-pos.actions';

interface Props {
    sessions: PosSessionDoc[];
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

export function PosSessionsListClient({
    sessions,
    initialTerminalId,
    initialStatus,
}: Props) {
    const [search, setSearch] = React.useState(initialTerminalId);
    const [statusFilter, setStatusFilter] = React.useState<
        PosSessionStatus | 'all'
    >(initialStatus);
    const [pendingId, setPendingId] = React.useState<string | null>(null);

    const filtered = React.useMemo(() => {
        const needle = search.trim().toLowerCase();
        return sessions.filter((s) => {
            if (statusFilter !== 'all' && s.status !== statusFilter) return false;
            if (needle) {
                const hay = [
                    s.terminalId ?? '',
                    s.openedByName ?? '',
                ]
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        });
    }, [sessions, search, statusFilter]);

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

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
    };
    const hasFilters = !!search.trim() || statusFilter !== 'all';

    return (
        <div className="flex flex-col gap-4">
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
                    onValueChange={(v) => setStatusFilter(v as PosSessionStatus | 'all')}
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
                {hasFilters ? (
                    <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-3.5 w-3.5" /> Clear
                    </ZoruButton>
                ) : null}
            </div>

            <ZoruCard className="p-0">
                <div className="overflow-x-auto">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead>Terminal</ZoruTableHead>
                                <ZoruTableHead>Cashier</ZoruTableHead>
                                <ZoruTableHead>Opened</ZoruTableHead>
                                <ZoruTableHead>Opening cash</ZoruTableHead>
                                <ZoruTableHead>Drift</ZoruTableHead>
                                <ZoruTableHead>Status</ZoruTableHead>
                                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {filtered.length === 0 ? (
                                <ZoruTableRow>
                                    <ZoruTableCell
                                        colSpan={7}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        {sessions.length === 0
                                            ? 'No POS sessions yet. Open one to start ringing up sales.'
                                            : 'No sessions match these filters.'}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                filtered.map((s) => (
                                    <ZoruTableRow key={s._id}>
                                        <ZoruTableCell>
                                            <Link
                                                href={`/dashboard/crm/pos/sessions/${s._id}`}
                                                className="font-medium text-zoru-ink hover:underline"
                                            >
                                                {s.terminalId}
                                            </Link>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {s.openedByName || '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtDateTime(s.openedAt)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtMoney(s.openingCash)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
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
                                                <ZoruButton size="sm" variant="ghost" asChild>
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
                                                        disabled={pendingId === s._id}
                                                        onClick={() => onClose(s._id)}
                                                    >
                                                        Close
                                                    </ZoruButton>
                                                ) : null}
                                                {s.status === 'closed' ? (
                                                    <ZoruButton
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={pendingId === s._id}
                                                        onClick={() => onReconcile(s._id)}
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
            </ZoruCard>
        </div>
    );
}
