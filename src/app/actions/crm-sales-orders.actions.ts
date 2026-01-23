
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmSalesOrder } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

async function getNextSalesOrderNumber(db: Db, userId: ObjectId): Promise<string> {
    const lastOrder = await db.collection<CrmSalesOrder>('crm_sales_orders')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

    if (lastOrder.length === 0) {
        return 'SO-00001';
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

    // Fallback for unexpected formats
    return `SO-${Date.now().toString().slice(-5)}`;
}


export async function getSalesOrders(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ orders: WithId<CrmSalesOrder>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { orders: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmSalesOrder> = { userId: userObjectId };
        
        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            db.collection('crm_sales_orders')
                .find(filter)
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_sales_orders').countDocuments(filter)
        ]);

        return {
            orders: JSON.parse(JSON.stringify(orders)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM sales orders:", e);
        return { orders: [], total: 0 };
    }
}

export async function saveSalesOrder(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        let orderNumber = formData.get('orderNumber') as string;
        if (!orderNumber) {
            orderNumber = await getNextSalesOrderNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const total = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const orderData: Omit<CrmSalesOrder, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            accountId: new ObjectId(formData.get('accountId') as string),
            orderNumber: orderNumber,
            orderDate: new Date(formData.get('orderDate') as string),
            deliveryDate: formData.get('deliveryDate') ? new Date(formData.get('deliveryDate') as string) : undefined,
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            total,
            paymentTerms: formData.get('paymentTerms') as string,
            shippingDetails: formData.get('shippingDetails') as string,
            notes: formData.get('notes') as string,
            status: 'Draft',
        };

        if (!orderData.orderNumber || !orderData.accountId) {
            return { error: 'Order number and client are required.' };
        }

        const existing = await db.collection('crm_sales_orders').findOne({ userId: userObjectId, orderNumber: orderData.orderNumber });
        if (existing) {
             orderData.orderNumber = await getNextSalesOrderNumber(db, userObjectId);
        }

        await db.collection('crm_sales_orders').insertOne({
            ...orderData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/sales/orders');
        return { message: 'Sales order saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
