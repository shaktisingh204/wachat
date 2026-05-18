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
import { LoaderCircle, GitCompare, Check } from 'lucide-react';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import { importBankStatement, getReconciliationData } from '@/app/actions/crm-reconciliation.actions';
import type { WithId, CrmPaymentAccount } from '@/lib/definitions';

import { format } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';

type ReconciliationData = {
    bookEntries: any[];
    statementEntries: any[];
};

const StatCard = ({ title, value }: { title: string; value: string | number }) => (
    <div className="p-3 bg-secondary rounded-lg border border-border">
        <p className="text-[12.5px] text-muted-foreground">{title}</p>
        <p className="text-[18px] font-bold text-foreground">{typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : value}</p>
    </div>
);

export default function BankReconciliationPage() {
    const [accounts, setAccounts] = useState<WithId<CrmPaymentAccount>[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [statementFile, setStatementFile] = useState<File | null>(null);
    const [reconciliationData, setReconciliationData] = useState<ReconciliationData | null>(null);
    const [matchedBookEntries, setMatchedBookEntries] = useState<Set<string>>(new Set());
    const [matchedStatementEntries, setMatchedStatementEntries] = useState<Set<string>>(new Set());

    const [isLoading, startLoading] = useTransition();
    const { toast } = useZoruToast();

    useEffect(() => {
        getCrmPaymentAccounts().then(data => {
            setAccounts(data.filter(a => a.accountType === 'bank'));
        });
    }, []);

    const handleFetchData = async () => {
        if (!selectedAccountId || !startDate || !endDate) {
            toast({ title: 'Please select an account and a date range.', variant: 'destructive' });
            return;
        }

        startLoading(async () => {
            const statementEntriesResult = statementFile
                ? await importBankStatement(statementFile)
                : { statementEntries: reconciliationData?.statementEntries || [] };

            if (statementEntriesResult.error) {
                toast({ title: 'Statement Import Error', description: statementEntriesResult.error, variant: 'destructive' });
                return;
            }

            const bookEntriesResult = await getReconciliationData(selectedAccountId, startDate, endDate);

            if (bookEntriesResult.error) {
                toast({ title: 'Error Fetching Book Entries', description: bookEntriesResult.error, variant: 'destructive' });
                return;
            }

            setReconciliationData({
                bookEntries: bookEntriesResult.entries || [],
                statementEntries: statementEntriesResult.statementEntries || [],
            });
            setMatchedBookEntries(new Set());
            setMatchedStatementEntries(new Set());
        });
    };

    const handleMatchToggle = (type: 'book' | 'statement', id: string) => {
        if (type === 'book') {
            setMatchedBookEntries(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                return newSet;
            });
        } else {
             setMatchedStatementEntries(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                return newSet;
            });
        }
    };

    const handleAutoMatch = () => {
        const newMatchedBook = new Set(matchedBookEntries);
        const newMatchedStatement = new Set(matchedStatementEntries);

        reconciliationData?.bookEntries.forEach(bookEntry => {
            if (newMatchedBook.has(bookEntry._id)) return;

            const potentialMatch = reconciliationData.statementEntries.find(stmtEntry =>
                !newMatchedStatement.has(stmtEntry._id) &&
                Math.abs(bookEntry.amount) === Math.abs(stmtEntry.amount)
            );

            if(potentialMatch) {
                newMatchedBook.add(bookEntry._id);
                newMatchedStatement.add(potentialMatch._id);
            }
        });

        setMatchedBookEntries(newMatchedBook);
        setMatchedStatementEntries(newMatchedStatement);
    }

    const handleSave = async () => {
        toast({ title: 'Functionality Coming Soon', description: 'Saving reconciliation status is under development.'})
    }

    const { totalBookDebit, totalBookCredit, clearedBookAmount, unclearedBookAmount, totalStatementDebit, totalStatementCredit, clearedStatementAmount, unclearedStatementAmount } = useMemo(() => {
        if (!reconciliationData) return { totalBookDebit: 0, totalBookCredit: 0, clearedBookAmount: 0, unclearedBookAmount: 0, totalStatementDebit: 0, totalStatementCredit: 0, clearedStatementAmount: 0, unclearedStatementAmount: 0 };

        const bookTotals = reconciliationData.bookEntries.reduce((acc, entry) => {
            const amount = entry.amount;
            if(entry.type === 'debit') acc.totalBookDebit += amount;
            else acc.totalBookCredit += amount;

            if (matchedBookEntries.has(entry._id)) {
                if (entry.type === 'debit') acc.clearedBookAmount += amount;
                else acc.clearedBookAmount -= amount;
            }
            return acc;
        }, { totalBookDebit: 0, totalBookCredit: 0, clearedBookAmount: 0});

        const statementTotals = reconciliationData.statementEntries.reduce((acc, entry) => {
            const amount = entry.amount;
            if (amount > 0) acc.totalStatementDebit += amount;
            else acc.totalStatementCredit += Math.abs(amount);

            if (matchedStatementEntries.has(entry._id)) acc.clearedStatementAmount += amount;
            return acc;
        }, { totalStatementDebit: 0, totalStatementCredit: 0, clearedStatementAmount: 0 });

        const unclearedBook = reconciliationData.bookEntries.filter(e => !matchedBookEntries.has(e._id)).reduce((sum, e) => sum + (e.type === 'debit' ? e.amount : -e.amount), 0);
        const unclearedStatement = reconciliationData.statementEntries.filter(e => !matchedStatementEntries.has(e._id)).reduce((sum, e) => sum + e.amount, 0);

        return {
            totalBookDebit: bookTotals.totalBookDebit,
            totalBookCredit: bookTotals.totalBookCredit,
            clearedBookAmount: bookTotals.clearedBookAmount,
            unclearedBookAmount: unclearedBook,
            totalStatementDebit: statementTotals.totalStatementDebit,
            totalStatementCredit: statementTotals.totalStatementCredit,
            clearedStatementAmount: statementTotals.clearedStatementAmount,
            unclearedStatementAmount: unclearedStatement,
        };
    }, [reconciliationData, matchedBookEntries, matchedStatementEntries]);

    const difference = clearedBookAmount - clearedStatementAmount;

    return (
        <EntityListShell
            title="Bank Reconciliation"
            subtitle="Match your bank statement transactions with your company's book entries."
        >

            <ZoruCard>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2"><ZoruLabel>Bank Account</ZoruLabel><ZoruSelect value={selectedAccountId} onValueChange={setSelectedAccountId}><ZoruSelectTrigger><ZoruSelectValue placeholder="Select Account..." /></ZoruSelectTrigger><ZoruSelectContent>{accounts.map(acc => <ZoruSelectItem key={acc._id.toString()} value={acc._id.toString()}>{acc.accountName}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                    <div className="space-y-2"><ZoruLabel>From</ZoruLabel><ZoruDatePicker value={startDate} onChange={setStartDate} /></div>
                    <div className="space-y-2"><ZoruLabel>To</ZoruLabel><ZoruDatePicker value={endDate} onChange={setEndDate} /></div>
                    <div className="space-y-2"><ZoruLabel>Bank Statement (CSV)</ZoruLabel><ZoruInput type="file" accept=".csv" onChange={(e) => setStatementFile(e.target.files?.[0] || null)} className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                        <ZoruButton onClick={handleFetchData} disabled={isLoading}>Load Data</ZoruButton>
                        <ZoruButton variant="outline" onClick={handleAutoMatch} disabled={!reconciliationData}>Auto-Match</ZoruButton>
                    </div>
                    <ZoruButton onClick={handleSave} disabled={!reconciliationData || difference !== 0}>Save Reconciliation</ZoruButton>
                </div>
            </ZoruCard>

            {reconciliationData && (
                <>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Cleared in Books" value={clearedBookAmount} />
                    <StatCard title="Cleared in Bank" value={clearedStatementAmount} />
                    <StatCard title="Uncleared Amount" value={unclearedBookAmount} />
                    <StatCard title="Difference" value={difference} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TransactionTable title="Company's Books" entries={reconciliationData.bookEntries} matchedIds={matchedBookEntries} onMatchToggle={(id) => handleMatchToggle('book', id)} totalDebit={totalBookDebit} totalCredit={totalBookCredit} />
                    <TransactionTable title="Bank Statement" entries={reconciliationData.statementEntries} matchedIds={matchedStatementEntries} onMatchToggle={(id) => handleMatchToggle('statement', id)} totalDebit={totalStatementDebit} totalCredit={totalStatementCredit} isBankStatement/>
                </div>
                </>
            )}
        </EntityListShell>
    );
}

const TransactionTable = ({ title, entries, matchedIds, onMatchToggle, totalDebit, totalCredit, isBankStatement = false }: { title: string, entries: any[], matchedIds: Set<string>, onMatchToggle: (id: string) => void, totalDebit: number, totalCredit: number, isBankStatement?: boolean }) => (
    <ZoruCard>
        <h3 className="mb-4 text-[15px] font-semibold text-foreground">{title}</h3>
        <div className="overflow-x-auto rounded-lg border border-border max-h-96 overflow-y-auto">
            <ZoruTable>
                <ZoruTableHeader className="sticky top-0 bg-card">
                    <ZoruTableRow className="border-border hover:bg-transparent">
                        <ZoruTableHead className="w-10 text-muted-foreground"><Check className="h-4 w-4"/></ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Description</ZoruTableHead>
                        <ZoruTableHead className="text-right text-muted-foreground">Debit</ZoruTableHead>
                        <ZoruTableHead className="text-right text-muted-foreground">Credit</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {entries.map(entry => {
                         const debit = isBankStatement ? (entry.amount > 0 ? entry.amount : 0) : (entry.type === 'debit' ? entry.amount : 0);
                         const credit = isBankStatement ? (entry.amount < 0 ? Math.abs(entry.amount) : 0) : (entry.type === 'credit' ? entry.amount : 0);
                        return (
                            <ZoruTableRow key={entry._id} className="border-border" data-state={matchedIds.has(entry._id) ? 'selected' : ''}>
                                <ZoruTableCell><ZoruCheckbox checked={matchedIds.has(entry._id)} onCheckedChange={() => onMatchToggle(entry._id)} /></ZoruTableCell>
                                <ZoruTableCell className="text-xs text-foreground">{format(new Date(entry.date), 'dd MMM')}</ZoruTableCell>
                                <ZoruTableCell className="text-xs text-foreground">{entry.description}</ZoruTableCell>
                                <ZoruTableCell className="text-right text-xs font-mono text-foreground">{debit > 0 ? debit.toFixed(2) : ''}</ZoruTableCell>
                                <ZoruTableCell className="text-right text-xs font-mono text-foreground">{credit > 0 ? credit.toFixed(2) : ''}</ZoruTableCell>
                            </ZoruTableRow>
                        )
                    })}
                </ZoruTableBody>
            </ZoruTable>
        </div>
        <div className="flex justify-end gap-6 mt-4 font-semibold text-[13px] pt-2 border-t border-border text-foreground">
            <div className="text-right">Debit: <span className="font-mono">₹{totalDebit.toFixed(2)}</span></div>
            <div className="text-right">Credit: <span className="font-mono">₹{totalCredit.toFixed(2)}</span></div>
        </div>
    </ZoruCard>
)
