'use client';

import { ZoruButton, useZoruToast } from '@/components/zoruui';
import {
  Plus,
  FileMinus } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import type { DateRange } from 'react-day-picker';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

/**
 * Debit Notes — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards) — Total DNs, Refunded, Pending, Linked bill value.
 *     • Filter row (status, vendor, reason, refund mode, date range).
 *     • Bulk action bar (archive · delete · export · mark refunded).
 *     • <DebitNoteListClient /> table.
 *     • Pagination.
 *
 * Buy-side mirror of the Credit Notes list shell.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    listDebitNotes,
    getDebitNoteKpis,
    bulkDebitNoteAction,
    deleteDebitNoteAction,
    type DebitNoteKpis,
} from '@/app/actions/crm/debit-notes.actions';
import type { CrmDebitNoteDoc } from '@/lib/rust-client/crm-debit-notes';

import {
    DebitNoteKpiStrip,
    type DebitNoteKpiFilter,
} from './_components/debit-note-kpi-strip';
import { DebitNoteListClient } from './_components/debit-note-list-client';
import { DebitNoteFiltersRow } from './_components/debit-note-filters';
import { DebitNoteBulkBar } from './_components/debit-note-bulk-bar';

const DNS_PER_PAGE = 20;

const EMPTY_KPIS: DebitNoteKpis = {
    totalCount: 0,
    refundedCount: 0,
    pendingRefundCount: 0,
    linkedBillValue: 0,
    currency: 'INR',
};

export default function DebitNotesPage() {
    const { toast } = useZoruToast();

    const [debitNotes, setDebitNotes] = React.useState<CrmDebitNoteDoc[]>([]);
    const [page, setPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<DebitNoteKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<DebitNoteKpiFilter>('all');
    const [vendorFilter, setVendorFilter] = React.useState('');
    const [reasonFilter, setReasonFilter] = React.useState('');
    const [refundModeFilter, setRefundModeFilter] = React.useState('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

    // Selection + dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkDelete, setBulkDelete] = React.useState(false);

    const statusForApi = React.useMemo(() => {
        if (statusFilter === 'refunded') return 'refunded';
        if (statusFilter === 'pending') return undefined; // computed client-side
        return undefined;
    }, [statusFilter]);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ debitNotes: rows }, kpiData] = await Promise.all([
                listDebitNotes({
                    page,
                    limit: DNS_PER_PAGE,
                    q: search || undefined,
                    vendorId: vendorFilter || undefined,
                    status: statusForApi as any,
                }),
                getDebitNoteKpis(),
            ]);
            let next = rows;
            if (statusFilter === 'pending') {
                next = next.filter(
                    (d) =>
                        (d.status || '').toLowerCase() !== 'refunded' &&
                        (d.status || '').toLowerCase() !== 'cancelled',
                );
            }
            if (reasonFilter) next = next.filter((d) => d.reason === reasonFilter);
            if (refundModeFilter) {
                next = next.filter((d) => d.refundMode === refundModeFilter);
            }
            if (dateRange?.from) {
                const from = dateRange.from.getTime();
                next = next.filter((d) =>
                    d.date ? new Date(d.date).getTime() >= from : true,
                );
            }
            if (dateRange?.to) {
                const to = dateRange.to.getTime();
                next = next.filter((d) =>
                    d.date ? new Date(d.date).getTime() <= to : true,
                );
            }
            setDebitNotes(next);
            setHasMore(rows.length === DNS_PER_PAGE);
            setKpis(kpiData);
        });
    }, [
        page,
        search,
        vendorFilter,
        statusFilter,
        statusForApi,
        reasonFilter,
        refundModeFilter,
        dateRange,
    ]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setVendorFilter('');
        setReasonFilter('');
        setRefundModeFilter('');
        setDateRange(undefined);
        setSearch('');
        setPage(1);
    }, []);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!vendorFilter ||
        !!reasonFilter ||
        !!refundModeFilter ||
        !!dateRange?.from ||
        !!dateRange?.to;

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
                all ? new Set(debitNotes.map((d) => String(d._id))) : new Set(),
            );
        },
        [debitNotes],
    );

    const confirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteDebitNoteAction(deleteTargetId);
        if (res.success) {
            toast({ title: 'Debit note deleted' });
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

    const runBulk = React.useCallback(
        async (op: 'archive' | 'delete' | 'refund') => {
            if (selected.size === 0) return;
            const ids = Array.from(selected);
            const res = await bulkDebitNoteAction(ids, op);
            if (res.success) {
                toast({
                    title: `${res.processed} debit note${res.processed === 1 ? '' : 's'} updated`,
                });
                setSelected(new Set());
                fetchData();
            } else {
                toast({
                    title: 'Bulk action failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [selected, fetchData, toast],
    );

    const exportCsv = React.useCallback(() => {
        const rows =
            selected.size > 0
                ? debitNotes.filter((d) => selected.has(String(d._id)))
                : debitNotes;
        const header = [
            'DN #',
            'Vendor',
            'Linked bill',
            'Date',
            'Reason',
            'Amount',
            'Currency',
            'Refund mode',
            'Status',
        ];
        const escape = (v: unknown) =>
            `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...rows.map((d) =>
                [
                    escape(d.dnNo),
                    escape(d.vendorId),
                    escape(d.linkedBillId),
                    escape(d.date),
                    escape(d.reason),
                    escape(d.totals?.total ?? 0),
                    escape(d.currency || 'INR'),
                    escape(d.refundMode),
                    escape(d.status || 'draft'),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debit-notes-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [debitNotes, selected]);

    return (
        <>
            <EntityListShell
                title="Debit Notes"
                subtitle="Adjust vendor bills downward for returns, discounts, or short-shipment."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search by DN #, notes, txn id…',
                }}
                primaryAction={
                    <ZoruButton asChild>
                        <Link href="/dashboard/crm/purchases/debit-notes/new">
                            <Plus className="h-4 w-4" /> New debit note
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <DebitNoteFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        vendorFilter={vendorFilter}
                        onVendorChange={(v) => {
                            setVendorFilter(v);
                            setPage(1);
                        }}
                        reasonFilter={reasonFilter}
                        onReasonChange={(v) => {
                            setReasonFilter(v);
                            setPage(1);
                        }}
                        refundModeFilter={refundModeFilter}
                        onRefundModeChange={(v) => {
                            setRefundModeFilter(v);
                            setPage(1);
                        }}
                        dateRange={dateRange}
                        onDateRangeChange={(r) => {
                            setDateRange(r);
                            setPage(1);
                        }}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <DebitNoteBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => runBulk('archive')}
                            onDelete={() => setBulkDelete(true)}
                            onRefund={() => runBulk('refund')}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && debitNotes.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <FileMinus className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No debit notes yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Adjust a vendor bill downward for a return or discount.
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/purchases/debit-notes/new">
                                    <Plus className="h-4 w-4" /> Add debit note
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isPending && debitNotes.length === 0}
                pagination={
                    debitNotes.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={DNS_PER_PAGE}
                            hasMore={hasMore}
                            controlled={{
                                onChange: (next) => setPage(next.page),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <DebitNoteKpiStrip
                        kpis={kpis}
                        statusFilter={statusFilter}
                        onClearAll={clearFilters}
                        onPickStatus={(s) => {
                            setStatusFilter((prev) => (prev === s ? 'all' : s));
                            setPage(1);
                        }}
                    />

                    <DebitNoteListClient
                        debitNotes={debitNotes}
                        loading={isPending}
                        selectedIds={selected}
                        onToggleOne={handleToggleOne}
                        onToggleAll={handleToggleAll}
                        onDelete={(id) => setDeleteTargetId(id)}
                    />
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this debit note permanently?"
                description="This permanently removes the debit note. The action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={confirmDelete}
            />

            <ConfirmDialog
                open={bulkDelete}
                onOpenChange={(o) => !o && setBulkDelete(false)}
                title={`Delete ${selected.size} debit note${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected debit notes. The action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={async () => {
                    await runBulk('delete');
                    setBulkDelete(false);
                }}
            />
        </>
    );
}
