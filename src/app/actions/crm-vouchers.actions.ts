
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmVoucherBook, CrmVoucherEntry } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getVoucherBooks(): Promise<WithId<CrmVoucherBook>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const books = await db.collection<CrmVoucherBook>('crm_voucher_books')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(books));
    } catch (e) {
        console.error("Failed to fetch CRM Voucher Books:", e);
        return [];
    }
}

export async function saveVoucherBook(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const bookData: Partial<CrmVoucherBook> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('voucherBookName') as string,
            type: formData.get('voucherBookType') as CrmVoucherBook['type'],
        };
        
        if (!bookData.name || !bookData.type) {
            return { error: 'All fields are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_voucher_books').insertOne({ ...bookData, createdAt: new Date() } as CrmVoucherBook);
        
        revalidatePath('/dashboard/crm/accounting/vouchers');
        return { message: 'Voucher Book created successfully.' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveVoucherEntry(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    try {
        const debitEntries = JSON.parse(formData.get('debitEntries') as string || '[]');
        const creditEntries = JSON.parse(formData.get('creditEntries') as string || '[]');
        
        const totalDebit = debitEntries.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
        const totalCredit = creditEntries.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
        
        if (Math.abs(totalDebit - totalCredit) > 0.01) { // Use a small tolerance for floating point
            return { error: 'Debit and Credit totals must match.' };
        }

        const entryData: Omit<CrmVoucherEntry, '_id' | 'createdAt'> = {
            userId: new ObjectId(session.user._id),
            voucherBookId: new ObjectId(formData.get('voucherBookId') as string), // Assuming this will be passed
            voucherNumber: formData.get('voucherNumber') as string,
            date: new Date(formData.get('date') as string),
            note: formData.get('note') as string,
            debitEntries: debitEntries.map((e: any) => ({ ...e, accountId: new ObjectId(e.accountId) })),
            creditEntries: creditEntries.map((e: any) => ({ ...e, accountId: new ObjectId(e.accountId) })),
            totalDebit,
            totalCredit
        };

        if (!entryData.voucherBookId || !entryData.voucherNumber || !entryData.date) {
            return { error: 'Voucher book, number, and date are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_voucher_entries').insertOne({ ...entryData, createdAt: new Date() } as CrmVoucherEntry);

        revalidatePath('/dashboard/crm/accounting/vouchers');
        return { message: 'Voucher entry created successfully.' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
