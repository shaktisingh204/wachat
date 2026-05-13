'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';

export async function getGiftCardById(
    giftCardId: string,
): Promise<Record<string, any> | null> {
    if (!giftCardId || !ObjectId.isValid(giftCardId)) return null;

    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_gift_cards').findOne({
            _id: new ObjectId(giftCardId),
            userId: new ObjectId(session.user._id),
        });
        return doc ? JSON.parse(JSON.stringify(doc)) : null;
    } catch (e) {
        console.error('getGiftCardById error:', e);
        return null;
    }
}

export async function updateGiftCard(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const giftCardId = (formData.get('giftCardId') as string | null) || '';
    if (!giftCardId || !ObjectId.isValid(giftCardId)) {
        return { error: 'Invalid gift card id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const issuedTo = (formData.get('issuedTo') as string | null)?.trim() || undefined;
        const issuedToEmail = (formData.get('issuedToEmail') as string | null)?.trim() || undefined;
        const notes = (formData.get('notes') as string | null)?.trim() || undefined;
        const transferable = formData.get('transferable') === 'on';
        const expiryDateRaw = formData.get('expiryDate') as string | null;
        const status = (formData.get('status') as string | null) || undefined;

        const $set: Record<string, any> = {
            transferable,
            updatedAt: new Date(),
        };
        if (issuedTo !== undefined) $set.issuedTo = issuedTo;
        if (issuedToEmail !== undefined) $set.issuedToEmail = issuedToEmail;
        if (notes !== undefined) $set.notes = notes;
        if (status) $set.status = status;
        if (expiryDateRaw) {
            const d = new Date(expiryDateRaw);
            if (!isNaN(d.getTime())) $set.expiryDate = d;
        }

        const result = await db.collection('crm_gift_cards').updateOne(
            { _id: new ObjectId(giftCardId), userId: userObjectId },
            { $set },
        );

        if (result.matchedCount === 0) {
            return { error: 'Gift card not found.' };
        }

        revalidatePath('/dashboard/crm/sales/gift-cards');
        revalidatePath(`/dashboard/crm/sales/gift-cards/${giftCardId}`);
        return { message: 'Gift card updated successfully.', id: giftCardId };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

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
