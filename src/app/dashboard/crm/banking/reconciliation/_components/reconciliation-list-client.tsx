'use client';

/**
 * <ReconciliationListClient> — KPI strip + saved reconciliation records
 * table + the interactive book-vs-statement matcher.
 *
 * KPI cards: reconciled count · unreconciled count · last reconciled date ·
 * difference amount.
 * Table: saved reconciliation records with account, period, status, export.
 * Matcher: a premium dual-panel book-vs-statement console with AI Auto-Matcher.
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
  Badge,
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
  Sparkles,
} from 'lucide-react';

import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

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
      <StatCard
        label="Reconciled"
        value={kpis.reconciled.toLocaleString()}
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      />
      <StatCard
        label="Unreconciled"
        value={kpis.unreconciled.toLocaleString()}
        icon={<ListChecks className="h-4 w-4 text-amber-500" />}
      />
      <StatCard
        label="Last reconciled"
        value={kpis.lastReconciledDate ? fmtDate(kpis.lastReconciledDate) : 'Never'}
        icon={<Clock className="h-4 w-4" />}
      />
      <StatCard
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
      <Card>
        <p className="text-[13px] text-zoru-ink-muted">
          No saved reconciliation records yet. Use the matcher below to reconcile
          your first period.
        </p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[14px] font-semibold text-zoru-ink">
          Saved reconciliations
        </h2>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
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
        </Table>
      </div>
    </Card>
  );
}

/* ─── Transaction table (book / statement) ────────────────────────────── */

const TransactionTable = ({
  title,
  entries,
  matchedIds,
  aiMatchedIds = new Set(),
  onMatchToggle,
  totalDebit,
  totalCredit,
  isBankStatement = false,
}: {
  title: string;
  entries: ReconciliationData['bookEntries'] | ReconciliationData['statementEntries'];
  matchedIds: Set<string>;
  aiMatchedIds?: Set<string>;
  onMatchToggle: (id: string) => void;
  totalDebit: number;
  totalCredit: number;
  isBankStatement?: boolean;
}) => (
  <Card className="border border-zoru-line overflow-hidden p-0 shadow-[var(--zoru-shadow-sm)]">
    <div className="flex items-center justify-between px-4 py-3 border-b border-zoru-line bg-zoru-surface-2">
      <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-zoru-ink">{title}</h3>
      <Badge variant="secondary">
        {entries.length} {entries.length === 1 ? 'row' : 'rows'}
      </Badge>
    </div>
    <div className="max-h-[420px] overflow-x-auto overflow-y-auto">
      <Table>
        <ZoruTableHeader className="sticky top-0 bg-zoru-surface-2 z-10">
          <ZoruTableRow className="border-zoru-line hover:bg-transparent">
            <ZoruTableHead className="w-10 text-zoru-ink-muted">
              <Check className="h-3.5 w-3.5" />
            </ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted text-[11px] font-bold uppercase tracking-wider">Date</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted text-[11px] font-bold uppercase tracking-wider">Description</ZoruTableHead>
            <ZoruTableHead className="text-right text-zoru-ink-muted text-[11px] font-bold uppercase tracking-wider">Debit</ZoruTableHead>
            <ZoruTableHead className="text-right text-zoru-ink-muted text-[11px] font-bold uppercase tracking-wider">Credit</ZoruTableHead>
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
            
            const isMatched = matchedIds.has(e._id);
            const isAiMatched = aiMatchedIds.has(e._id);
            
            // Build the row cell styling classes
            const cellClass = isMatched
              ? isAiMatched
                ? "bg-emerald-500/10 dark:bg-emerald-500/20 border-y border-emerald-500/40 text-emerald-950 dark:text-emerald-300 font-semibold"
                : "bg-emerald-500/5 dark:bg-emerald-500/10 border-y border-emerald-500/20 text-zoru-ink"
              : "text-zoru-ink border-b border-zoru-line";

            return (
              <ZoruTableRow
                key={e._id}
                className={[
                  "transition-all duration-200",
                  isMatched ? "hover:bg-emerald-500/15" : "hover:bg-zoru-surface-2",
                  isAiMatched ? "shadow-[inset_4px_0_0_0_#10b981]" : ""
                ].join(' ')}
                data-state={isMatched ? 'selected' : ''}
              >
                <ZoruTableCell className={[cellClass, isAiMatched ? "border-l border-emerald-500/40" : ""].join(' ')}>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={isMatched}
                      onCheckedChange={() => onMatchToggle(e._id)}
                    />
                    {isAiMatched && (
                      <Sparkles className="h-3.5 w-3.5 text-zoru-success-ink shrink-0 animate-pulse" title="AI Matched" />
                    )}
                  </div>
                </ZoruTableCell>
                <ZoruTableCell className={[cellClass, "text-[12px] font-mono"].join(' ')}>
                  {format(new Date(e.date as string), 'dd MMM')}
                </ZoruTableCell>
                <ZoruTableCell className={[cellClass, "text-[12.5px] truncate max-w-[150px]"].join(' ')}>
                  <div className="flex flex-col">
                    <span className="truncate">{e.description}</span>
                    {isAiMatched && (
                      <span className="text-[10px] text-zoru-success-ink font-semibold flex items-center gap-0.5 mt-0.5">
                        Matched ±3d Window
                      </span>
                    )}
                  </div>
                </ZoruTableCell>
                <ZoruTableCell className={[cellClass, "text-right font-mono text-[12px]"].join(' ')}>
                  {debit > 0 ? debit.toFixed(2) : ''}
                </ZoruTableCell>
                <ZoruTableCell className={[cellClass, "text-right font-mono text-[12px]"].join(' ')}>
                  {credit > 0 ? credit.toFixed(2) : ''}
                </ZoruTableCell>
              </ZoruTableRow>
            );
          })}
        </ZoruTableBody>
      </Table>
    </div>
    <div className="p-4 flex justify-end gap-6 border-t border-zoru-line bg-zoru-surface-2 text-[12.5px] font-bold text-zoru-ink">
      <div className="text-right">
        Debit: <span className="font-mono">{fmtInr(totalDebit)}</span>
      </div>
      <div className="text-right">
        Credit: <span className="font-mono">{fmtInr(totalCredit)}</span>
      </div>
    </div>
  </Card>
);

/* ─── Main client component ───────────────────────────────────────────── */

export function ReconciliationListClient({
  kpis,
  records: serverRecords,
}: ReconciliationListClientProps) {
  const router = useRouter();
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

  // Track specific items matches found by AI Auto-Matcher to draw premium emerald ring/glow
  const [aiMatchedBookEntries, setAiMatchedBookEntries] = React.useState<Set<string>>(new Set());
  const [aiMatchedStatementEntries, setAiMatchedStatementEntries] = React.useState<Set<string>>(new Set());

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
      setAiMatchedBookEntries(new Set());
      setAiMatchedStatementEntries(new Set());
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
      // Remove from AI matched tracking if manually toggled
      setAiMatchedBookEntries((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setMatchedStatementEntries((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAiMatchedStatementEntries((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleAIAutoMatch = () => {
    if (!reconciliationData) return;

    const newMatchedBook = new Set(matchedBookEntries);
    const newMatchedStatement = new Set(matchedStatementEntries);
    const newAiBook = new Set(aiMatchedBookEntries);
    const newAiStatement = new Set(aiMatchedStatementEntries);

    let matchCount = 0;

    reconciliationData.statementEntries.forEach((stmtEntry) => {
      if (newMatchedStatement.has(stmtEntry._id)) return;

      const stmtDate = new Date(stmtEntry.date).getTime();

      // Look for a matching book entry: Date within ±3 days and identical absolute amount
      const potentialMatch = reconciliationData.bookEntries.find((bookEntry) => {
        if (newMatchedBook.has(bookEntry._id)) return false;

        const bookDate = new Date(bookEntry.date).getTime();
        const daysDiff = Math.abs(stmtDate - bookDate) / (1000 * 60 * 60 * 24);
        const amountMatch = Math.abs(bookEntry.amount) === Math.abs(stmtEntry.amount);

        return amountMatch && daysDiff <= 3;
      });

      if (potentialMatch) {
        newMatchedBook.add(potentialMatch._id);
        newMatchedStatement.add(stmtEntry._id);
        newAiBook.add(potentialMatch._id);
        newAiStatement.add(stmtEntry._id);
        matchCount++;
      }
    });

    setMatchedBookEntries(newMatchedBook);
    setMatchedStatementEntries(newMatchedStatement);
    setAiMatchedBookEntries(newAiBook);
    setAiMatchedStatementEntries(newAiStatement);

    if (matchCount > 0) {
      toast({
        title: `AI Matcher Identified ${matchCount} matches`,
        description: `Linked bank statements to book entries within a ±3-day variance and highlighted with emerald borders.`,
      });
    } else {
      toast({
        title: `AI Auto-Matcher Scan Complete`,
        description: 'No new identical amount matches found within the ±3-day window.',
      });
    }
  };

  const handleSave = async () => {
    if (!selectedAccountId || !reconciliationData) return;
    startLoading(async () => {
      const res = await saveReconciliation(
        selectedAccountId,
        'manual_import',
        Array.from(matchedBookEntries),
        Array.from(matchedStatementEntries),
      );
      if (res.success) {
        toast({ title: 'Reconciliation confirmed & saved successfully!' });
        router.refresh(); // Active page cache invalidation
      } else {
        toast({
          title: 'Save failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
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
      <Card className="border border-zoru-line p-6 bg-zoru-bg shadow-[var(--zoru-shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-zoru-line pb-3">
          <div>
            <h2 className="text-[15px] font-bold text-zoru-ink flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-zoru-primary animate-pulse" />
              Split-Screen Bank Reconciliation Console
            </h2>
            <p className="text-[12px] text-zoru-ink-muted">Match statement bank transactions to books General Ledger instantly</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAIAutoMatch}
              disabled={!reconciliationData || isLoading}
              className="border-emerald-500/30 text-zoru-success-ink bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 flex items-center gap-1.5 shadow-[var(--zoru-shadow-sm)]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Auto-Matcher
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-[11.5px] font-semibold text-zoru-ink-muted uppercase">Bank Account</Label>
            <Select
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
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[11.5px] font-semibold text-zoru-ink-muted uppercase">From</Label>
            <DatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div className="space-y-2">
            <Label className="text-[11.5px] font-semibold text-zoru-ink-muted uppercase">To</Label>
            <DatePicker value={endDate} onChange={setEndDate} />
          </div>
          <div className="space-y-2">
            <Label className="text-[11.5px] font-semibold text-zoru-ink-muted uppercase">Bank Statement CSV</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setStatementFile(e.target.files?.[0] ?? null)}
              className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[12.5px]"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zoru-line">
          <div className="flex gap-2">
            <Button
              onClick={() => void handleFetchData()}
              disabled={isLoading}
              className="flex items-center gap-1.5"
            >
              {isLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              Load Transactions
            </Button>
          </div>
          <Button
            onClick={() => void handleSave()}
            disabled={!reconciliationData || difference !== 0 || isLoading}
            className="flex items-center gap-1.5"
          >
            {isLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            Confirm Match
          </Button>
        </div>
      </Card>

      {reconciliationData ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Cleared in books"
              value={fmtInr(clearedBookAmount)}
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            />
            <StatCard
              label="Cleared in bank"
              value={fmtInr(clearedStatementAmount)}
              icon={<CheckCircle2 className="h-4 w-4 text-blue-500" />}
            />
            <StatCard
              label="Uncleared amount"
              value={fmtInr(unclearedBookAmount)}
              icon={<Clock className="h-4 w-4 text-amber-500" />}
            />
            <StatCard
              label="Difference"
              value={fmtInr(difference)}
              icon={
                <GitCompare 
                  className={[
                    "h-4 w-4", 
                    difference === 0 ? "text-emerald-500 animate-pulse" : "text-zoru-danger-ink"
                  ].join(' ')} 
                />
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Bank Statement CSV Feed on the LEFT */}
            <TransactionTable
              title="Bank statement (CSV Feed)"
              entries={reconciliationData.statementEntries}
              matchedIds={matchedStatementEntries}
              aiMatchedIds={aiMatchedStatementEntries}
              onMatchToggle={(id) => handleMatchToggle('statement', id)}
              totalDebit={totalStatementDebit}
              totalCredit={totalStatementCredit}
              isBankStatement
            />

            {/* Company GL Books on the RIGHT */}
            <TransactionTable
              title="Company's General Ledger Books"
              entries={reconciliationData.bookEntries}
              matchedIds={matchedBookEntries}
              aiMatchedIds={aiMatchedBookEntries}
              onMatchToggle={(id) => handleMatchToggle('book', id)}
              totalDebit={totalBookDebit}
              totalCredit={totalBookCredit}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
