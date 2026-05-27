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
import {
  useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid,
  Plus,
  TreePine } from 'lucide-react';
import Papa from 'papaparse';

/**
 * <CoaListClient> — orchestrates the Chart of Accounts list (§1D.1 bar):
 * KPI strip + filters + bulk bar + table/tree switcher + per-row delete.
 *
 * Data is fetched once on mount (and on bulk-op completion). Filtering /
 * grouping happens in-memory because CoA lists are bounded — even a
 * mature tenant rarely exceeds ~500 accounts.
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    bulkUpdateCrmChartOfAccounts,
    deleteCrmChartOfAccount,
    getCrmAccountGroups,
    getCrmChartOfAccountsWithBalances,
} from '@/app/actions/crm-accounting.actions';

import { CoaKpiStrip, type CoaKpiSnapshot, type CoaNatureFilter } from './coa-kpi-strip';
import { CoaFilters, COA_FILTER_DEFAULT, type CoaFilterState } from './coa-filters';
import { CoaBulkBar } from './coa-bulk-bar';
import { CoaTable } from './coa-table';
import { CoaTree } from './coa-tree';
import type { CoaRow, CoaViewMode } from './types';

function downloadCsv(rows: CoaRow[]) {
    const csv = Papa.unparse(
        rows.map((r) => ({
            Code: r.code ?? '',
            Name: r.name,
            Nature: r.accountGroupType ?? '',
            'Sub-nature': r.accountGroupCategory?.replace(/_/g, ' ') ?? '',
            'Parent group': r.accountGroupName ?? '',
            'Opening balance': `${r.openingBalance} ${r.balanceType}`,
            'Current balance':
                r.currentBalance != null ? `${r.currentBalance} ${r.currentBalanceType}` : '',
            Currency: r.currency,
            Status: r.status,
        })),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'chart-of-accounts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function CoaListClient(): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();

    const [rows, setRows] = React.useState<CoaRow[]>([]);
    const [groups, setGroups] = React.useState<{ _id: string; name: string; type: string }[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [filters, setFilters] = React.useState<CoaFilterState>(COA_FILTER_DEFAULT);
    const [search, setSearch] = React.useState('');
    const [view, setView] = React.useState<CoaViewMode>('table');
    const [selection, setSelection] = React.useState<Set<string>>(new Set());
    const [pendingRow, setPendingRow] = React.useState<CoaRow | null>(null);
    const [confirmBulk, setConfirmBulk] = React.useState<'archive' | 'activate' | 'delete' | null>(null);
    const [isPending, startTransition] = React.useTransition();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        const [accounts, gs] = await Promise.all([
            getCrmChartOfAccountsWithBalances(),
            getCrmAccountGroups(),
        ]);
        setRows(accounts as unknown as CoaRow[]);
        setGroups(gs.map((g) => ({ _id: g._id.toString(), name: g.name, type: g.type })));
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    /* ── Derived data ────────────────────────────────────────────────── */

    const subNatures = React.useMemo(() => {
        const set = new Set<string>();
        for (const r of rows) {
            if (r.accountGroupCategory) set.add(r.accountGroupCategory);
        }
        return Array.from(set).sort();
    }, [rows]);

    const currencies = React.useMemo(() => {
        const set = new Set<string>();
        for (const r of rows) if (r.currency) set.add(r.currency);
        return Array.from(set).sort();
    }, [rows]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (filters.nature !== 'all' && r.accountGroupType !== filters.nature) return false;
            if (filters.subNature !== 'all' && r.accountGroupCategory !== filters.subNature) return false;
            if (filters.groupId !== 'all' && r.accountGroupId !== filters.groupId) return false;
            if (filters.currency !== 'all' && r.currency !== filters.currency) return false;
            if (filters.status !== 'all' && r.status !== filters.status) return false;
            if (q) {
                const hay = `${r.name} ${r.code ?? ''} ${r.accountGroupName ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [rows, filters, search]);

    const kpi = React.useMemo<CoaKpiSnapshot>(() => {
        // Aggregate over the unfiltered set so KPIs always reflect the tenant total.
        let assets = 0;
        let liabilities = 0;
        let income = 0;
        let expense = 0;
        for (const r of rows) {
            const v = r.currentBalance ?? r.openingBalance;
            const signed = (r.currentBalanceType ?? r.balanceType) === 'Cr' ? -v : v;
            switch (r.accountGroupType) {
                case 'Asset':
                    assets += signed;
                    break;
                case 'Liability':
                    liabilities += -signed;
                    break;
                case 'Income':
                    income += -signed;
                    break;
                case 'Expense':
                    expense += signed;
                    break;
                default:
                    break;
            }
        }
        return {
            totalAccounts: rows.length,
            assetsTotal: assets,
            liabilitiesTotal: liabilities,
            incomeYtd: income,
            expenseYtd: expense,
        };
    }, [rows]);

    const displayCurrency = currencies[0] ?? 'INR';

    /* ── Handlers ────────────────────────────────────────────────────── */

    const handleKpiSelect = React.useCallback((nature: CoaNatureFilter) => {
        setFilters((prev) => ({ ...prev, nature: nature === 'all' ? 'all' : nature, subNature: 'all', groupId: 'all' }));
    }, []);

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

    const handleRowDelete = React.useCallback(async () => {
        if (!pendingRow) return;
        startTransition(async () => {
            const result = await deleteCrmChartOfAccount(pendingRow._id);
            if (result.success) {
                toast({ title: 'Account deleted' });
                setPendingRow(null);
                await refresh();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }, [pendingRow, refresh, toast]);

    const handleBulk = React.useCallback(async (op: 'archive' | 'activate' | 'delete') => {
        const ids = Array.from(selection);
        if (ids.length === 0) return;
        startTransition(async () => {
            const result = await bulkUpdateCrmChartOfAccounts(ids, op);
            if (result.success) {
                toast({ title: `Updated ${result.updated ?? 0} accounts.` });
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
        downloadCsv(exportRows);
    }, [filtered, selection]);

    /* ── Render ──────────────────────────────────────────────────────── */

    const viewSwitcher = (
        <div className="inline-flex rounded-md border border-zoru-line">
            <button
                type="button"
                aria-label="Table view"
                aria-pressed={view === 'table'}
                onClick={() => setView('table')}
                className={[
                    'px-2.5 py-1.5 text-[12px]',
                    view === 'table' ? 'bg-zoru-surface-2 text-zoru-ink' : 'text-zoru-ink-muted hover:text-zoru-ink',
                ].join(' ')}
            >
                <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                aria-label="Tree view"
                aria-pressed={view === 'tree'}
                onClick={() => setView('tree')}
                className={[
                    'border-l border-zoru-line px-2.5 py-1.5 text-[12px]',
                    view === 'tree' ? 'bg-zoru-surface-2 text-zoru-ink' : 'text-zoru-ink-muted hover:text-zoru-ink',
                ].join(' ')}
            >
                <TreePine className="h-3.5 w-3.5" />
            </button>
        </div>
    );

    return (
        <>
            <div className="flex w-full flex-col gap-6">
                <CoaKpiStrip kpi={kpi} currency={displayCurrency} active={filters.nature} onSelect={handleKpiSelect} />

                <EntityListShell
                    title="Chart of Accounts"
                    subtitle="Manage your company's financial accounts."
                    primaryAction={
                        <>
                            <Button asChild variant="outline">
                                <Link href="/dashboard/crm/accounting/groups">Account groups</Link>
                            </Button>
                            <Button onClick={handleExport} variant="outline">
                                Export CSV
                            </Button>
                            <Button asChild>
                                <Link href="/dashboard/crm/accounting/charts/new">
                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> New Account
                                </Link>
                            </Button>
                        </>
                    }
                    search={{ value: search, onChange: setSearch, placeholder: 'Search accounts…' }}
                    viewSwitcher={viewSwitcher}
                    filters={
                        <CoaFilters
                            value={filters}
                            onChange={setFilters}
                            groups={groups}
                            subNatures={subNatures}
                            currencies={currencies}
                        />
                    }
                    bulkBar={
                        selection.size > 0 ? (
                            <CoaBulkBar
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
                    {view === 'table' ? (
                        <CoaTable
                            rows={filtered}
                            loading={isLoading}
                            selection={selection}
                            onToggle={handleToggle}
                            onToggleAll={handleToggleAll}
                            onDelete={setPendingRow}
                        />
                    ) : (
                        <CoaTree rows={filtered} />
                    )}
                </EntityListShell>
            </div>

            {/* Delete single */}
            <ZoruAlertDialog open={!!pendingRow} onOpenChange={(o) => !o && setPendingRow(null)}>
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete account?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This permanently removes &ldquo;{pendingRow?.name}&rdquo;. Voucher entries already posted
                            against it will remain — but the account label will read as deleted.
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

            {/* Bulk confirm */}
            <ZoruAlertDialog open={!!confirmBulk} onOpenChange={(o) => !o && setConfirmBulk(null)}>
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            {confirmBulk === 'delete'
                                ? `Delete ${selection.size} account${selection.size === 1 ? '' : 's'}?`
                                : confirmBulk === 'archive'
                                  ? `Archive ${selection.size} account${selection.size === 1 ? '' : 's'}?`
                                  : `Activate ${selection.size} account${selection.size === 1 ? '' : 's'}?`}
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            {confirmBulk === 'delete'
                                ? 'Delete is permanent — make sure none of these accounts have posted vouchers.'
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
