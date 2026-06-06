'use client';

import { Button, useToast } from '@/components/sabcrm/20ui';
import {
  Plus,
  FileMinus } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import type { DateRange } from 'react-day-picker';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

/**
 * Credit Notes — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards) — Total CNs, Refunded, Pending refund,
 *       Linked invoice value.
 *     • Filter row (status, customer, reason, refund mode, date range).
 *     • Bulk action bar (archive · delete · export · mark refunded).
 *     • <CreditNoteListClient /> table.
 *     • Pagination.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    listCreditNotes,
    getCreditNoteKpis,
    bulkCreditNoteAction,
    deleteCreditNoteAction,
    type CreditNoteKpis,
} from '@/app/actions/crm/credit-notes.actions';
import type { CrmCreditNoteDoc } from '@/lib/rust-client/crm-credit-notes';

import {
    CreditNoteKpiStrip,
    type CreditNoteKpiFilter,
} from './_components/credit-note-kpi-strip';
import { CreditNoteListClient } from './_components/credit-note-list-client';
import { CreditNoteFiltersRow } from './_components/credit-note-filters';
import { CreditNoteBulkBar } from './_components/credit-note-bulk-bar';

const CNS_PER_PAGE = 20;

const EMPTY_KPIS: CreditNoteKpis = {
    totalCount: 0,
    refundedCount: 0,
    pendingRefundCount: 0,
    linkedInvoiceValue: 0,
    currency: 'INR',
};

export default function CreditNotesPage() {
    const { toast } = useToast();

    const [creditNotes, setCreditNotes] = React.useState<CrmCreditNoteDoc[]>([]);
    const [page, setPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<CreditNoteKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CreditNoteKpiFilter>('all');
    const [clientFilter, setClientFilter] = React.useState('');
    const [reasonFilter, setReasonFilter] = React.useState('');
    const [refundModeFilter, setRefundModeFilter] = React.useState('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

    // Selection + dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkDelete, setBulkDelete] = React.useState(false);

    const statusForApi = React.useMemo(() => {
        if (statusFilter === 'refunded') return 'refunded';
        if (statusFilter === 'pending') return 'pending';
        return undefined;
    }, [statusFilter]);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ creditNotes: rows, hasMore: more }, kpiData] = await Promise.all([
                listCreditNotes({
                    page,
                    limit: CNS_PER_PAGE,
                    q: search || undefined,
                    clientId: clientFilter || undefined,
                    status: statusForApi as any,
                }),
                getCreditNoteKpis(),
            ]);
            let next = rows;
            if (reasonFilter) next = next.filter((c) => c.reason === reasonFilter);
            if (refundModeFilter) next = next.filter((c) => c.refundMode === refundModeFilter);
            if (dateRange?.from) {
                const from = dateRange.from.getTime();
                next = next.filter((c) =>
                    c.date ? new Date(c.date).getTime() >= from : true,
                );
            }
            if (dateRange?.to) {
                const to = dateRange.to.getTime();
                next = next.filter((c) =>
                    c.date ? new Date(c.date).getTime() <= to : true,
                );
            }
            setCreditNotes(next);
            setHasMore(more);
            setKpis(kpiData);
        });
    }, [
        page,
        search,
        clientFilter,
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
        setClientFilter('');
        setReasonFilter('');
        setRefundModeFilter('');
        setDateRange(undefined);
        setSearch('');
        setPage(1);
    }, []);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!clientFilter ||
        !!reasonFilter ||
        !!refundModeFilter ||
        !!dateRange?.from ||
        !!dateRange?.to;

    // Selection
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
                all ? new Set(creditNotes.map((c) => String(c._id))) : new Set(),
            );
        },
        [creditNotes],
    );

    const confirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCreditNoteAction(deleteTargetId);
        if (res.success) {
            toast({ title: 'Credit note deleted' });
            fetchData();
        } else {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, fetchData, toast]);

    // Bulk
    const runBulk = React.useCallback(
        async (op: 'archive' | 'delete' | 'refund') => {
            if (selected.size === 0) return;
            const ids = Array.from(selected);
            const res = await bulkCreditNoteAction(ids, op);
            if (res.success) {
                toast({
                    title: `${res.processed} credit note${res.processed === 1 ? '' : 's'} updated`,
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
                ? creditNotes.filter((c) => selected.has(String(c._id)))
                : creditNotes;
        const header = [
            'CN #',
            'Customer',
            'Linked invoice',
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
            ...rows.map((c) =>
                [
                    escape(c.cnNo),
                    escape(c.clientId),
                    escape(c.linkedInvoiceId),
                    escape(c.date),
                    escape(c.reason),
                    escape(c.totals?.total ?? 0),
                    escape(c.currency || 'INR'),
                    escape(c.refundMode),
                    escape(c.status || 'draft'),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `credit-notes-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [creditNotes, selected]);

    return (
        <>
            <EntityListShell
                title="Credit Notes"
                subtitle="Issue refunds or credits to customers against prior invoices."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search by CN #, notes, txn id…',
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/sales/credit-notes/new">
                            <Plus className="h-4 w-4" /> New credit note
                        </Link>
                    </Button>
                }
                filters={
                    <CreditNoteFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        clientFilter={clientFilter}
                        onClientChange={(v) => {
                            setClientFilter(v);
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
                        <CreditNoteBulkBar
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
                    !isPending && creditNotes.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <FileMinus className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                No credit notes yet
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                Issue a refund or credit against a prior invoice.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/sales/credit-notes/new">
                                    <Plus className="h-4 w-4" /> Add credit note
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending && creditNotes.length === 0}
                pagination={
                    creditNotes.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={CNS_PER_PAGE}
                            hasMore={hasMore}
                            controlled={{
                                onChange: (next) => setPage(next.page),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <CreditNoteKpiStrip
                        kpis={kpis}
                        statusFilter={statusFilter}
                        onClearAll={clearFilters}
                        onPickStatus={(s) => {
                            setStatusFilter((prev) => (prev === s ? 'all' : s));
                            setPage(1);
                        }}
                    />

                    <CreditNoteListClient
                        creditNotes={creditNotes}
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
                title="Delete this credit note permanently?"
                description="This permanently removes the credit note. The action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={confirmDelete}
            />

            <ConfirmDialog
                open={bulkDelete}
                onOpenChange={(o) => !o && setBulkDelete(false)}
                title={`Delete ${selected.size} credit note${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected credit notes. The action cannot be undone."
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
