'use client';

import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useZoruToast,
  StatCard,
} from '@/components/sabcrm/20ui/compat';
import {
  Check,
  GitCompare, Save, Download } from 'lucide-react';

/**
 * Bank Reconciliation — match worksheet.
 */

import React, { useEffect, useMemo, useState, useTransition } from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import {
    getReconciliationData,
    importBankStatement,
    saveReconciliationDraft,
    loadReconciliationDraft,
    type CsvMapping
} from '@/app/actions/crm-reconciliation.actions';
import type { WithId, CrmPaymentAccount } from '@/lib/definitions';
import { format } from 'date-fns';

type ReconciliationData = {
    bookEntries: any[];
    statementEntries: any[];
};


export default function BankReconciliationMatchPage() {
    const [accounts, setAccounts] = useState<WithId<CrmPaymentAccount>[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [statementFile, setStatementFile] = useState<File | null>(null);
    const [reconciliationData, setReconciliationData] =
        useState<ReconciliationData | null>(null);
    const [matchedBookEntries, setMatchedBookEntries] = useState<Set<string>>(new Set());
    const [matchedStatementEntries, setMatchedStatementEntries] = useState<Set<string>>(new Set());

    const [csvColumns, setCsvColumns] = useState<string[]>([]);
    const [dateCol, setDateCol] = useState('');
    const [descCol, setDescCol] = useState('');
    const [debitCol, setDebitCol] = useState('');
    const [creditCol, setCreditCol] = useState('');

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
            let statementEntries = reconciliationData?.statementEntries || [];
            
            if (statementFile) {
                const mapping: CsvMapping | undefined = (dateCol && descCol && debitCol && creditCol) 
                    ? { dateCol, descCol, debitCol, creditCol } 
                    : undefined;

                const statementResult = await importBankStatement(statementFile, mapping);
                
                if (statementResult.error) {
                    toast({
                        title: 'Statement Import Error',
                        description: statementResult.error,
                        variant: 'destructive',
                    });
                    return;
                }
                
                if (!mapping && statementResult.columns) {
                    setCsvColumns(statementResult.columns);
                    toast({ title: 'Please map CSV columns before proceeding' });
                    return;
                }
                
                statementEntries = statementResult.statementEntries || [];
                setCsvColumns([]); // Hide mapping UI once done
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
                statementEntries,
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
                (se) => {
                    if (nextStmt.has(se._id)) return false;
                    const bAmt = Math.abs(be.amount);
                    const sAmt = Math.abs(se.amount);
                    
                    // Exact match
                    if (bAmt === sAmt) return true;
                    
                    // High-confidence AI/Fuzzy match (within 5 days, amounts within 5% due to FX/fees)
                    const dateDiff = Math.abs(new Date(be.date).getTime() - new Date(se.date).getTime()) / (1000 * 60 * 60 * 24);
                    if (dateDiff <= 5) {
                        const ratio = bAmt / sAmt;
                        if (ratio > 0.95 && ratio < 1.05) return true;
                    }
                    return false;
                }
            );
            if (m) {
                nextBook.add(be._id);
                nextStmt.add(m._id);
            }
        });
        setMatchedBookEntries(nextBook);
        setMatchedStatementEntries(nextStmt);
    };

    const handleSaveDraft = () => {
        if (!selectedAccountId || !reconciliationData) return;
        startLoading(async () => {
            const res = await saveReconciliationDraft(
                selectedAccountId,
                Array.from(matchedBookEntries),
                Array.from(matchedStatementEntries),
                reconciliationData.statementEntries
            );
            if (res.success) {
                toast({ title: 'Draft Saved' });
            } else {
                toast({ title: 'Failed to save draft', description: res.error, variant: 'destructive' });
            }
        });
    };

    const handleLoadDraft = () => {
        if (!selectedAccountId || !startDate || !endDate) {
            toast({ title: 'Please select an account and dates first.' });
            return;
        }
        startLoading(async () => {
            const res = await loadReconciliationDraft(selectedAccountId);
            if (res.data) {
                const draft = res.data;
                const bookResult = await getReconciliationData(selectedAccountId, startDate, endDate);
                setReconciliationData({
                    bookEntries: bookResult.entries || [],
                    statementEntries: draft.statementEntries || []
                });
                setMatchedBookEntries(new Set(draft.matchedBookEntries || []));
                setMatchedStatementEntries(new Set(draft.matchedStatementEntries || []));
                toast({ title: 'Draft Loaded' });
            } else {
                toast({ title: 'No draft found for this account' });
            }
        });
    };

    const handleAddFxAdjustment = (difference: number) => {
        if (!reconciliationData) return;
        const newEntry = {
            _id: `fx-${Date.now()}`,
            date: new Date().toISOString(),
            description: 'Automated FX Gain/Loss Adjustment',
            type: difference > 0 ? 'credit' : 'debit',
            amount: Math.abs(difference)
        };
        setReconciliationData({
            ...reconciliationData,
            bookEntries: [...reconciliationData.bookEntries, newEntry]
        });
        setMatchedBookEntries(prev => new Set(prev).add(newEntry._id));
        toast({ title: 'FX Adjustment Entry Added' });
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

            <Card>
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                        <Label>Bank Account</Label>
                        <Select
                            value={selectedAccountId}
                            onValueChange={setSelectedAccountId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Account…" />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map((a) => (
                                    <SelectItem
                                        key={a._id.toString()}
                                        value={a._id.toString()}
                                    >
                                        {a.accountName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>From</Label>
                        <DatePicker value={startDate} onChange={setStartDate} />
                    </div>
                    <div className="space-y-2">
                        <Label>To</Label>
                        <DatePicker value={endDate} onChange={setEndDate} />
                    </div>
                    <div className="space-y-2">
                        <Label>Bank Statement (CSV)</Label>
                        <Input
                            type="file"
                            accept=".csv"
                            onChange={(e) =>
                                setStatementFile(e.target.files?.[0] || null)
                            }
                            className="h-10"
                        />
                    </div>
                </div>

                {csvColumns.length > 0 && (
                    <div className="mt-6 border border-[var(--st-border)] p-5 rounded-[var(--zoru-radius-lg)] bg-[var(--st-bg-secondary)]">
                        <h4 className="mb-4 text-sm font-semibold text-[var(--st-text)]">Map CSV Columns</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <Label>Date Column</Label>
                                <Select value={dateCol} onValueChange={setDateCol}>
                                    <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                                    <SelectContent>
                                        {csvColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Select value={descCol} onValueChange={setDescCol}>
                                    <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                                    <SelectContent>
                                        {csvColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Debit (Withdrawal)</Label>
                                <Select value={debitCol} onValueChange={setDebitCol}>
                                    <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                                    <SelectContent>
                                        {csvColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Credit (Deposit)</Label>
                                <Select value={creditCol} onValueChange={setCreditCol}>
                                    <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                                    <SelectContent>
                                        {csvColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                        <Button onClick={handleFetchData} disabled={isLoading}>
                            Load Data
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleAutoMatch}
                            disabled={!reconciliationData}
                        >
                            AI Auto-Match
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleSaveDraft}
                            disabled={!reconciliationData || isLoading}
                        >
                            <Save className="mr-2 h-4 w-4" /> Save Draft
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleLoadDraft}
                            disabled={isLoading}
                        >
                            <Download className="mr-2 h-4 w-4" /> Load Draft
                        </Button>
                    </div>
                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                        Auto-save and draft support enabled.
                    </p>
                </div>
            </Card>

            {reconciliationData && (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Cleared in Books" value={`₹${clearedBookAmount.toLocaleString('en-IN')}`} />
                        <StatCard
                            label="Cleared in Bank"
                            value={`₹${clearedStatementAmount.toLocaleString('en-IN')}`}
                        />
                        <StatCard
                            label="Uncleared Amount"
                            value={`₹${unclearedBookAmount.toLocaleString('en-IN')}`}
                        />
                        <Card className="flex flex-col justify-between h-full p-0 overflow-hidden">
                            <div className="p-6 pb-2">
                                <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">Difference</p>
                                <p className={`text-2xl font-semibold tracking-tight ${difference !== 0 ? 'text-[var(--st-danger)]' : 'text-[var(--st-text)]'}`}>
                                    ₹{difference.toLocaleString('en-IN')}
                                </p>
                            </div>
                            {difference !== 0 && (
                                <div className="px-6 pb-6 pt-2">
                                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => handleAddFxAdjustment(difference)}>
                                        Add FX Adjustment
                                    </Button>
                                </div>
                            )}
                        </Card>
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
    <Card>
        <h3 className="mb-4 text-[15px] font-semibold text-[var(--st-text)]">{title}</h3>
        <div className="max-h-96 overflow-x-auto overflow-y-auto rounded-[var(--zoru-radius)] border border-[var(--st-border)]">
            <Table>
                <TableHeader className="sticky top-0 bg-[var(--st-bg-secondary)] z-10">
                    <TableRow className="border-[var(--st-border)] hover:bg-transparent">
                        <TableHead className="w-10 text-[var(--st-text-secondary)]">
                            <Check className="h-4 w-4" />
                        </TableHead>
                        <TableHead className="text-[var(--st-text-secondary)]">Date</TableHead>
                        <TableHead className="text-[var(--st-text-secondary)]">Description</TableHead>
                        <TableHead className="text-right text-[var(--st-text-secondary)]">Debit</TableHead>
                        <TableHead className="text-right text-[var(--st-text-secondary)]">Credit</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
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
                            <TableRow
                                key={e._id}
                                className="border-[var(--st-border)]"
                                data-state={matchedIds.has(e._id) ? 'selected' : ''}
                            >
                                <TableCell>
                                    <Checkbox
                                        checked={matchedIds.has(e._id)}
                                        onCheckedChange={() => onMatchToggle(e._id)}
                                    />
                                </TableCell>
                                <TableCell className="text-xs text-[var(--st-text)]">
                                    {e.date ? format(new Date(e.date), 'dd MMM') : ''}
                                </TableCell>
                                <TableCell className="text-xs text-[var(--st-text)]">
                                    {e.description}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-[var(--st-text)]">
                                    {debit > 0 ? debit.toFixed(2) : ''}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-[var(--st-text)]">
                                    {credit > 0 ? credit.toFixed(2) : ''}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
        <div className="mt-4 flex justify-end gap-6 border-t border-[var(--st-border)] pt-4 text-[13px] font-semibold text-[var(--st-text)]">
            <div className="text-right">
                Debit: <span className="font-mono">₹{totalDebit.toFixed(2)}</span>
            </div>
            <div className="text-right">
                Credit: <span className="font-mono">₹{totalCredit.toFixed(2)}</span>
            </div>
        </div>
    </Card>
);
