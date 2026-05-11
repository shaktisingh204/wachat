'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';

export async function saveGiftCard(
    _prev: any,
    formData: FormData
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const rawCode = (formData.get('code') as string | null)?.trim().toUpperCase() || '';
        const code = rawCode || `GC-${Date.now().toString().slice(-8)}`;

        const valueRaw = parseFloat(formData.get('value') as string);
        if (!valueRaw || isNaN(valueRaw) || valueRaw <= 0) {
            return { error: 'Value is required and must be a positive number.' };
        }

        const issuedTo = (formData.get('issuedTo') as string | null)?.trim() || undefined;
        const issuedToEmail = (formData.get('issuedToEmail') as string | null)?.trim() || undefined;
        const notesRaw = (formData.get('notes') as string | null)?.trim() || undefined;
        const transferable = formData.get('transferable') === 'on';

        const expiryDateRaw = formData.get('expiryDate') as string | null;
        const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : undefined;

        const now = new Date();

        const doc: Record<string, any> = {
            userId: userObjectId,
            code,
            value: valueRaw,
            balance: valueRaw,
            status: 'active',
            transferable,
            createdAt: now,
            updatedAt: now,
        };

        if (issuedTo) doc.issuedTo = issuedTo;
        if (issuedToEmail) doc.issuedToEmail = issuedToEmail;
        if (expiryDate && !isNaN(expiryDate.getTime())) doc.expiryDate = expiryDate;
        if (notesRaw) doc.notes = notesRaw;

        const result = await db.collection('crm_gift_cards').insertOne(doc);

        revalidatePath('/dashboard/crm/sales/gift-cards');
        return {
            message: `Gift card ${code} created successfully.`,
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
