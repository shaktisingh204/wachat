

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmDeliveryChallan } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getDeliveryChallans(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ challans: WithId<CrmDeliveryChallan>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { challans: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmDeliveryChallan> = { userId: userObjectId };
        
        const skip = (page - 1) * limit;

        const [challans, total] = await Promise.all([
            db.collection('crm_delivery_challans')
                .find(filter)
                .sort({ challanDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_delivery_challans').countDocuments(filter)
        ]);

        return {
            challans: JSON.parse(JSON.stringify(challans)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch delivery challans:", e);
        return { challans: [], total: 0 };
    }
}

export async function saveDeliveryChallan(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');

        const challanData: Omit<CrmDeliveryChallan, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: new ObjectId(session.user._id),
            accountId: new ObjectId(formData.get('accountId') as string),
            challanNumber: formData.get('challanNumber') as string,
            challanDate: new Date(formData.get('challanDate') as string),
            lineItems: lineItems,
            reason: formData.get('reason') as string,
            transportDetails: {
                vehicleNumber: formData.get('vehicleNumber') as string,
                driverName: formData.get('driverName') as string,
                mode: formData.get('mode') as string,
            },
            notes: formData.get('notes') as string,
            status: 'Draft',
        };

        if (!challanData.challanNumber || !challanData.accountId || lineItems.length === 0) {
            return { error: 'Challan number, client, and at least one item are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_delivery_challans').insertOne({
            ...challanData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/sales/delivery');
        return { message: 'Delivery Challan saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
