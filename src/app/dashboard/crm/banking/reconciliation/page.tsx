
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, GitCompareArrows, LoaderCircle, Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { getCrmPaymentAccounts } from "@/app/actions/crm-payment-accounts.actions";
import { importBankStatement, getReconciliationData, saveReconciliation } from "@/app/actions/crm-reconciliation.actions";
import type { WithId, CrmPaymentAccount, CrmVoucherEntry, BankStatementTransaction } from "@/lib/definitions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

type ReconciliationData = {
    bookEntries: any[];
    statementEntries: any[];
};

const StatCard = ({ title, value }: { title: string; value: string | number }) => (
  <div className="p-3 bg-muted/50 rounded-lg">
    <p className="text-sm text-muted-foreground">{title}</p>
    <p className="text-xl font-bold">{typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : value}</p>
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
    const { toast } = useToast();

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
                toast({ title: "Statement Import Error", description: statementEntriesResult.error, variant: 'destructive' });
                return;
            }

            const bookEntriesResult = await getReconciliationData(selectedAccountId, startDate, endDate);
            
            if (bookEntriesResult.error) {
                toast({ title: "Error Fetching Book Entries", description: bookEntriesResult.error, variant: 'destructive' });
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
        // In a real app, this would save the reconciliation state.
        toast({ title: 'Functionality Coming Soon', description: 'Saving reconciliation status is under development.'})
    }

    const { totalBookDebit, totalBookCredit, clearedBookAmount, unclearedBookAmount, totalStatementDebit, totalStatementCredit, clearedStatementAmount, unclearedStatementAmount } = useMemo(() => {
        if (!reconciliationData) return { totalBookDebit: 0, totalBookCredit: 0, clearedBookAmount: 0, unclearedBookAmount: 0, totalStatementDebit: 0, totalStatementCredit: 0, clearedStatementAmount: 0, unclearedStatementAmount: 0 };
        
        const bookTotals = reconciliationData.bookEntries.reduce((acc, entry) => {
            const amount = entry.amount;
            if(entry.type === 'debit') acc.totalBookDebit += amount;
            else acc.totalBookCredit += amount;
            
            if (matchedBookEntries.has(entry._id)) acc.clearedBookAmount += amount;
            else acc.unclearedBookAmount += amount;
            return acc;
        }, { totalBookDebit: 0, totalBookCredit: 0, clearedBookAmount: 0, unclearedBookAmount: 0});
        
        const statementTotals = reconciliationData.statementEntries.reduce((acc, entry) => {
            const amount = entry.amount;
            if (amount > 0) acc.totalStatementDebit += amount;
            else acc.totalStatementCredit += Math.abs(amount);
            
            if (matchedStatementEntries.has(entry._id)) acc.clearedStatementAmount += amount;
            else acc.unclearedStatementAmount += amount;
            return acc;
        }, { totalStatementDebit: 0, totalStatementCredit: 0, clearedStatementAmount: 0, unclearedStatementAmount: 0 });

        return { ...bookTotals, ...statementTotals };
    }, [reconciliationData, matchedBookEntries, matchedStatementEntries]);
    
    const difference = (clearedBookAmount) - (clearedStatementAmount);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3"><GitCompareArrows className="h-6 w-6"/>Bank Reconciliation</CardTitle>
                    <CardDescription>Match your bank statement transactions with your company's book entries.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2"><Label>Bank Account</Label><Select value={selectedAccountId} onValueChange={setSelectedAccountId}><SelectTrigger><SelectValue placeholder="Select Account..." /></SelectTrigger><SelectContent>{accounts.map(acc => <SelectItem key={acc._id.toString()} value={acc._id.toString()}>{acc.accountName}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>From</Label><DatePicker date={startDate} setDate={setStartDate} /></div>
                    <div className="space-y-2"><Label>To</Label><DatePicker date={endDate} setDate={setEndDate} /></div>
                    <div className="space-y-2"><Label>Bank Statement (CSV)</Label><Input type="file" accept=".csv" onChange={(e) => setStatementFile(e.target.files?.[0] || null)} /></div>
                </CardContent>
                <CardFooter className="justify-between">
                     <div className="flex gap-2">
                        <Button onClick={handleFetchData} disabled={isLoading}>{isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null}Load Data</Button>
                        <Button onClick={handleAutoMatch} variant="outline" disabled={!reconciliationData}>Auto-Match</Button>
                    </div>
                    <Button onClick={handleSave} disabled={!reconciliationData || difference !== 0}>Save Reconciliation</Button>
                </CardFooter>
            </Card>

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
        </div>
    );
}

const TransactionTable = ({ title, entries, matchedIds, onMatchToggle, totalDebit, totalCredit, isBankStatement = false }: { title: string, entries: any[], matchedIds: Set<string>, onMatchToggle: (id: string) => void, totalDebit: number, totalCredit: number, isBankStatement?: boolean }) => (
    <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
            <div className="border rounded-md max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-background"><TableRow><TableHead className="w-10"><Check/></TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {entries.map(entry => {
                             const debit = isBankStatement ? (entry.amount > 0 ? entry.amount : 0) : (entry.type === 'debit' ? entry.amount : 0);
                             const credit = isBankStatement ? (entry.amount < 0 ? Math.abs(entry.amount) : 0) : (entry.type === 'credit' ? entry.amount : 0);
                            return (
                                <TableRow key={entry._id} data-state={matchedIds.has(entry._id) ? 'selected' : ''}>
                                    <TableCell><Checkbox checked={matchedIds.has(entry._id)} onCheckedChange={() => onMatchToggle(entry._id)} /></TableCell>
                                    <TableCell className="text-xs">{format(new Date(entry.date), 'dd MMM')}</TableCell>
                                    <TableCell className="text-xs">{entry.description}</TableCell>
                                    <TableCell className="text-right text-xs font-mono">{debit > 0 ? debit.toFixed(2) : ''}</TableCell>
                                    <TableCell className="text-right text-xs font-mono">{credit > 0 ? credit.toFixed(2) : ''}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="flex justify-end gap-6 mt-4 font-semibold text-sm pt-2 border-t">
                <div className="text-right">Debit: <span className="font-mono">₹{totalDebit.toFixed(2)}</span></div>
                <div className="text-right">Credit: <span className="font-mono">₹{totalCredit.toFixed(2)}</span></div>
            </div>
        </CardContent>
    </Card>
)

```</content>
  </change>
  <change>
    <file>src/app/actions/crm-reconciliation.actions.ts</file>
    <content><![CDATA[
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmVoucherEntry, BankStatement, BankStatementTransaction } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import Papa from 'papaparse';

export async function importBankStatement(file: File): Promise<{ statementEntries?: any[], error?: string }> {
    try {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        
        // This is a naive parser. In a real app, you'd have mappers for different bank formats.
        const transactions = parsed.data.map((row: any, index) => {
            const date = new Date(row['Date'] || row['Transaction Date']);
            const description = row['Description'] || row['Narration'];
            const debit = parseFloat(row['Debit'] || row['Withdrawal'] || '0');
            const credit = parseFloat(row['Credit'] || row['Deposit'] || '0');
            const amount = credit > 0 ? credit : -debit;
            
            if (isNaN(date.getTime()) || !description || isNaN(amount)) {
                console.warn(`Skipping invalid row ${index + 2}:`, row);
                return null;
            }

            return {
                _id: `stmt-${date.toISOString()}-${index}`, // Temporary unique ID
                date,
                description,
                amount,
            };
        }).filter(Boolean);
        
        return { statementEntries: transactions };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getReconciliationData(accountId: string, startDate: Date, endDate: Date): Promise<{ entries?: any[], error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const { db } = await connectToDatabase();
        const accountObjectId = new ObjectId(accountId);

        const voucherEntries = await db.collection<CrmVoucherEntry>('crm_voucher_entries').find({
            userId: new ObjectId(session.user._id),
            date: { $gte: startDate, $lte: endDate },
            $or: [
                { 'debitEntries.accountId': accountObjectId },
                { 'creditEntries.accountId': accountObjectId },
            ],
        }).toArray();
        
        const bookEntries = voucherEntries.flatMap(entry => {
            const debits = entry.debitEntries
                .filter(d => d.accountId.equals(accountObjectId))
                .map(d => ({ _id: entry._id.toString() + '-dr', date: entry.date, description: entry.note || `Voucher ${entry.voucherNumber}`, type: 'debit', amount: d.amount }));

            const credits = entry.creditEntries
                .filter(c => c.accountId.equals(accountObjectId))
                .map(c => ({ _id: entry._id.toString() + '-cr', date: entry.date, description: entry.note || `Voucher ${entry.voucherNumber}`, type: 'credit', amount: c.amount }));

            return [...debits, ...credits];
        });

        return { entries: bookEntries };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveReconciliation(
    accountId: string, 
    statementId: string,
    matchedBookEntryIds: string[],
    matchedStatementEntryIds: string[]
): Promise<{ success: boolean, error?: string }> {
    // This is a placeholder for saving the state of a reconciliation
    // In a real app, you would save which entries are matched for a given statement and account.
    return { success: true, error: "Saving functionality is not yet implemented." };
}

```</content>
  </change>
  <change>
    <file>src/app/actions/index.ts</file>
    <content><![CDATA[
// This file is intentionally left blank.
// Server actions are co-located in their respective feature files (e.g., src/app/actions/project.actions.ts).
// This file can be used for global actions if needed in the future.

// For backwards compatibility, re-exporting from the new locations
export * from './user.actions';
export * from './project.actions';
export * from './whatsapp.actions';
export * from './broadcast.actions';
export * from './webhook.actions';
export * from './billing.actions';
export * from './contact.actions';
export * from './api-keys.actions';
export * from './url-shortener.actions';
export * from './qr-code.actions';
export * from './integrations.actions';
export * from './flow.actions';
export * from './meta-flow.actions';
export * from './facebook.actions';
export * from './instagram.actions';
export * from './custom-ecommerce.actions';
export * from './portfolio.actions';
export * from './crm.actions';
export * from './crm-accounts.actions';
export * from './crm-deals.actions';
export * from './crm-tasks.actions';
export * from './crm-email.actions';
export * from './crm-email-templates.actions';
export * from './crm-automations.actions';
export * from './crm-reports.actions';
export * from './crm-products.actions';
export * from './crm-warehouses.actions';
export * from './crm-inventory.actions';
export * from './crm-vendors.actions';
export * from './crm-quotations.actions';
export * from './crm-invoices.actions';
export * from './crm-payment-receipts.actions';
export * from './crm-sales-orders.actions';
export * from './crm-delivery-challans.actions';
export * from './crm-credit-notes.actions';
export * from './crm-forms.actions';
export * from './crm-accounting.actions';
export * from './crm-vouchers.actions';
export * from './crm-pipelines.actions';
export * from './crm-payment-accounts.actions';
export * from './crm-reconciliation.actions';
export * from './email.actions';
export * from './sms.actions';
export * from './seo.actions';
export * from './template.actions';
export * from './calling.actions';
export * from './catalog.actions';
export * from './facebook-flow.actions';
export * from './plan.actions';
export * from './notification.actions';
export * from './ai-actions';
export * from './admin.actions';


// This needs to be a server action file, so we export a dummy function
export async function dummyAction() {
    'use server';
    // This function does nothing.
}

    
