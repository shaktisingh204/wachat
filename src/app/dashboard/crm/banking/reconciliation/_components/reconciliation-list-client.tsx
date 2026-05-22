'use client';

/**
 * <ReconciliationListClient> — KPI strip + saved reconciliation records
 * table + the interactive book-vs-statement matcher.
 *
 * KPI cards: reconciled count · unreconciled count · last reconciled date ·
 * difference amount.
 * Table: saved reconciliation records with account, period, status, export.
 * Matcher: the existing load-data + auto-match + save flow preserved below.
 */

import * as React from 'react';

import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  GitCompare,
  ListChecks,
  LoaderCircle,
  Trash2,
  X,
} from 'lucide-react';

import { format } from 'date-fns';

import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import {
  importBankStatement,
  getReconciliationData,
  saveReconciliation,
} from '@/app/actions/crm-reconciliation.actions';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import type { CrmReconciliationKpis } from '@/app/actions/crm-reconciliation.actions';
import type { WithId, CrmPaymentAccount } from '@/lib/definitions';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface ReconciliationRecord {
  _id: string;
  accountId?: string;
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  closingBalance?: number;
  matchedCount?: number;
  unmatchedCount?: number;
  status?: string;
  reconciledDate?: string;
  createdAt?: string;
}

type ReconciliationData = {
  bookEntries: Array<{
    _id: string;
    date: string | Date;
    description: string;
    type: string;
    amount: number;
  }>;
  statementEntries: Array<{
    _id: string;
    date: string | Date;
    description: string;
    amount: number;
  }>;
};

/* ─── Props ─────────────────────────────────────────────────────────── */

export interface ReconciliationListClientProps {
  kpis: CrmReconciliationKpis;
  records: Array<Record<string, unknown>>;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function fmtInr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try {
    return format(new Date(v as string), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

/* ─── KPI strip ──────────────────────────────────────────────────────── */

function KpiStrip({ kpis }: { kpis: CrmReconciliationKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ZoruStatCard
        label="Reconciled"
        value={kpis.reconciled.toLocaleString()}
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      />
      <ZoruStatCard
        label="Unreconciled"
        value={kpis.unreconciled.toLocaleString()}
        icon={<ListChecks className="h-4 w-4 text-amber-500" />}
      />
      <ZoruStatCard
        label="Last reconciled"
        value={kpis.lastReconciledDate ? fmtDate(kpis.lastReconciledDate) : 'Never'}
        icon={<Clock className="h-4 w-4" />}
      />
      <ZoruStatCard
        label="Total difference"
        value={fmtInr(kpis.totalDifference)}
        icon={<GitCompare className="h-4 w-4" />}
      />
    </div>
  );
}

/* ─── Records table ───────────────────────────────────────────────────── */

function RecordsTable({
  records,
  onExport,
}: {
  records: ReconciliationRecord[];
  onExport: () => void;
}) {
  if (records.length === 0) {
    return (
      <ZoruCard>
        <p className="text-[13px] text-zoru-ink-muted">
          No saved reconciliation records yet. Use the matcher below to reconcile
          your first period.
        </p>
      </ZoruCard>
    );
  }
  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[14px] font-semibold text-zoru-ink">
          Saved reconciliations
        </h2>
        <ZoruButton variant="outline" size="sm" onClick={onExport}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </ZoruButton>
      </div>
      <div className="overflow-x-auto">
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow className="border-border hover:bg-transparent">
              <ZoruTableHead className="text-muted-foreground">Period</ZoruTableHead>
              <ZoruTableHead className="text-muted-foreground">Account</ZoruTableHead>
              <ZoruTableHead className="text-right text-muted-foreground">
                Opening
              </ZoruTableHead>
              <ZoruTableHead className="text-right text-muted-foreground">
                Closing
              </ZoruTableHead>
              <ZoruTableHead className="text-right text-muted-foreground">
                Matched
              </ZoruTableHead>
              <ZoruTableHead className="text-right text-muted-foreground">
                Unmatched
              </ZoruTableHead>
              <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
              <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {records.map((rec) => (
              <ZoruTableRow key={rec._id} className="border-border">
                <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                  {rec.periodStart ? fmtDate(rec.periodStart) : '—'} -{' '}
                  {rec.periodEnd ? fmtDate(rec.periodEnd) : '—'}
                </ZoruTableCell>
                <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                  {rec.accountId ?? '—'}
                </ZoruTableCell>
                <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                  {rec.openingBalance != null ? fmtInr(rec.openingBalance) : '—'}
                </ZoruTableCell>
                <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                  {rec.closingBalance != null ? fmtInr(rec.closingBalance) : '—'}
                </ZoruTableCell>
                <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                  {rec.matchedCount ?? 0}
                </ZoruTableCell>
                <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-amber-600">
                  {rec.unmatchedCount ?? 0}
                </ZoruTableCell>
                <ZoruTableCell>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      rec.status === 'Completed' || rec.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                    ].join(' ')}
                  >
                    {rec.status ?? 'in_progress'}
                  </span>
                </ZoruTableCell>
                <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                  {fmtDate(rec.reconciledDate ?? rec.createdAt)}
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
          </ZoruTableBody>
        </ZoruTable>
      </div>
    </ZoruCard>
  );
}

/* ─── Transaction table (book / statement) ────────────────────────────── */

const TransactionTable = ({
  title,
  entries,
  matchedIds,
  onMatchToggle,
  totalDebit,
  totalCredit,
  isBankStatement = false,
}: {
  title: string;
  entries: ReconciliationData['bookEntries'] | ReconciliationData['statementEntries'];
  matchedIds: Set<string>;
  onMatchToggle: (id: string) => void;
  totalDebit: number;
  totalCredit: number;
  isBankStatement?: boolean;
}) => (
  <ZoruCard>
    <h3 className="mb-4 text-[15px] font-semibold text-foreground">{title}</h3>
    <div className="max-h-96 overflow-x-auto overflow-y-auto rounded-lg border border-border">
      <ZoruTable>
        <ZoruTableHeader className="sticky top-0 bg-card">
          <ZoruTableRow className="border-border hover:bg-transparent">
            <ZoruTableHead className="w-10 text-muted-foreground">
              <Check className="h-4 w-4" />
            </ZoruTableHead>
            <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
            <ZoruTableHead className="text-muted-foreground">Description</ZoruTableHead>
            <ZoruTableHead className="text-right text-muted-foreground">Debit</ZoruTableHead>
            <ZoruTableHead className="text-right text-muted-foreground">Credit</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {entries.map((entry) => {
            const e = entry as typeof entry & { type?: string; amount: number };
            const debit = isBankStatement
              ? e.amount > 0
                ? e.amount
                : 0
              : e.type === 'debit'
                ? e.amount
                : 0;
            const credit = isBankStatement
              ? e.amount < 0
                ? Math.abs(e.amount)
                : 0
              : e.type === 'credit'
                ? e.amount
                : 0;
            return (
              <ZoruTableRow
                key={e._id}
                className="border-border"
                data-state={matchedIds.has(e._id) ? 'selected' : ''}
              >
                <ZoruTableCell>
                  <ZoruCheckbox
                    checked={matchedIds.has(e._id)}
                    onCheckedChange={() => onMatchToggle(e._id)}
                  />
                </ZoruTableCell>
                <ZoruTableCell className="text-xs text-foreground">
                  {format(new Date(e.date as string), 'dd MMM')}
                </ZoruTableCell>
                <ZoruTableCell className="text-xs text-foreground">
                  {e.description}
                </ZoruTableCell>
                <ZoruTableCell className="text-right font-mono text-xs text-foreground">
                  {debit > 0 ? debit.toFixed(2) : ''}
                </ZoruTableCell>
                <ZoruTableCell className="text-right font-mono text-xs text-foreground">
                  {credit > 0 ? credit.toFixed(2) : ''}
                </ZoruTableCell>
              </ZoruTableRow>
            );
          })}
        </ZoruTableBody>
      </ZoruTable>
    </div>
    <div className="mt-4 flex justify-end gap-6 border-t border-border pt-2 text-[13px] font-semibold text-foreground">
      <div className="text-right">
        Debit: <span className="font-mono">₹{totalDebit.toFixed(2)}</span>
      </div>
      <div className="text-right">
        Credit: <span className="font-mono">₹{totalCredit.toFixed(2)}</span>
      </div>
    </div>
  </ZoruCard>
);

/* ─── Main client component ───────────────────────────────────────────── */

export function ReconciliationListClient({
  kpis,
  records: serverRecords,
}: ReconciliationListClientProps) {
  const { toast } = useZoruToast();

  const records = serverRecords as unknown as ReconciliationRecord[];

  const [accounts, setAccounts] = React.useState<WithId<CrmPaymentAccount>[]>([]);
  const [selectedAccountId, setSelectedAccountId] = React.useState('');
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [statementFile, setStatementFile] = React.useState<File | null>(null);
  const [reconciliationData, setReconciliationData] =
    React.useState<ReconciliationData | null>(null);
  const [matchedBookEntries, setMatchedBookEntries] = React.useState<Set<string>>(
    new Set(),
  );
  const [matchedStatementEntries, setMatchedStatementEntries] = React.useState<
    Set<string>
  >(new Set());
  const [isLoading, startLoading] = React.useTransition();

  React.useEffect(() => {
    getCrmPaymentAccounts().then((data) => {
      setAccounts(data.filter((a) => a.accountType === 'bank'));
    });
  }, []);

  const handleFetchData = async () => {
    if (!selectedAccountId || !startDate || !endDate) {
      toast({
        title: 'Please select an account and a date range.',
        variant: 'destructive',
      });
      return;
    }
    startLoading(async () => {
      const statementEntriesResult = statementFile
        ? await importBankStatement(statementFile)
        : {
            statementEntries:
              reconciliationData?.statementEntries ?? [],
          };
      if (statementEntriesResult.error) {
        toast({
          title: 'Statement Import Error',
          description: statementEntriesResult.error,
          variant: 'destructive',
        });
        return;
      }
      const bookEntriesResult = await getReconciliationData(
        selectedAccountId,
        startDate,
        endDate,
      );
      if (bookEntriesResult.error) {
        toast({
          title: 'Error Fetching Book Entries',
          description: bookEntriesResult.error,
          variant: 'destructive',
        });
        return;
      }
      setReconciliationData({
        bookEntries: (bookEntriesResult.entries ?? []) as ReconciliationData['bookEntries'],
        statementEntries: (statementEntriesResult.statementEntries ?? []) as ReconciliationData['statementEntries'],
      });
      setMatchedBookEntries(new Set());
      setMatchedStatementEntries(new Set());
    });
  };

  const handleMatchToggle = (type: 'book' | 'statement', id: string) => {
    if (type === 'book') {
      setMatchedBookEntries((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setMatchedStatementEntries((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const handleAutoMatch = () => {
    const newMatchedBook = new Set(matchedBookEntries);
    const newMatchedStatement = new Set(matchedStatementEntries);
    reconciliationData?.bookEntries.forEach((bookEntry) => {
      if (newMatchedBook.has(bookEntry._id)) return;
      const potentialMatch = reconciliationData.statementEntries.find(
        (stmtEntry) =>
          !newMatchedStatement.has(stmtEntry._id) &&
          Math.abs(bookEntry.amount) === Math.abs(stmtEntry.amount),
      );
      if (potentialMatch) {
        newMatchedBook.add(bookEntry._id);
        newMatchedStatement.add(potentialMatch._id);
      }
    });
    setMatchedBookEntries(newMatchedBook);
    setMatchedStatementEntries(newMatchedStatement);
  };

  const handleSave = async () => {
    if (!selectedAccountId || !reconciliationData) return;
    const res = await saveReconciliation(
      selectedAccountId,
      'manual_import',
      Array.from(matchedBookEntries),
      Array.from(matchedStatementEntries),
    );
    if (res.success) {
      toast({ title: 'Reconciliation saved.' });
    } else {
      toast({
        title: 'Save failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const {
    totalBookDebit,
    totalBookCredit,
    clearedBookAmount,
    unclearedBookAmount,
    totalStatementDebit,
    totalStatementCredit,
    clearedStatementAmount,
  } = React.useMemo(() => {
    if (!reconciliationData) {
      return {
        totalBookDebit: 0,
        totalBookCredit: 0,
        clearedBookAmount: 0,
        unclearedBookAmount: 0,
        totalStatementDebit: 0,
        totalStatementCredit: 0,
        clearedStatementAmount: 0,
      };
    }
    const bookTotals = reconciliationData.bookEntries.reduce(
      (acc, entry) => {
        const amount = entry.amount;
        if (entry.type === 'debit') acc.totalBookDebit += amount;
        else acc.totalBookCredit += amount;
        if (matchedBookEntries.has(entry._id)) {
          if (entry.type === 'debit') acc.clearedBookAmount += amount;
          else acc.clearedBookAmount -= amount;
        }
        return acc;
      },
      { totalBookDebit: 0, totalBookCredit: 0, clearedBookAmount: 0 },
    );
    const statementTotals = reconciliationData.statementEntries.reduce(
      (acc, entry) => {
        const amount = entry.amount;
        if (amount > 0) acc.totalStatementDebit += amount;
        else acc.totalStatementCredit += Math.abs(amount);
        if (matchedStatementEntries.has(entry._id)) {
          acc.clearedStatementAmount += amount;
        }
        return acc;
      },
      {
        totalStatementDebit: 0,
        totalStatementCredit: 0,
        clearedStatementAmount: 0,
      },
    );
    const unclearedBook = reconciliationData.bookEntries
      .filter((e) => !matchedBookEntries.has(e._id))
      .reduce(
        (sum, e) => sum + (e.type === 'debit' ? e.amount : -e.amount),
        0,
      );
    return {
      totalBookDebit: bookTotals.totalBookDebit,
      totalBookCredit: bookTotals.totalBookCredit,
      clearedBookAmount: bookTotals.clearedBookAmount,
      unclearedBookAmount: unclearedBook,
      totalStatementDebit: statementTotals.totalStatementDebit,
      totalStatementCredit: statementTotals.totalStatementCredit,
      clearedStatementAmount: statementTotals.clearedStatementAmount,
    };
  }, [reconciliationData, matchedBookEntries, matchedStatementEntries]);

  const difference = clearedBookAmount - clearedStatementAmount;

  const handleExportRecords = React.useCallback(() => {
    downloadCsv(
      `reconciliations-${dateStamp()}.csv`,
      [
        'Period Start',
        'Period End',
        'Account',
        'Opening Balance',
        'Closing Balance',
        'Matched',
        'Unmatched',
        'Status',
        'Date',
      ],
      records.map((r) => ({
        'Period Start': r.periodStart ? fmtDate(r.periodStart) : '',
        'Period End': r.periodEnd ? fmtDate(r.periodEnd) : '',
        Account: r.accountId ?? '',
        'Opening Balance': r.openingBalance ?? 0,
        'Closing Balance': r.closingBalance ?? 0,
        Matched: r.matchedCount ?? 0,
        Unmatched: r.unmatchedCount ?? 0,
        Status: r.status ?? '',
        Date: r.reconciledDate ? fmtDate(r.reconciledDate) : '',
      })),
    );
  }, [records]);

  return (
    <div className="flex flex-col gap-5">
      {/* KPI strip */}
      <KpiStrip kpis={kpis} />

      {/* Saved records */}
      <RecordsTable records={records} onExport={handleExportRecords} />

      {/* Interactive matcher */}
      <ZoruCard>
        <h2 className="mb-4 text-[15px] font-semibold text-zoru-ink">
          Statement matcher
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <ZoruLabel>Bank account</ZoruLabel>
            <ZoruSelect
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Select account…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {accounts.map((acc) => (
                  <ZoruSelectItem
                    key={acc._id.toString()}
                    value={acc._id.toString()}
                  >
                    {acc.accountName}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="space-y-2">
            <ZoruLabel>From</ZoruLabel>
            <ZoruDatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div className="space-y-2">
            <ZoruLabel>To</ZoruLabel>
            <ZoruDatePicker value={endDate} onChange={setEndDate} />
          </div>
          <div className="space-y-2">
            <ZoruLabel>Bank statement (CSV)</ZoruLabel>
            <ZoruInput
              type="file"
              accept=".csv"
              onChange={(e) => setStatementFile(e.target.files?.[0] ?? null)}
              className="h-10 rounded-lg border-border bg-card text-[13px]"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <ZoruButton
              onClick={() => void handleFetchData()}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Load data
            </ZoruButton>
            <ZoruButton
              variant="outline"
              onClick={handleAutoMatch}
              disabled={!reconciliationData}
            >
              Auto-match
            </ZoruButton>
          </div>
          <ZoruButton
            onClick={() => void handleSave()}
            disabled={!reconciliationData || difference !== 0}
          >
            Save reconciliation
          </ZoruButton>
        </div>
      </ZoruCard>

      {reconciliationData ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <ZoruStatCard
              label="Cleared in books"
              value={fmtInr(clearedBookAmount)}
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            />
            <ZoruStatCard
              label="Cleared in bank"
              value={fmtInr(clearedStatementAmount)}
              icon={<CheckCircle2 className="h-4 w-4 text-blue-500" />}
            />
            <ZoruStatCard
              label="Uncleared amount"
              value={fmtInr(unclearedBookAmount)}
              icon={<Clock className="h-4 w-4 text-amber-500" />}
            />
            <ZoruStatCard
              label="Difference"
              value={fmtInr(difference)}
              icon={<GitCompare className="h-4 w-4" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <TransactionTable
              title="Company's books"
              entries={reconciliationData.bookEntries}
              matchedIds={matchedBookEntries}
              onMatchToggle={(id) => handleMatchToggle('book', id)}
              totalDebit={totalBookDebit}
              totalCredit={totalBookCredit}
            />
            <TransactionTable
              title="Bank statement"
              entries={reconciliationData.statementEntries}
              matchedIds={matchedStatementEntries}
              onMatchToggle={(id) => handleMatchToggle('statement', id)}
              totalDebit={totalStatementDebit}
              totalCredit={totalStatementCredit}
              isBankStatement
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
