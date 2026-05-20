'use client';

/**
 * <BankTransactionsListClient> — deep list for `crm_bank_transactions`.
 *
 * Adds on top of the previous thin shell:
 *   - KPI strip (Total · Credits · Debits · Unreconciled)
 *   - Bulk reconcile + bulk delete
 *   - CSV and XLSX export via crm-list-export
 *   - EntityRowLink on the description/reference cell
 *
 * Rows are pre-fetched by the server component and passed as `initialRows`;
 * the client re-fetches when filters change (as before).
 */

import * as React from 'react';
import Link from 'next/link';
import Papa from 'papaparse';

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
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Eye,
  FileUp,
  ListChecks,
  LoaderCircle,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import {
  getCrmBankTransactions,
  bulkUpdateBankTransactions,
  type CrmBankTransactionRow,
  type CrmBankTransactionStatus,
  type CrmBankTransactionType,
  type CrmBankTransactionListKpis,
} from '@/app/actions/crm-bank-transactions.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import type { WithId } from 'mongodb';
import type { CrmPaymentAccount } from '@/lib/definitions';

import { CsvImportDialog } from './csv-import-dialog';

/* ─── Constants ───────────────────────────────────────────────────────── */

const STATUS_TONE: Record<CrmBankTransactionStatus, StatusTone> = {
  pending: 'amber',
  cleared: 'blue',
  reconciled: 'green',
  archived: 'neutral',
};

const EXPORT_HEADERS = [
  'Date',
  'Account',
  'Type',
  'Amount',
  'Description',
  'Reference',
  'Balance After',
  'Category',
  'Status',
];

/* ─── Helpers ─────────────────────────────────────────────────────────── */

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
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function rowToExport(r: CrmBankTransactionRow): Record<string, unknown> {
  return {
    Date: fmtDate(r.transactionDate),
    Account: r.accountName ?? r.accountId,
    Type: r.type,
    Amount: r.amount,
    Description: r.description ?? '',
    Reference: r.referenceNumber ?? '',
    'Balance After': r.balanceAfter ?? '',
    Category: r.category ?? '',
    Status: r.status,
  };
}

/* ─── Props ───────────────────────────────────────────────────────────── */

export interface BankTransactionsListClientProps {
  initialRows: CrmBankTransactionRow[];
  initialTotal: number;
  kpis: CrmBankTransactionListKpis;
  initialQuery: string;
  initialStatus: string;
  initialType: string;
  initialAccountId: string;
  initialFrom: string;
  initialTo: string;
}

/* ─── KPI strip ───────────────────────────────────────────────────────── */

function KpiStrip({
  kpis,
}: {
  kpis: CrmBankTransactionListKpis;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ZoruStatCard
        label="Total transactions"
        value={kpis.total.toLocaleString()}
        icon={<ListChecks className="h-4 w-4" />}
      />
      <ZoruStatCard
        label="Total credits"
        value={fmtMoney(kpis.creditSum)}
        icon={<ArrowDownLeft className="h-4 w-4 text-emerald-500" />}
      />
      <ZoruStatCard
        label="Total debits"
        value={fmtMoney(kpis.debitSum)}
        icon={<ArrowUpRight className="h-4 w-4 text-red-500" />}
      />
      <ZoruStatCard
        label="Unreconciled"
        value={kpis.unreconciled.toLocaleString()}
        icon={<CheckCircle2 className="h-4 w-4 text-amber-500" />}
      />
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function BankTransactionsListClient({
  initialRows,
  initialTotal,
  kpis,
  initialQuery,
  initialStatus,
  initialType,
  initialAccountId,
  initialFrom,
  initialTo,
}: BankTransactionsListClientProps): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<CrmBankTransactionRow[]>(initialRows);
  const [total, setTotal] = React.useState(initialTotal);
  const [accounts, setAccounts] = React.useState<WithId<CrmPaymentAccount>[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Filters
  const [accountFilter, setAccountFilter] = React.useState<string>(
    initialAccountId || 'all',
  );
  const [statusFilter, setStatusFilter] = React.useState<
    CrmBankTransactionStatus | 'all'
  >((initialStatus as CrmBankTransactionStatus) || 'all');
  const [typeFilter, setTypeFilter] = React.useState<
    CrmBankTransactionType | 'all'
  >((initialType as CrmBankTransactionType) || 'all');
  const [search, setSearch] = React.useState(initialQuery);
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);

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

  /* ── Selection ────────────────────────────────────────────────────── */

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

  /* ── Bulk ops ─────────────────────────────────────────────────────── */

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

  /* ── Export ───────────────────────────────────────────────────────── */

  const handleExportCsv = React.useCallback(() => {
    const data =
      selection.size > 0
        ? rows.filter((r) => selection.has(r._id))
        : rows;
    downloadCsv(
      `bank-transactions-${dateStamp()}.csv`,
      EXPORT_HEADERS,
      data.map(rowToExport),
    );
    toast({ title: `Exported ${data.length} rows to CSV.` });
  }, [rows, selection, toast]);

  const handleExportXlsx = React.useCallback(async () => {
    const data =
      selection.size > 0
        ? rows.filter((r) => selection.has(r._id))
        : rows;
    await downloadXlsx(
      `bank-transactions-${dateStamp()}.xlsx`,
      EXPORT_HEADERS,
      data.map(rowToExport),
      'Bank Transactions',
    );
    toast({ title: `Exported ${data.length} rows to XLSX.` });
  }, [rows, selection, toast]);

  /* ── Derived ──────────────────────────────────────────────────────── */

  const allSelected =
    rows.length > 0 && rows.every((r) => selection.has(r._id));
  const someSelected = !allSelected && rows.some((r) => selection.has(r._id));

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <KpiStrip kpis={kpis} />

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <ZoruInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, reference…"
            className="h-9 w-56 text-[13px]"
          />
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
            className="h-9 w-[145px]"
            aria-label="From date"
          />
          <ZoruInput
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-[145px]"
            aria-label="To date"
          />
          <div className="ml-auto flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => void handleExportXlsx()}
            >
              <Download className="h-3.5 w-3.5" /> XLSX
            </ZoruButton>
            <ZoruButton size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </ZoruButton>
          </div>
        </div>

        {/* Bulk bar */}
        {selection.size > 0 ? (
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
            <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
              <ListChecks className="h-4 w-4 text-zoru-primary" />
              {selection.size} selected
            </div>
            <div className="flex items-center gap-1">
              <ZoruButton
                size="sm"
                variant="outline"
                onClick={() => handleBulk('reconcile')}
                disabled={isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Reconcile
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="outline"
                onClick={() => setConfirmBulk('delete')}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="ghost"
                onClick={() => setSelection(new Set())}
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </ZoruButton>
            </div>
          </div>
        ) : null}

        {/* Table */}
        <ZoruCard className="overflow-hidden p-0">
          {isLoading && rows.length === 0 ? (
            <div className="flex justify-center py-10">
              <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <FileUp className="h-8 w-8 text-zoru-ink-muted" />
              <p className="text-[13px] text-zoru-ink-muted">
                No transactions found. Try adjusting filters or import a bank
                statement.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                    <ZoruTableHead className="text-right text-muted-foreground">
                      &nbsp;
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {rows.map((r) => {
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
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(r.transactionDate)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                          {r.accountName ?? '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                          <EntityRowLink
                            href={`/dashboard/crm/banking/bank-transactions/${r._id}`}
                            label={r.description ?? '—'}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                          {r.referenceNumber ?? '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                          {r.category ?? '—'}
                        </ZoruTableCell>
                        <ZoruTableCell
                          className={[
                            'text-right text-[12.5px] font-semibold tabular-nums',
                            r.type === 'credit'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400',
                          ].join(' ')}
                        >
                          {r.type === 'credit' ? '+' : '-'}{fmtMoney(r.amount)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink-muted">
                          {r.balanceAfter != null ? fmtMoney(r.balanceAfter) : '—'}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill
                            label={r.status}
                            tone={STATUS_TONE[r.status] ?? 'neutral'}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <ZoruButton size="sm" variant="ghost" asChild>
                            <Link
                              href={`/dashboard/crm/banking/bank-transactions/${r._id}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                          </ZoruButton>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          )}
        </ZoruCard>

        <p className="text-right text-[12px] text-zoru-ink-muted">
          {total} transaction{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Bulk delete confirm */}
      <ZoruAlertDialog
        open={confirmBulk === 'delete'}
        onOpenChange={(o) => !o && setConfirmBulk(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selection.size} transaction{selection.size !== 1 ? 's' : ''}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => handleBulk('delete')}
              disabled={isPending}
            >
              {isPending && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* CSV import dialog */}
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        accounts={accounts}
        onImported={() => void refresh()}
      />
    </>
  );
}
