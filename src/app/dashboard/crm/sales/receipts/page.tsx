'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  Plus,
  FileCheck } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import type { DateRange } from 'react-day-picker';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

/**
 * Payment Receipts — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards) — Received this month, Cleared, Bounced,
 *       Avg days to collect.
 *     • Saved-view presets (All · This month · Bounced · Pending clearance).
 *     • Filter row (status, customer, mode, bank account, date range).
 *     • Bulk action bar (archive · delete · export · status).
 *     • <ReceiptListClient /> table.
 *     • Pagination.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    listPaymentReceipts,
    getPaymentReceiptKpis,
    bulkPaymentReceiptAction,
    deletePaymentReceiptAction,
    requestReceiptsExport,
    type PaymentReceiptKpis,
} from '@/app/actions/crm/payment-receipts.actions';
import type { CrmPaymentReceiptDoc } from '@/lib/rust-client/crm-payment-receipts';

import { ReceiptKpiStrip, type ReceiptKpiFilter } from './_components/receipt-kpi-strip';
import {
    ReceiptListClient,
    type ReceiptListPreset,
} from './_components/receipt-list-client';
import { ReceiptFiltersRow } from './_components/receipt-filters';
import { ReceiptBulkBar } from './_components/receipt-bulk-bar';
import { ReceiptReconciliationView } from './_components/receipt-reconciliation-view';
import { RefreshCcw } from 'lucide-react';

const RECEIPTS_PER_PAGE = 20;

const EMPTY_KPIS: PaymentReceiptKpis = {
    receivedThisMonthTotal: 0,
    receivedThisMonthCount: 0,
    clearedCount: 0,
    bouncedCount: 0,
    avgDaysToCollect: 0,
    currency: 'INR',
};

export default function PaymentReceiptsPage() {
    const { toast } = useZoruToast();

    const [receipts, setReceipts] = React.useState<CrmPaymentReceiptDoc[]>([]);
    const [page, setPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<PaymentReceiptKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<ReceiptKpiFilter>('all');
    const [clientFilter, setClientFilter] = React.useState('');
    const [modeFilter, setModeFilter] = React.useState('');
    const [bankFilter, setBankFilter] = React.useState('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [activePreset, setActivePreset] = React.useState<ReceiptListPreset>('all');

    // Selection + dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkDelete, setBulkDelete] = React.useState(false);

    // View mode
    const [viewMode, setViewMode] = React.useState<'list' | 'reconcile'>('list');

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ receipts: rows, hasMore: more }, kpiData] = await Promise.all([
                listPaymentReceipts({
                    page,
                    limit: RECEIPTS_PER_PAGE,
                    q: search || undefined,
                    clientId: clientFilter || undefined,
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                }),
                getPaymentReceiptKpis(),
            ]);
            // Client-side filters for fields the BFF doesn't index.
            let next = rows;
            if (modeFilter) next = next.filter((r) => r.mode === modeFilter);
            if (bankFilter) next = next.filter((r) => r.bankAccountId === bankFilter);
            if (dateRange?.from) {
                const from = dateRange.from.getTime();
                next = next.filter((r) =>
                    r.date ? new Date(r.date).getTime() >= from : true,
                );
            }
            if (dateRange?.to) {
                const to = dateRange.to.getTime();
                next = next.filter((r) =>
                    r.date ? new Date(r.date).getTime() <= to : true,
                );
            }
            setReceipts(next);
            setHasMore(more);
            setKpis(kpiData);
        });
    }, [
        page,
        search,
        clientFilter,
        statusFilter,
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
        setClientFilter('');
        setModeFilter('');
        setBankFilter('');
        setDateRange(undefined);
        setSearch('');
        setPage(1);
        setActivePreset('all');
    }, []);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!clientFilter ||
        !!modeFilter ||
        !!bankFilter ||
        !!dateRange?.from ||
        !!dateRange?.to ||
        activePreset !== 'all';

    const applyPreset = React.useCallback((preset: ReceiptListPreset) => {
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
        if (preset === 'bounced') {
            setStatusFilter('bounced');
            setDateRange(undefined);
            return;
        }
        if (preset === 'pending_clearance') {
            // Pending = mode=cheque + status=received
            setModeFilter('cheque');
            setStatusFilter('all');
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
            setSelected(all ? new Set(receipts.map((r) => String(r._id))) : new Set());
        },
        [receipts],
    );

    // Single delete
    const confirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deletePaymentReceiptAction(deleteTargetId);
        if (res.success) {
            toast({ title: 'Receipt deleted' });
            fetchData();
        } else {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, fetchData, toast]);

    // Bulk
    const runBulk = React.useCallback(
        async (op: 'archive' | 'delete' | 'status', payload?: string) => {
            if (selected.size === 0) return;
            const ids = Array.from(selected);
            const res = await bulkPaymentReceiptAction(ids, op, payload);
            if (res.success) {
                toast({
                    title: `${res.processed} receipt${res.processed === 1 ? '' : 's'} updated`,
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

    const exportCsv = React.useCallback(async () => {
        if (selected.size > 0) {
            // Client-side export for selected items
            const rows = receipts.filter((r) => selected.has(String(r._id)));
            const header = [
                'Receipt #',
                'Date',
                'Customer',
                'Mode',
                'Bank',
                'Reference',
                'Amount',
                'Currency',
                'Status',
                'Applied invoices',
            ];
            const escape = (v: unknown) =>
                `"${String(v ?? '').replace(/"/g, '""')}"`;
            const csv = [
                header.join(','),
                ...rows.map((r) =>
                    [
                        escape(r.receiptNo),
                        escape(r.date),
                        escape(r.clientId),
                        escape(r.mode),
                        escape(r.bankAccountId),
                        escape(r.chequeNo || r.txnId || r.reference || ''),
                        escape(r.amount ?? 0),
                        escape(r.currency || 'INR'),
                        escape(r.status || 'received'),
                        escape(r.applyTo?.length ?? 0),
                    ].join(','),
                ),
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payment-receipts-selected-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            return;
        }

        // Background export for all filtered items
        toast({ title: 'Export started', description: 'Generating CSV in the background. It will download automatically when ready.' });
        const res = await requestReceiptsExport({ clientId: clientFilter || undefined, status: statusFilter });
        if (res.success && res.csvData) {
            const blob = new Blob([res.csvData], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payment-receipts-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: 'Export complete', description: 'Your file has been downloaded.' });
        } else {
            toast({ title: 'Export failed', description: res.error || 'Unknown error occurred.', variant: 'destructive' });
        }
    }, [receipts, selected, clientFilter, statusFilter, toast]);

    return (
        <>
            <EntityListShell
                title="Payment Receipts"
                subtitle="Record and reconcile payments received from clients."
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search by receipt #, reference, txn id…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <Button 
                            variant={viewMode === 'reconcile' ? 'secondary' : 'outline'} 
                            onClick={() => {
                                setViewMode(prev => prev === 'reconcile' ? 'list' : 'reconcile');
                                if (viewMode === 'list') {
                                    // When entering reconcile mode, optionally pre-filter
                                    setStatusFilter('received');
                                    setPage(1);
                                }
                            }}
                        >
                            <RefreshCcw className="h-4 w-4" /> 
                            {viewMode === 'reconcile' ? 'Exit Reconcile' : 'Reconcile'}
                        </Button>
                        <Button asChild>
                            <Link href="/dashboard/crm/sales/receipts/new">
                                <Plus className="h-4 w-4" /> New Receipt
                            </Link>
                        </Button>
                        <Button variant="outline" onClick={exportCsv} disabled={isPending}>
                            Export CSV
                        </Button>
                    </div>
                }
                filters={
                    <ReceiptFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setActivePreset('all');
                            setPage(1);
                        }}
                        clientFilter={clientFilter}
                        onClientChange={(v) => {
                            setClientFilter(v);
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
                        <ReceiptBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => runBulk('archive')}
                            onDelete={() => setBulkDelete(true)}
                            onMarkCleared={() => runBulk('status', 'cleared')}
                            onMarkBounced={() => runBulk('status', 'bounced')}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && receipts.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <FileCheck className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No payment receipts yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Record your first payment received from a customer.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/sales/receipts/new">
                                    <Plus className="h-4 w-4" /> Add first receipt
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending && receipts.length === 0}
                pagination={
                    receipts.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={RECEIPTS_PER_PAGE}
                            hasMore={hasMore}
                            controlled={{
                                onChange: (next) => setPage(next.page),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {viewMode === 'list' ? (
                        <>
                            <ReceiptKpiStrip
                                kpis={kpis}
                                statusFilter={statusFilter}
                                onClearAll={clearFilters}
                                onPickStatus={(s) => {
                                    setStatusFilter((prev) => (prev === s ? 'all' : s));
                                    setActivePreset('all');
                                    setPage(1);
                                }}
                            />

                            <ReceiptListClient
                                receipts={receipts}
                                loading={isPending}
                                selectedIds={selected}
                                onToggleOne={handleToggleOne}
                                onToggleAll={handleToggleAll}
                                onDelete={(id) => setDeleteTargetId(id)}
                            />
                        </>
                    ) : (
                        <ReceiptReconciliationView 
                            receipts={receipts}
                            loading={isPending}
                            onStatusUpdated={fetchData}
                        />
                    )}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this receipt permanently?"
                description="This permanently removes the payment receipt. The action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={confirmDelete}
            />

            <ConfirmDialog
                open={bulkDelete}
                onOpenChange={(o) => !o && setBulkDelete(false)}
                title={`Delete ${selected.size} receipt${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected payment receipts. The action cannot be undone."
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
