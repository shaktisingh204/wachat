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
  ZoruButton,
  ZoruCheckbox,
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
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  FileUp,
  LoaderCircle,
  Trash2,
  Upload,
  } from 'lucide-react';

/**
 * <BankTransactionsListClient> — list of `crm_bank_transactions` rows.
 *
 * Includes filters (account, status, type, date range, free-text), bulk
 * actions (clear / reconcile / archive / delete), and a CSV import
 * dialog that picks the statement file from SabFiles (per project
 * policy — no free-text URL paste).
 */

import * as React from 'react';
import Link from 'next/link';
import Papa from 'papaparse';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    getCrmBankTransactions,
    bulkUpdateBankTransactions,
    type CrmBankTransactionRow,
    type CrmBankTransactionStatus,
    type CrmBankTransactionType,
} from '@/app/actions/crm-bank-transactions.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import type { WithId } from 'mongodb';
import type { CrmPaymentAccount } from '@/lib/definitions';

import { CsvImportDialog } from './csv-import-dialog';

const STATUS_TONE: Record<CrmBankTransactionStatus, StatusTone> = {
    pending: 'amber',
    cleared: 'blue',
    reconciled: 'green',
    archived: 'neutral',
};


function fmtMoney(value: number, currency = 'INR'): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(value || 0);
    } catch {
        return `${currency} ${(value || 0).toFixed(2)}`;
    }
}

function fmtDate(value: string): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function BankTransactionsListClient(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [rows, setRows] = React.useState<CrmBankTransactionRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [accounts, setAccounts] = React.useState<WithId<CrmPaymentAccount>[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    // Filters
    const [accountFilter, setAccountFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<CrmBankTransactionStatus | 'all'>('all');
    const [typeFilter, setTypeFilter] = React.useState<CrmBankTransactionType | 'all'>('all');
    const [search, setSearch] = React.useState('');
    const [from, setFrom] = React.useState('');
    const [to, setTo] = React.useState('');

    const [selection, setSelection] = React.useState<Set<string>>(new Set());
    const [confirmBulk, setConfirmBulk] = React.useState<
        'archive' | 'reconcile' | 'clear' | 'delete' | null
    >(null);
    const [importOpen, setImportOpen] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        const res = await getCrmBankTransactions({
            accountId: accountFilter === 'all' ? undefined : accountFilter,
            status: statusFilter === 'all' ? undefined : statusFilter,
            type: typeFilter === 'all' ? undefined : typeFilter,
            q: search.trim() || undefined,
            from: from || undefined,
            to: to || undefined,
            limit: 500,
        });
        setRows(res.items);
        setTotal(res.total);
        setIsLoading(false);
    }, [accountFilter, statusFilter, typeFilter, search, from, to]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            const data = await getCrmPaymentAccounts();
            if (cancelled) return;
            setAccounts(data);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    /* ── Selection ──────────────────────────────────────────────────── */

    const handleToggle = React.useCallback((id: string) => {
        setSelection((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleToggleAll = React.useCallback(
        (checked: boolean) =>
            setSelection(checked ? new Set(rows.map((r) => r._id)) : new Set()),
        [rows],
    );

    const handleBulk = React.useCallback(
        (op: 'archive' | 'reconcile' | 'clear' | 'delete') => {
            const ids = Array.from(selection);
            if (ids.length === 0) return;
            startTransition(async () => {
                const r = await bulkUpdateBankTransactions(ids, op);
                if (r.success) {
                    toast({ title: `Updated ${r.updated ?? 0} transactions.` });
                    setSelection(new Set());
                    setConfirmBulk(null);
                    await refresh();
                } else {
                    toast({
                        title: 'Error',
                        description: r.error,
                        variant: 'destructive',
                    });
                }
            });
        },
        [selection, refresh, toast],
    );

    const handleExport = React.useCallback(() => {
        const ids = selection.size > 0 ? selection : null;
        const data = ids ? rows.filter((r) => ids.has(r._id)) : rows;
        const csv = Papa.unparse(
            data.map((r) => ({
                Date: fmtDate(r.transactionDate),
                Account: r.accountName ?? r.accountId,
                Type: r.type,
                Amount: r.amount,
                Description: r.description ?? '',
                Reference: r.referenceNumber ?? '',
                'Balance After': r.balanceAfter ?? '',
                Category: r.category ?? '',
                Status: r.status,
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute(
            'download',
            `bank-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [rows, selection]);

    const allSelected = rows.length > 0 && rows.every((r) => selection.has(r._id));
    const someSelected = !allSelected && rows.some((r) => selection.has(r._id));

    return (
        <>
            <EntityListShell
                title=""
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search description, reference…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <ZoruButton variant="outline" onClick={handleExport}>
                            Export CSV
                        </ZoruButton>
                        <ZoruButton onClick={() => setImportOpen(true)}>
                            <Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV
                        </ZoruButton>
                    </div>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <ZoruSelect value={accountFilter} onValueChange={setAccountFilter}>
                            <ZoruSelectTrigger className="h-9 w-[200px]">
                                <ZoruSelectValue placeholder="Account" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All accounts</ZoruSelectItem>
                                {accounts.map((a) => (
                                    <ZoruSelectItem key={a._id.toString()} value={a._id.toString()}>
                                        {a.accountName}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <EnumFilterField
                            enumName="bankTransactionStatus"
                            value={statusFilter}
                            onChange={(v) =>
                                setStatusFilter(v as CrmBankTransactionStatus | 'all')
                            }
                            allLabel="All statuses"
                        />
                        <EnumFilterField
                            enumName="bankTransactionDirection"
                            value={typeFilter}
                            onChange={(v) =>
                                setTypeFilter(v as CrmBankTransactionType | 'all')
                            }
                            allLabel="All types"
                        />
                        <ZoruInput
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="h-9 w-[150px]"
                            aria-label="From date"
                        />
                        <ZoruInput
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="h-9 w-[150px]"
                            aria-label="To date"
                        />
                    </div>
                }
                bulkBar={
                    selection.size > 0 ? (
                        <div className="flex items-center justify-between gap-2 text-[13px] text-zoru-ink">
                            <div>
                                <strong>{selection.size}</strong> selected
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmBulk('clear')}
                                    disabled={isPending}
                                >
                                    Mark cleared
                                </ZoruButton>
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmBulk('reconcile')}
                                    disabled={isPending}
                                >
                                    Mark reconciled
                                </ZoruButton>
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmBulk('archive')}
                                    disabled={isPending}
                                >
                                    Archive
                                </ZoruButton>
                                <ZoruButton
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setConfirmBulk('delete')}
                                    disabled={isPending}
                                >
                                    Delete
                                </ZoruButton>
                            </div>
                        </div>
                    ) : null
                }
                loading={isLoading && rows.length === 0}
                empty={
                    !isLoading && rows.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <FileUp className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">No transactions yet</h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Import a bank statement CSV or post a voucher entry to populate this ledger.
                            </p>
                            <ZoruButton onClick={() => setImportOpen(true)}>
                                <Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV
                            </ZoruButton>
                        </div>
                    ) : null
                }
            >
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="w-10 text-muted-foreground">
                                    <ZoruCheckbox
                                        checked={allSelected}
                                        data-indeterminate={someSelected ? 'true' : undefined}
                                        onCheckedChange={(v) => handleToggleAll(Boolean(v))}
                                        aria-label="Select all rows"
                                    />
                                </ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Account</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Description</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reference</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Category</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Amount</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Balance</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={10} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : rows.length === 0 ? null : (
                                rows.map((r) => {
                                    const checked = selection.has(r._id);
                                    return (
                                        <ZoruTableRow
                                            key={r._id}
                                            className="border-border"
                                            data-state={checked ? 'selected' : undefined}
                                        >
                                            <ZoruTableCell>
                                                <ZoruCheckbox
                                                    checked={checked}
                                                    onCheckedChange={() => handleToggle(r._id)}
                                                    aria-label={`Select ${r.description ?? r._id}`}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-foreground">
                                                {fmtDate(r.transactionDate)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-foreground">
                                                <Link
                                                    href={`/dashboard/crm/banking/all/${r.accountId}`}
                                                    className="hover:underline"
                                                >
                                                    {r.accountName ?? '—'}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="max-w-[280px] truncate text-[12.5px] text-foreground">
                                                {r.description ?? '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="font-mono text-[12px] text-muted-foreground">
                                                {r.referenceNumber ?? '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-muted-foreground">
                                                {r.category ?? '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono">
                                                <span
                                                    className={
                                                        r.type === 'credit'
                                                            ? 'text-emerald-500'
                                                            : 'text-rose-500'
                                                    }
                                                >
                                                    {r.type === 'credit' ? (
                                                        <ArrowDownLeft className="mr-1 inline h-3 w-3" />
                                                    ) : (
                                                        <ArrowUpRight className="mr-1 inline h-3 w-3" />
                                                    )}
                                                    {fmtMoney(r.amount)}
                                                </span>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-[12px] text-muted-foreground">
                                                {r.balanceAfter == null ? '—' : fmtMoney(r.balanceAfter)}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <StatusPill
                                                    label={r.status}
                                                    tone={STATUS_TONE[r.status] ?? 'neutral'}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton variant="ghost" size="icon" asChild>
                                                    <Link
                                                        href={`/dashboard/crm/banking/bank-transactions/${r._id}`}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                </ZoruButton>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>

                {rows.length > 0 ? (
                    <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
                        <div>
                            Showing <strong className="text-foreground">{rows.length}</strong> of{' '}
                            <strong className="text-foreground">{total}</strong> transactions
                        </div>
                        <div className="flex items-center gap-1 text-emerald-500">
                            <CheckCircle2 className="h-3 w-3" /> Live
                        </div>
                    </div>
                ) : null}
            </EntityListShell>

            <CsvImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                accounts={accounts}
                onImported={refresh}
            />

            <ZoruAlertDialog
                open={!!confirmBulk}
                onOpenChange={(o) => !o && setConfirmBulk(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            {confirmBulk === 'delete'
                                ? `Delete ${selection.size} transactions?`
                                : confirmBulk === 'archive'
                                  ? `Archive ${selection.size} transactions?`
                                  : confirmBulk === 'reconcile'
                                    ? `Mark ${selection.size} as reconciled?`
                                    : `Mark ${selection.size} as cleared?`}
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            {confirmBulk === 'delete'
                                ? 'Deleting transactions cannot be undone. Linked voucher entries are not affected.'
                                : 'You can reverse status changes at any time from the bulk bar.'}
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={() => confirmBulk && handleBulk(confirmBulk)}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Confirm
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
