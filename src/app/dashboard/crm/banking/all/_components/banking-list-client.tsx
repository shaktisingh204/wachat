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
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * <BankingListClient> — Banking landing page (§1D bar — thin).
 * KPI strip + filters + tabs (Bank Accounts | Employee Accounts) + bulk.
 */

import * as React from 'react';
import Link from 'next/link';
import Papa from 'papaparse';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    bulkUpdateCrmPaymentAccounts,
    deleteCrmPaymentAccount,
    getCrmPaymentAccounts,
} from '@/app/actions/crm-payment-accounts.actions';

import { BankingKpiStrip, type BankingKpi } from './banking-kpi-strip';
import { PaymentAccountsTable } from './payment-accounts-table';
import type { PaymentAccountRow } from './types';

type Tab = 'bank' | 'employee' | 'cash' | 'wallet' | 'other' | 'all';

interface FiltersState {
    typeFilter: 'all' | 'bank' | 'cash' | 'employee' | 'wallet' | 'other';
    currency: string;
    status: 'all' | 'active' | 'inactive';
    defaultOnly: 'all' | 'yes' | 'no';
}

const DEFAULT_FILTERS: FiltersState = {
    typeFilter: 'all',
    currency: 'all',
    status: 'all',
    defaultOnly: 'all',
};

export function BankingListClient(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [rows, setRows] = React.useState<PaymentAccountRow[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [tab, setTab] = React.useState<Tab>('bank');
    const [filters, setFilters] = React.useState<FiltersState>(DEFAULT_FILTERS);
    const [search, setSearch] = React.useState('');
    const [selection, setSelection] = React.useState<Set<string>>(new Set());
    const [pendingRow, setPendingRow] = React.useState<PaymentAccountRow | null>(null);
    const [confirmBulk, setConfirmBulk] = React.useState<'archive' | 'activate' | 'delete' | null>(null);
    const [isPending, startTransition] = React.useTransition();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        const data = await getCrmPaymentAccounts();
        setRows(
            data.map(
                (d) =>
                    ({
                        _id: d._id.toString(),
                        accountName: d.accountName,
                        accountType: d.accountType,
                        status: d.status,
                        openingBalance: d.openingBalance,
                        openingBalanceDate: d.openingBalanceDate ? new Date(d.openingBalanceDate).toISOString() : undefined,
                        isDefault: d.isDefault,
                        currency: d.currency,
                        bankDetails: d.bankDetails,
                        currentBalance: (d as { currentBalance?: number }).currentBalance,
                    }) satisfies PaymentAccountRow,
            ),
        );
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    /* ── Derived ─────────────────────────────────────────────────────── */

    const currencies = React.useMemo(() => {
        const set = new Set<string>();
        for (const r of rows) if (r.currency) set.add(r.currency);
        return Array.from(set).sort();
    }, [rows]);

    const visibleByTab = React.useMemo(() => {
        return rows.filter((r) => {
            if (tab === 'employee') return r.accountType === 'employee';
            if (tab === 'bank') return r.accountType === 'bank';
            if (tab === 'all') return true;
            return r.accountType === tab;
        });
    }, [rows, tab]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return visibleByTab.filter((r) => {
            if (filters.typeFilter !== 'all' && r.accountType !== filters.typeFilter) return false;
            if (filters.currency !== 'all' && r.currency !== filters.currency) return false;
            if (filters.status !== 'all' && r.status !== filters.status) return false;
            if (filters.defaultOnly === 'yes' && !r.isDefault) return false;
            if (filters.defaultOnly === 'no' && r.isDefault) return false;
            if (!q) return true;
            return `${r.accountName} ${r.bankDetails?.bankName ?? ''}`.toLowerCase().includes(q);
        });
    }, [visibleByTab, filters, search]);

    const kpi = React.useMemo<BankingKpi>(() => {
        let total = 0;
        let active = 0;
        const sumByCurrency = new Map<string, number>();
        for (const r of rows) {
            total += 1;
            if (r.status === 'active') active += 1;
            const v = r.currentBalance ?? r.openingBalance ?? 0;
            sumByCurrency.set(r.currency, (sumByCurrency.get(r.currency) ?? 0) + v);
        }
        // Pick the largest balance bucket for the strip's display currency.
        let displayCurrency = 'INR';
        let displayTotal = 0;
        for (const [c, v] of sumByCurrency.entries()) {
            if (Math.abs(v) > Math.abs(displayTotal)) {
                displayTotal = v;
                displayCurrency = c;
            }
        }
        return {
            totalAccounts: total,
            activeAccounts: active,
            totalBalance: displayTotal,
            currency: displayCurrency,
            lastReconciledLabel: '—',
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

    const handleToggleAll = React.useCallback(
        (checked: boolean) => setSelection(checked ? new Set(filtered.map((r) => r._id)) : new Set()),
        [filtered],
    );

    const handleRowDelete = React.useCallback(() => {
        if (!pendingRow) return;
        startTransition(async () => {
            const result = await deleteCrmPaymentAccount(pendingRow._id);
            if (result.success) {
                toast({ title: 'Account deleted' });
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
            const result = await bulkUpdateCrmPaymentAccounts(ids, op);
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
        const csv = Papa.unparse(
            exportRows.map((r) => ({
                Name: r.accountName,
                Type: r.accountType,
                Bank: r.bankDetails?.bankName ?? '',
                'Account #': r.bankDetails?.accountNumber ?? '',
                IFSC: r.bankDetails?.ifsc ?? '',
                Currency: r.currency,
                Balance: r.currentBalance ?? r.openingBalance ?? 0,
                Default: r.isDefault ? 'yes' : 'no',
                Status: r.status,
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'payment-accounts.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [filtered, selection]);

    /* ── Render ──────────────────────────────────────────────────────── */

    return (
        <>
            <div className="flex w-full flex-col gap-6">
                <BankingKpiStrip kpi={kpi} />

                <div className="inline-flex w-full overflow-x-auto rounded-md border border-border">
                    <TabButton active={tab === 'bank'} onClick={() => setTab('bank')}>
                        Bank Accounts ({rows.filter((r) => r.accountType === 'bank').length})
                    </TabButton>
                    <TabButton active={tab === 'employee'} onClick={() => setTab('employee')}>
                        Employee Accounts ({rows.filter((r) => r.accountType === 'employee').length})
                    </TabButton>
                    <TabButton active={tab === 'cash'} onClick={() => setTab('cash')}>
                        Cash ({rows.filter((r) => r.accountType === 'cash').length})
                    </TabButton>
                    <TabButton active={tab === 'wallet'} onClick={() => setTab('wallet')}>
                        Wallet ({rows.filter((r) => r.accountType === 'wallet').length})
                    </TabButton>
                    <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
                        All ({rows.length})
                    </TabButton>
                </div>

                <EntityListShell
                    title="Banking"
                    subtitle="Manage your bank, employee, cash and wallet accounts."
                    primaryAction={
                        <>
                            <Button asChild variant="outline">
                                <Link href="/dashboard/crm/banking/bank-transactions">Transactions</Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href="/dashboard/crm/banking/reconciliation">Reconcile</Link>
                            </Button>
                            <Button onClick={handleExport} variant="outline">
                                Export CSV
                            </Button>
                            <Button asChild>
                                <Link href="/dashboard/crm/banking/all/new">
                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Account
                                </Link>
                            </Button>
                        </>
                    }
                    search={{ value: search, onChange: setSearch, placeholder: 'Search accounts…' }}
                    filters={
                        <div className="flex flex-wrap items-center gap-2">
                            <Select
                                value={filters.currency}
                                onValueChange={(v) => setFilters({ ...filters, currency: v })}
                            >
                                <ZoruSelectTrigger className="h-9 w-[150px]">
                                    <ZoruSelectValue placeholder="Currency" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="all">All currencies</ZoruSelectItem>
                                    {currencies.map((c) => (
                                        <ZoruSelectItem key={c} value={c}>
                                            {c}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                            <Select
                                value={filters.status}
                                onValueChange={(v) => setFilters({ ...filters, status: v as FiltersState['status'] })}
                            >
                                <ZoruSelectTrigger className="h-9 w-[150px]">
                                    <ZoruSelectValue placeholder="Status" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="all">All status</ZoruSelectItem>
                                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                                    <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                            <Select
                                value={filters.defaultOnly}
                                onValueChange={(v) =>
                                    setFilters({ ...filters, defaultOnly: v as FiltersState['defaultOnly'] })
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[160px]">
                                    <ZoruSelectValue placeholder="Default flag" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="all">Any default</ZoruSelectItem>
                                    <ZoruSelectItem value="yes">Default only</ZoruSelectItem>
                                    <ZoruSelectItem value="no">Non-default</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                    }
                    bulkBar={
                        selection.size > 0 ? (
                            <div className="flex items-center justify-between gap-2 text-[13px] text-zoru-ink">
                                <div>
                                    <strong>{selection.size}</strong> selected
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setConfirmBulk('archive')}
                                        disabled={isPending}
                                    >
                                        Archive
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setConfirmBulk('activate')}
                                        disabled={isPending}
                                    >
                                        Activate
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleExport} disabled={isPending}>
                                        Export
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setConfirmBulk('delete')}
                                        disabled={isPending}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ) : null
                    }
                    loading={isLoading && rows.length === 0}
                >
                    <PaymentAccountsTable
                        rows={filtered}
                        loading={isLoading}
                        selection={selection}
                        onToggle={handleToggle}
                        onToggleAll={handleToggleAll}
                        onDelete={setPendingRow}
                        compact={tab === 'employee'}
                    />
                </EntityListShell>
            </div>

            <ZoruAlertDialog open={!!pendingRow} onOpenChange={(o) => !o && setPendingRow(null)}>
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete payment account?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingRow?.accountName}&rdquo; is permanent. Posted vouchers
                            referencing it will keep the historical reference.
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
                                ? `Delete ${selection.size} accounts?`
                                : confirmBulk === 'archive'
                                  ? `Archive ${selection.size} accounts?`
                                  : `Activate ${selection.size} accounts?`}
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            {confirmBulk === 'delete'
                                ? 'Make sure none of these accounts are referenced by recurring payments.'
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

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={[
                'px-3 py-2 text-[12.5px] font-medium first:rounded-l-md last:rounded-r-md border-l border-border first:border-l-0',
                active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
        >
            {children}
        </button>
    );
}
