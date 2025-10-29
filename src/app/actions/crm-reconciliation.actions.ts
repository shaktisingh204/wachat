
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
