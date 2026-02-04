'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmPurchaseOrder } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

async function getNextPurchaseOrderNumber(db: Db, userId: ObjectId): Promise<string> {
    const lastOrder = await db.collection<CrmPurchaseOrder>('crm_purchase_orders')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

    if (lastOrder.length === 0) {
        return 'PO-00001';
    }

    const lastNumber = lastOrder[0].orderNumber;
    const matches = lastNumber.match(/^(.*?)(\d+)$/);

    if (matches && matches.length === 3) {
        const prefix = matches[1];
        const numPart = parseInt(matches[2], 10);
        const newNum = numPart + 1;
        const paddedNum = String(newNum).padStart(matches[2].length, '0');
        return `${prefix}${paddedNum}`;
    }

    // Fallback
    return `PO-${Date.now().toString().slice(-5)}`;
}


export async function getPurchaseOrders(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ orders: WithId<CrmPurchaseOrder>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { orders: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: Filter<CrmPurchaseOrder> = { userId: userObjectId };

        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            db.collection('crm_purchase_orders')
                .find(filter)
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_purchase_orders').countDocuments(filter)
        ]);

        return {
            orders: JSON.parse(JSON.stringify(orders)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM purchase orders:", e);
        return { orders: [], total: 0 };
    }
}

export async function savePurchaseOrder(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        let orderNumber = formData.get('orderNumber') as string;
        if (!orderNumber) {
            orderNumber = await getNextPurchaseOrderNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const total = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const orderData: Omit<CrmPurchaseOrder, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            vendorId: new ObjectId(formData.get('vendorId') as string),
            orderNumber: orderNumber,
            orderDate: new Date(formData.get('orderDate') as string),
            expectedDeliveryDate: formData.get('expectedDeliveryDate') ? new Date(formData.get('expectedDeliveryDate') as string) : undefined,
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            total,
            paymentTerms: formData.get('paymentTerms') as string,
            notes: formData.get('notes') as string,
            status: 'Draft',
        };

        if (!orderData.orderNumber || !orderData.vendorId) {
            return { error: 'Order number and vendor are required.' };
        }

        const existing = await db.collection('crm_purchase_orders').findOne({ userId: userObjectId, orderNumber: orderData.orderNumber });
        if (existing) {
            orderData.orderNumber = await getNextPurchaseOrderNumber(db, userObjectId);
        }

        await db.collection('crm_purchase_orders').insertOne({
            ...orderData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/purchases/orders');
        return { message: 'Purchase order saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deletePurchaseOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(orderId)) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_purchase_orders').deleteOne({
            _id: new ObjectId(orderId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Order not found or permission denied.' };
        }

        revalidatePath('/dashboard/crm/purchases/orders');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
