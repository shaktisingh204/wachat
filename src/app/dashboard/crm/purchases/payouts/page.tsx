'use client';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Plus,
  Wallet } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import type { DateRange } from 'react-day-picker';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

/**
 * Payouts — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards) — Paid this month, Cleared, Failed, Pending.
 *     • Saved-view presets (All · This month · Failed · Pending clearance).
 *     • Filter row (status, vendor, mode, bank account, date range).
 *     • Bulk action bar (archive · delete · export · mark cleared · mark failed).
 *     • <PayoutListClient /> table.
 *     • Pagination.
 *
 * Buy-side mirror of the Receipts list shell.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    listPayouts,
    getPayoutKpis,
    bulkPayoutAction,
    deletePayoutAction,
    type PayoutKpis,
} from '@/app/actions/crm/payouts.actions';
import type { CrmPayoutDoc } from '@/lib/rust-client/crm-payouts';

import { PayoutKpiStrip, type PayoutKpiFilter } from './_components/payout-kpi-strip';
import { PayoutListClient } from './_components/payout-list-client';
import {
    PayoutFiltersRow,
    type PayoutListPreset,
} from './_components/payout-filters';
import { PayoutBulkBar } from './_components/payout-bulk-bar';

const PAYOUTS_PER_PAGE = 20;

const EMPTY_KPIS: PayoutKpis = {
    paidThisMonthTotal: 0,
    paidThisMonthCount: 0,
    clearedCount: 0,
    failedCount: 0,
    pendingCount: 0,
    currency: 'INR',
};

export default function PayoutsPage() {
    const { toast } = useToast();

    const [payouts, setPayouts] = React.useState<CrmPayoutDoc[]>([]);
    const [page, setPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<PayoutKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<PayoutKpiFilter>('all');
    const [vendorFilter, setVendorFilter] = React.useState('');
    const [modeFilter, setModeFilter] = React.useState('');
    const [bankFilter, setBankFilter] = React.useState('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [activePreset, setActivePreset] = React.useState<PayoutListPreset>('all');

    // Selection + dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkDelete, setBulkDelete] = React.useState(false);

    const statusForApi = React.useMemo(() => {
        if (statusFilter === 'cleared') return 'cleared';
        if (statusFilter === 'failed') return 'failed';
        // 'pending' is mapped client-side (Rust has 'sent' as the
        // pre-cleared state, which we surface as Pending in the UI).
        return undefined;
    }, [statusFilter]);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ payouts: rows }, kpiData] = await Promise.all([
                listPayouts({
                    page,
                    limit: PAYOUTS_PER_PAGE,
                    q: search || undefined,
                    vendorId: vendorFilter || undefined,
                    status: statusForApi,
                }),
                getPayoutKpis(),
            ]);
            // Client-side filters for fields the BFF doesn't index.
            let next = rows;
            if (statusFilter === 'pending') {
                next = next.filter((p) => {
                    const s = (p.status || 'sent').toLowerCase();
                    return s !== 'cleared' && s !== 'failed';
                });
            }
            if (modeFilter) next = next.filter((p) => p.mode === modeFilter);
            if (bankFilter) next = next.filter((p) => p.bankAccountId === bankFilter);
            if (dateRange?.from) {
                const from = dateRange.from.getTime();
                next = next.filter((p) =>
                    p.date ? new Date(p.date).getTime() >= from : true,
                );
            }
            if (dateRange?.to) {
                const to = dateRange.to.getTime();
                next = next.filter((p) =>
                    p.date ? new Date(p.date).getTime() <= to : true,
                );
            }
            setPayouts(next);
            setHasMore(rows.length === PAYOUTS_PER_PAGE);
            setKpis(kpiData);
        });
    }, [
        page,
        search,
        vendorFilter,
        statusFilter,
        statusForApi,
        modeFilter,
        bankFilter,
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
        setModeFilter('');
        setBankFilter('');
        setDateRange(undefined);
        setSearch('');
        setPage(1);
        setActivePreset('all');
    }, []);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!vendorFilter ||
        !!modeFilter ||
        !!bankFilter ||
        !!dateRange?.from ||
        !!dateRange?.to ||
        activePreset !== 'all';

    const applyPreset = React.useCallback((preset: PayoutListPreset) => {
        setActivePreset(preset);
        setPage(1);
        if (preset === 'all') {
            setStatusFilter('all');
            setDateRange(undefined);
            return;
        }
        if (preset === 'this_month') {
            const now = new Date();
            const from = new Date(now.getFullYear(), now.getMonth(), 1);
            const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setDateRange({ from, to });
            setStatusFilter('all');
            return;
        }
        if (preset === 'failed') {
            setStatusFilter('failed');
            setDateRange(undefined);
            return;
        }
        if (preset === 'pending_clearance') {
            // Pending = mode=cheque + status=sent (i.e. pending bank
            // clearance for issued cheques).
            setModeFilter('cheque');
            setStatusFilter('pending');
            setDateRange(undefined);
            return;
        }
    }, []);

    // Row selection
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
            setSelected(all ? new Set(payouts.map((p) => String(p._id))) : new Set());
        },
        [payouts],
    );

    // Single delete
    const confirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deletePayoutAction(deleteTargetId);
        if (res.success) {
            toast({ title: 'Payout deleted' });
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

    // Bulk
    const runBulk = React.useCallback(
        async (op: 'archive' | 'delete' | 'status', payload?: string) => {
            if (selected.size === 0) return;
            const ids = Array.from(selected);
            const res = await bulkPayoutAction(ids, op, payload);
            if (res.success) {
                toast({
                    title: `${res.processed} payout${res.processed === 1 ? '' : 's'} updated`,
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
                ? payouts.filter((p) => selected.has(String(p._id)))
                : payouts;
        const header = [
            'Payment #',
            'Date',
            'Vendor',
            'Mode',
            'Bank',
            'Reference',
            'Amount',
            'Currency',
            'Status',
            'Applied bills',
        ];
        const escape = (v: unknown) =>
            `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...rows.map((p) =>
                [
                    escape(p.paymentNo),
                    escape(p.date),
                    escape(p.vendorId),
                    escape(p.mode),
                    escape(p.bankAccountId),
                    escape(p.chequeNo || p.txnId || p.reference || ''),
                    escape(p.amount ?? 0),
                    escape(p.currency || 'INR'),
                    escape(p.status || 'sent'),
                    escape(p.applyTo?.length ?? 0),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payouts-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [payouts, selected]);

    return (
        <>
            <EntityListShell
                title="Payouts"
                subtitle="Record and reconcile payments made to vendors."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search by payment #, reference, txn id…',
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/purchases/payouts/new">
                            <Plus className="h-4 w-4" /> New payout
                        </Link>
                    </Button>
                }
                filters={
                    <PayoutFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setActivePreset('all');
                            setPage(1);
                        }}
                        vendorFilter={vendorFilter}
                        onVendorChange={(v) => {
                            setVendorFilter(v);
                            setActivePreset('all');
                            setPage(1);
                        }}
                        modeFilter={modeFilter}
                        onModeChange={(v) => {
                            setModeFilter(v);
                            setActivePreset('all');
                            setPage(1);
                        }}
                        bankFilter={bankFilter}
                        onBankChange={(v) => {
                            setBankFilter(v);
                            setActivePreset('all');
                            setPage(1);
                        }}
                        dateRange={dateRange}
                        onDateRangeChange={(r) => {
                            setDateRange(r);
                            setActivePreset('all');
                            setPage(1);
                        }}
                        activePreset={activePreset}
                        onSelectPreset={applyPreset}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <PayoutBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => runBulk('archive')}
                            onDelete={() => setBulkDelete(true)}
                            onMarkCleared={() => runBulk('status', 'cleared')}
                            onMarkFailed={() => runBulk('status', 'failed')}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && payouts.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Wallet className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                No payouts yet
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                Record your first payment made to a vendor.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/purchases/payouts/new">
                                    <Plus className="h-4 w-4" /> Add first payout
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending && payouts.length === 0}
                pagination={
                    payouts.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={PAYOUTS_PER_PAGE}
                            hasMore={hasMore}
                            controlled={{
                                onChange: (next) => setPage(next.page),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <PayoutKpiStrip
                        kpis={kpis}
                        statusFilter={statusFilter}
                        onClearAll={clearFilters}
                        onPickStatus={(s) => {
                            setStatusFilter((prev) => (prev === s ? 'all' : s));
                            setActivePreset('all');
                            setPage(1);
                        }}
                    />

                    <PayoutListClient
                        payouts={payouts}
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
                title="Delete this payout permanently?"
                description="This permanently removes the payout. The action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={confirmDelete}
            />

            <ConfirmDialog
                open={bulkDelete}
                onOpenChange={(o) => !o && setBulkDelete(false)}
                title={`Delete ${selected.size} payout${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected payouts. The action cannot be undone."
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
