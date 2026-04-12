'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmPayout } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';


export async function getPayouts(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ payouts: WithId<CrmPayout>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { payouts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        const skip = (page - 1) * limit;

        const [payouts, total] = await Promise.all([
            db.collection<CrmPayout>('crm_payouts')
                .find(filter as any)
                .sort({ paymentDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_payouts').countDocuments(filter as any)
        ]);

        return {
            payouts: JSON.parse(JSON.stringify(payouts)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM payouts:", e);
        return { payouts: [], total: 0 };
    }
}

export async function savePayout(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const payoutData: Omit<CrmPayout, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            vendorId: new ObjectId(formData.get('vendorId') as string),
            amount: parseFloat(formData.get('amount') as string),
            currency: formData.get('currency') as string,
            paymentDate: new Date(formData.get('paymentDate') as string),
            paymentMode: formData.get('paymentMode') as CrmPayout['paymentMode'],
            referenceNumber: formData.get('referenceNumber') as string,
            notes: formData.get('notes') as string,
        };

        if (!payoutData.vendorId || !payoutData.amount || !payoutData.paymentDate) {
            return { error: 'Vendor, amount, and date are required.' };
        }

        await db.collection('crm_payouts').insertOne({
            ...payoutData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/purchases/payouts');
        return { message: 'Payout recorded successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deletePayout(payoutId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(payoutId)) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_payouts').deleteOne({
            _id: new ObjectId(payoutId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Payout not found or permission denied.' };
        }

        revalidatePath('/dashboard/crm/purchases/payouts');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
