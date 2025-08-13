
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmCreditNote } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCreditNotes(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ notes: WithId<CrmCreditNote>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { notes: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmCreditNote> = { userId: userObjectId };
        
        const skip = (page - 1) * limit;

        const [notes, total] = await Promise.all([
            db.collection('crm_credit_notes')
                .find(filter)
                .sort({ creditNoteDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_credit_notes').countDocuments(filter)
        ]);

        return {
            notes: JSON.parse(JSON.stringify(notes)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch credit notes:", e);
        return { notes: [], total: 0 };
    }
}

export async function saveCreditNote(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const total = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const creditNoteData: Omit<CrmCreditNote, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: new ObjectId(session.user._id),
            accountId: new ObjectId(formData.get('accountId') as string),
            creditNoteNumber: formData.get('creditNoteNumber') as string,
            creditNoteDate: new Date(formData.get('creditNoteDate') as string),
            originalInvoiceNumber: formData.get('originalInvoiceNumber') as string | undefined,
            lineItems: lineItems,
            reason: formData.get('reason') as string,
            currency: formData.get('currency') as string,
            total,
        };

        if (!creditNoteData.creditNoteNumber || !creditNoteData.accountId || lineItems.length === 0) {
            return { error: 'Credit note number, client, and at least one item are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_credit_notes').insertOne({
            ...creditNoteData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/sales/credit-notes');
        return { message: 'Credit Note saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
