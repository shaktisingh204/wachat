
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index';
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
    statementId: string, // In a real app we might store the statement file reference or hash
    matchedBookEntryIds: string[],
    matchedStatementEntryIds: string[]
): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    try {
        const { db } = await connectToDatabase();

        // 1. Create a Reconciliation Record
        const reconciliationRecord = {
            userId: new ObjectId(session.user._id),
            accountId: new ObjectId(accountId),
            statementId: statementId || 'manual_import', // simplified
            reconciledDate: new Date(),
            matchedBookEntriesCount: matchedBookEntryIds.length,
            matchedStatementEntriesCount: matchedStatementEntryIds.length,
            matchedBookEntryIds, // Store IDs for reference
            status: 'Completed'
        };

        await db.collection('crm_reconciliations').insertOne(reconciliationRecord);

        // 2. Mark Book Entries as Reconciled (Optional but good for production)
        // This prevents them from appearing in future reconciliations if we filter them out
        // For now, we won't modify the voucher entries directly to avoid complex side effects, 
        // but we'll store the reconciliation record which is sufficient for audit.

        revalidatePath('/dashboard/crm/banking/reconciliation');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
