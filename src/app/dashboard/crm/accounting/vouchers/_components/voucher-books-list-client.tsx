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
import Papa from 'papaparse';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    bulkUpdateVoucherBooks,
    deleteVoucherBook,
    getVoucherBooks,
} from '@/app/actions/crm-vouchers.actions';

import { VoucherBooksKpiStrip, type VoucherBooksKpi } from './voucher-books-kpi-strip';
import {
    VoucherBooksFilters,
    VOUCHER_BOOK_FILTER_DEFAULT,
    type VoucherBookFilterState,
} from './voucher-books-filters';
import { VoucherBooksBulkBar } from './voucher-books-bulk-bar';
import { VoucherBooksTable } from './voucher-books-table';
import type { VoucherBookRow } from './types';

export function VoucherBooksListClient(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [rows, setRows] = React.useState<VoucherBookRow[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [filters, setFilters] = React.useState<VoucherBookFilterState>(VOUCHER_BOOK_FILTER_DEFAULT);
    const [search, setSearch] = React.useState('');
    const [selection, setSelection] = React.useState<Set<string>>(new Set());
    const [pendingRow, setPendingRow] = React.useState<VoucherBookRow | null>(null);
    const [confirmBulk, setConfirmBulk] = React.useState<'archive' | 'activate' | 'delete' | null>(null);
    const [isPending, startTransition] = React.useTransition();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        const books = await getVoucherBooks();
        const flat: VoucherBookRow[] = books.map((b) => ({
            _id: b._id.toString(),
            name: b.name,
            type: b.type,
            isDefault: b.isDefault,
            isActive: (b as { isActive?: boolean }).isActive,
            approvalRequired: (b as { approvalRequired?: boolean }).approvalRequired,
            prefix: (b as { prefix?: string }).prefix,
            suffix: (b as { suffix?: string }).suffix,
            startingNumber: (b as { startingNumber?: number }).startingNumber,
            padding: (b as { padding?: number }).padding,
            resetFrequency: (b as { resetFrequency?: VoucherBookRow['resetFrequency'] }).resetFrequency,
            entryCount: b.entryCount,
            lastEntryDate: b.lastEntryDate ? new Date(b.lastEntryDate).toISOString() : undefined,
            createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : undefined,
        }));
        setRows(flat);
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    /* ── Derived ─────────────────────────────────────────────────────── */

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (filters.type !== 'all' && r.type !== filters.type) return false;
            if (filters.status === 'active' && r.isActive === false) return false;
            if (filters.status === 'inactive' && r.isActive !== false) return false;
            if (filters.defaultOnly === 'yes' && !r.isDefault) return false;
            if (filters.defaultOnly === 'no' && r.isDefault) return false;
            if (filters.approval === 'yes' && !r.approvalRequired) return false;
            if (filters.approval === 'no' && r.approvalRequired) return false;
            if (!q) return true;
            return r.name.toLowerCase().includes(q);
        });
    }, [rows, filters, search]);

    const kpi = React.useMemo<VoucherBooksKpi>(() => {
        const byType: Record<string, number> = {};
        let active = 0;
        let pendingResets = 0;
        let entriesThisMonth = 0;
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        for (const r of rows) {
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
            totalCount: rows.length,
            byType,
            entriesThisMonth,
            pendingResets,
        };
    }, [rows]);

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
                'Last entry': r.lastEntryDate ? new Date(r.lastEntryDate).toLocaleDateString() : '',
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

    return (
        <>
            <div className="flex w-full flex-col gap-6">
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
                    loading={isLoading && rows.length === 0}
                >
                    <VoucherBooksTable
                        rows={filtered}
                        loading={isLoading}
                        selection={selection}
                        onToggle={handleToggle}
                        onToggleAll={handleToggleAll}
                        onDelete={setPendingRow}
                    />
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
