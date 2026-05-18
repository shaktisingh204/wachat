'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDatePicker,
  ZoruInput,
  ZoruLabel,
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
import {
  Check,
  GitCompare } from 'lucide-react';

/**
 * Bank Reconciliation — match worksheet.
 *
 * Imports a CSV bank statement, fetches matching book entries, and lets
 * the user mark pairs as matched. This worksheet is the legacy
 * Mongo-backed flow preserved for live matching; the CRUD list of
 * reconciliation records lives one level up.
 */

import React, { useEffect, useMemo, useState, useTransition } from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import {
    getReconciliationData,
    importBankStatement,
} from '@/app/actions/crm-reconciliation.actions';
import type { WithId, CrmPaymentAccount } from '@/lib/definitions';
import { format } from 'date-fns';

type ReconciliationData = {
    bookEntries: any[];
    statementEntries: any[];
};

const StatCard = ({ title, value }: { title: string; value: string | number }) => (
    <div className="rounded-lg border border-border bg-secondary p-3">
        <p className="text-[12.5px] text-muted-foreground">{title}</p>
        <p className="text-[18px] font-bold text-foreground">
            {typeof value === 'number'
                ? `₹${value.toLocaleString('en-IN')}`
                : value}
        </p>
    </div>
);

export default function BankReconciliationMatchPage() {
    const [accounts, setAccounts] = useState<WithId<CrmPaymentAccount>[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [statementFile, setStatementFile] = useState<File | null>(null);
    const [reconciliationData, setReconciliationData] =
        useState<ReconciliationData | null>(null);
    const [matchedBookEntries, setMatchedBookEntries] = useState<Set<string>>(
        new Set(),
    );
    const [matchedStatementEntries, setMatchedStatementEntries] = useState<
        Set<string>
    >(new Set());

    const [isLoading, startLoading] = useTransition();
    const { toast } = useZoruToast();

    useEffect(() => {
        getCrmPaymentAccounts().then((data) => {
            setAccounts(data.filter((a) => a.accountType === 'bank'));
        });
    }, []);

    const handleFetchData = () => {
        if (!selectedAccountId || !startDate || !endDate) {
            toast({
                title: 'Please select an account and a date range.',
                variant: 'destructive',
            });
            return;
        }
        startLoading(async () => {
            const statementResult = statementFile
                ? await importBankStatement(statementFile)
                : { statementEntries: reconciliationData?.statementEntries || [] };
            if (statementResult.error) {
                toast({
                    title: 'Statement Import Error',
                    description: statementResult.error,
                    variant: 'destructive',
                });
                return;
            }
            const bookResult = await getReconciliationData(
                selectedAccountId,
                startDate,
                endDate,
            );
            if (bookResult.error) {
                toast({
                    title: 'Error Fetching Book Entries',
                    description: bookResult.error,
                    variant: 'destructive',
                });
                return;
            }
            setReconciliationData({
                bookEntries: bookResult.entries || [],
                statementEntries: statementResult.statementEntries || [],
            });
            setMatchedBookEntries(new Set());
            setMatchedStatementEntries(new Set());
        });
    };

    const handleMatchToggle = (type: 'book' | 'statement', id: string) => {
        const setter =
            type === 'book' ? setMatchedBookEntries : setMatchedStatementEntries;
        setter((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleAutoMatch = () => {
        const nextBook = new Set(matchedBookEntries);
        const nextStmt = new Set(matchedStatementEntries);
        reconciliationData?.bookEntries.forEach((be) => {
            if (nextBook.has(be._id)) return;
            const m = reconciliationData.statementEntries.find(
                (se) =>
                    !nextStmt.has(se._id) &&
                    Math.abs(be.amount) === Math.abs(se.amount),
            );
            if (m) {
                nextBook.add(be._id);
                nextStmt.add(m._id);
            }
        });
        setMatchedBookEntries(nextBook);
        setMatchedStatementEntries(nextStmt);
    };

    const {
        totalBookDebit,
        totalBookCredit,
        clearedBookAmount,
        unclearedBookAmount,
        totalStatementDebit,
        totalStatementCredit,
        clearedStatementAmount,
    } = useMemo(() => {
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
            (acc, e) => {
                const amt = e.amount;
                if (e.type === 'debit') acc.totalBookDebit += amt;
                else acc.totalBookCredit += amt;
                if (matchedBookEntries.has(e._id)) {
                    acc.clearedBookAmount += e.type === 'debit' ? amt : -amt;
                }
                return acc;
            },
            { totalBookDebit: 0, totalBookCredit: 0, clearedBookAmount: 0 },
        );
        const stmtTotals = reconciliationData.statementEntries.reduce(
            (acc, e) => {
                const amt = e.amount;
                if (amt > 0) acc.totalStatementDebit += amt;
                else acc.totalStatementCredit += Math.abs(amt);
                if (matchedStatementEntries.has(e._id))
                    acc.clearedStatementAmount += amt;
                return acc;
            },
            {
                totalStatementDebit: 0,
                totalStatementCredit: 0,
                clearedStatementAmount: 0,
            },
        );
        const uncleared = reconciliationData.bookEntries
            .filter((e) => !matchedBookEntries.has(e._id))
            .reduce(
                (s, e) => s + (e.type === 'debit' ? e.amount : -e.amount),
                0,
            );
        return {
            ...bookTotals,
            ...stmtTotals,
            unclearedBookAmount: uncleared,
        };
    }, [reconciliationData, matchedBookEntries, matchedStatementEntries]);

    const difference = clearedBookAmount - clearedStatementAmount;

    return (
        <EntityListShell
            title="Match worksheet"
            subtitle="Import a CSV bank statement and tick matched book entries."
        >

            <ZoruCard>
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                        <ZoruLabel>Bank Account</ZoruLabel>
                        <ZoruSelect
                            value={selectedAccountId}
                            onValueChange={setSelectedAccountId}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Select Account…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {accounts.map((a) => (
                                    <ZoruSelectItem
                                        key={a._id.toString()}
                                        value={a._id.toString()}
                                    >
                                        {a.accountName}
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
                        <ZoruLabel>Bank Statement (CSV)</ZoruLabel>
                        <ZoruInput
                            type="file"
                            accept=".csv"
                            onChange={(e) =>
                                setStatementFile(e.target.files?.[0] || null)
                            }
                            className="h-10"
                        />
                    </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                        <ZoruButton onClick={handleFetchData} disabled={isLoading}>
                            Load Data
                        </ZoruButton>
                        <ZoruButton
                            variant="outline"
                            onClick={handleAutoMatch}
                            disabled={!reconciliationData}
                        >
                            Auto-Match
                        </ZoruButton>
                    </div>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Use the CRUD page to persist a reconciliation record.
                    </p>
                </div>
            </ZoruCard>

            {reconciliationData && (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Cleared in Books" value={clearedBookAmount} />
                        <StatCard
                            title="Cleared in Bank"
                            value={clearedStatementAmount}
                        />
                        <StatCard
                            title="Uncleared Amount"
                            value={unclearedBookAmount}
                        />
                        <StatCard title="Difference" value={difference} />
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <TransactionTable
                            title="Company's Books"
                            entries={reconciliationData.bookEntries}
                            matchedIds={matchedBookEntries}
                            onMatchToggle={(id) => handleMatchToggle('book', id)}
                            totalDebit={totalBookDebit}
                            totalCredit={totalBookCredit}
                        />
                        <TransactionTable
                            title="Bank Statement"
                            entries={reconciliationData.statementEntries}
                            matchedIds={matchedStatementEntries}
                            onMatchToggle={(id) =>
                                handleMatchToggle('statement', id)
                            }
                            totalDebit={totalStatementDebit}
                            totalCredit={totalStatementCredit}
                            isBankStatement
                        />
                    </div>
                </>
            )}
        </EntityListShell>
    );
}

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
    entries: any[];
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
                    {entries.map((e) => {
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
                                    {format(new Date(e.date), 'dd MMM')}
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
