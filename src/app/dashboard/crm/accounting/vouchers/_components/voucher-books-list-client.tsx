'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  useZoruToast,
} from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * <VoucherBooksListClient> — orchestrates the Voucher Books list (§1D.1 bar):
 * KPI strip + filters + bulk bar + table + per-row delete confirm.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Papa from 'papaparse';
import { format } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    bulkUpdateVoucherBooks,
    deleteVoucherBook,
} from '@/app/actions/crm-vouchers.actions';
import { bulkApproveVouchers } from '../_actions/queries';

import { VoucherBooksKpiStrip, type VoucherBooksKpi } from './voucher-books-kpi-strip';
import {
    VoucherBooksFilters,
    VOUCHER_BOOK_FILTER_DEFAULT,
    type VoucherBookFilterState,
} from './voucher-books-filters';
import { VoucherBooksBulkBar } from './voucher-books-bulk-bar';
import { VoucherBooksTable } from './voucher-books-table';
import type { VoucherBookRow } from './types';

interface VoucherBooksListClientProps {
    initialRows: VoucherBookRow[];
    totalCount: number;
    searchParams: any;
    pendingVouchers: any[];
}

export function VoucherBooksListClient({ initialRows, totalCount, searchParams, pendingVouchers }: VoucherBooksListClientProps): React.JSX.Element {
    const { toast } = useZoruToast();
    const router = useRouter();
    const pathname = usePathname();

    const [selection, setSelection] = React.useState<Set<string>>(new Set());
    const [pendingRow, setPendingRow] = React.useState<VoucherBookRow | null>(null);
    const [confirmBulk, setConfirmBulk] = React.useState<'archive' | 'activate' | 'delete' | null>(null);
    const [isPending, startTransition] = React.useTransition();

    const filters: VoucherBookFilterState = {
        type: searchParams.type || 'all',
        status: searchParams.status || 'all',
        defaultOnly: searchParams.defaultOnly || 'all',
        approval: searchParams.approval || 'all',
    };
    const search = searchParams.search || '';

    const refresh = React.useCallback(() => {
        router.refresh();
    }, [router]);

    const setFilters = (next: VoucherBookFilterState) => {
        const params = new URLSearchParams(searchParams);
        if (next.type !== 'all') params.set('type', next.type); else params.delete('type');
        if (next.status !== 'all') params.set('status', next.status); else params.delete('status');
        if (next.defaultOnly !== 'all') params.set('defaultOnly', next.defaultOnly); else params.delete('defaultOnly');
        if (next.approval !== 'all') params.set('approval', next.approval); else params.delete('approval');
        params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`);
    };

    const setSearch = (value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value) params.set('search', value); else params.delete('search');
        params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`);
    };

    /* ── Derived ─────────────────────────────────────────────────────── */

    const filtered = initialRows;


    const kpi = React.useMemo<VoucherBooksKpi>(() => {
        const byType: Record<string, number> = {};
        let active = 0;
        let pendingResets = 0;
        let entriesThisMonth = 0;
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        for (const r of initialRows) {
            byType[r.type] = (byType[r.type] ?? 0) + 1;
            if (r.isActive !== false) active += 1;
            if (r.resetFrequency && r.resetFrequency !== 'none') pendingResets += 1;
            if (r.lastEntryDate) {
                const d = new Date(r.lastEntryDate);
                if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
                    entriesThisMonth += r.entryCount ?? 0;
                }
            }
        }

        return {
            activeCount: active,
            totalCount,
            byType,
            entriesThisMonth,
            pendingResets,
        };
    }, [initialRows, totalCount]);

    /* ── Handlers ────────────────────────────────────────────────────── */

    const handleToggle = React.useCallback((id: string) => {
        setSelection((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleToggleAll = React.useCallback((checked: boolean) => {
        setSelection(checked ? new Set(filtered.map((r) => r._id)) : new Set());
    }, [filtered]);

    const handleClearSelection = React.useCallback(() => setSelection(new Set()), []);

    const handleRowDelete = React.useCallback(() => {
        if (!pendingRow) return;
        startTransition(async () => {
            const result = await deleteVoucherBook(pendingRow._id);
            if (result.success) {
                toast({ title: 'Voucher book deleted' });
                setPendingRow(null);
                await refresh();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }, [pendingRow, refresh, toast]);

    const handleBulk = React.useCallback((op: 'archive' | 'activate' | 'delete') => {
        const ids = Array.from(selection);
        if (ids.length === 0) return;
        startTransition(async () => {
            const result = await bulkUpdateVoucherBooks(ids, op);
            if (result.success) {
                toast({ title: `Updated ${result.updated ?? 0} books.` });
                setSelection(new Set());
                setConfirmBulk(null);
                await refresh();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }, [selection, refresh, toast]);

    const handleExport = React.useCallback(() => {
        const ids = selection.size > 0 ? selection : null;
        const exportRows = ids ? filtered.filter((r) => ids.has(r._id)) : filtered;
        const csv = Papa.unparse(
            exportRows.map((r) => ({
                Name: r.name,
                Type: r.type,
                Prefix: r.prefix ?? '',
                'Starting #': r.startingNumber ?? '',
                Padding: r.padding ?? '',
                'Reset frequency': r.resetFrequency ?? 'none',
                'Is default': r.isDefault ? 'yes' : 'no',
                'Approval required': r.approvalRequired ? 'yes' : 'no',
                Active: r.isActive === false ? 'no' : 'yes',
                Entries: r.entryCount ?? 0,
                'Last entry': r.lastEntryDate ? format(new Date(r.lastEntryDate), 'dd MMM yyyy') : '',
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'voucher-books.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [filtered, selection]);

    const handleApprovePending = React.useCallback(() => {
        if (!pendingVouchers.length) return;
        startTransition(async () => {
            const ids = pendingVouchers.map(v => v._id);
            const result = await bulkApproveVouchers(ids);
            if (result.success) {
                toast({ title: 'Vouchers approved successfully' });
                refresh();
            } else {
                toast({ title: 'Error approving vouchers', description: result.error, variant: 'destructive' });
            }
        });
    }, [pendingVouchers, refresh, toast]);

    return (
        <>
            <div className="flex w-full flex-col gap-6">
                {pendingVouchers.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-amber-800 font-medium">Pending Vouchers</h3>
                            <p className="text-amber-700 text-sm">{pendingVouchers.length} voucher(s) require your approval.</p>
                        </div>
                        <Button onClick={handleApprovePending} disabled={isPending} variant="outline" className="bg-amber-100 text-amber-900 hover:bg-amber-200 border-amber-300">
                            Approve All
                        </Button>
                    </div>
                )}
                
                <VoucherBooksKpiStrip kpi={kpi} />

                <EntityListShell
                    title="Voucher Books"
                    subtitle="Manage your accounting voucher books and numbering schemes."
                    primaryAction={
                        <>
                            <Button variant="outline" onClick={handleExport}>
                                Export CSV
                            </Button>
                            <Button asChild>
                                <Link href="/dashboard/crm/accounting/vouchers/new">
                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> New Voucher Book
                                </Link>
                            </Button>
                        </>
                    }
                    search={{ value: search, onChange: setSearch, placeholder: 'Search voucher books…' }}
                    filters={<VoucherBooksFilters value={filters} onChange={setFilters} />}
                    bulkBar={
                        selection.size > 0 ? (
                            <VoucherBooksBulkBar
                                selectedCount={selection.size}
                                pending={isPending}
                                onArchive={() => setConfirmBulk('archive')}
                                onActivate={() => setConfirmBulk('activate')}
                                onDelete={() => setConfirmBulk('delete')}
                                onExport={handleExport}
                                onClear={handleClearSelection}
                            />
                        ) : null
                    }
                    loading={isPending}
                >
                    <VoucherBooksTable
                        rows={filtered}
                        loading={isPending}
                        selection={selection}
                        onToggle={handleToggle}
                        onToggleAll={handleToggleAll}
                        onDelete={setPendingRow}
                    />
                    {totalCount > filtered.length && (
                        <div className="py-4 text-center text-sm text-muted-foreground border-t">
                            Showing {filtered.length} of {totalCount} books.
                            <div className="mt-2 space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!searchParams.page || searchParams.page === '1'}
                                    onClick={() => {
                                        const p = new URLSearchParams(searchParams);
                                        p.set('page', String(Math.max(1, parseInt(p.get('page') || '1') - 1)));
                                        router.push(`${pathname}?${p.toString()}`);
                                    }}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const p = new URLSearchParams(searchParams);
                                        p.set('page', String(parseInt(p.get('page') || '1') + 1));
                                        router.push(`${pathname}?${p.toString()}`);
                                    }}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </EntityListShell>
            </div>

            <ZoruAlertDialog open={!!pendingRow} onOpenChange={(o) => !o && setPendingRow(null)}>
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete voucher book?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This deletes &ldquo;{pendingRow?.name}&rdquo;. Books with existing entries
                            cannot be deleted — archive instead.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleRowDelete} disabled={isPending}>
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            <ZoruAlertDialog open={!!confirmBulk} onOpenChange={(o) => !o && setConfirmBulk(null)}>
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            {confirmBulk === 'delete'
                                ? `Delete ${selection.size} book${selection.size === 1 ? '' : 's'}?`
                                : confirmBulk === 'archive'
                                  ? `Archive ${selection.size} book${selection.size === 1 ? '' : 's'}?`
                                  : `Activate ${selection.size} book${selection.size === 1 ? '' : 's'}?`}
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            {confirmBulk === 'delete'
                                ? 'Books with posted entries will be skipped. Archive them instead.'
                                : 'You can reverse this from the bulk bar at any time.'}
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={() => confirmBulk && handleBulk(confirmBulk)}
                            disabled={isPending}
                        >
                            Confirm
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
