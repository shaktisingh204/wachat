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
    filters?: { month?: number, year?: number }
): Promise<{ orders: WithId<CrmPurchaseOrder>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { orders: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        if (filters?.month && filters?.year) {
            const start = new Date(filters.year, filters.month - 1, 1);
            const end = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
            filter.orderDate = { $gte: start, $lte: end };
        }

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

export async function getPurchaseOrderById(id: string): Promise<WithId<CrmPurchaseOrder> | null> {
    if (!ObjectId.isValid(id)) return null;
    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const order = await db.collection<CrmPurchaseOrder>('crm_purchase_orders').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return order ? JSON.parse(JSON.stringify(order)) : null;
    } catch (e) {
        console.error('Failed to fetch purchase order:', e);
        return null;
    }
}

export async function savePurchaseOrder(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const orderIdRaw = formData.get('orderId') as string | null;
        const isEdit = !!orderIdRaw && ObjectId.isValid(orderIdRaw);

        let orderNumber = formData.get('orderNumber') as string;
        if (!orderNumber && !isEdit) {
            orderNumber = await getNextPurchaseOrderNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const total = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const warehouseIdRaw = formData.get('warehouseId') as string | null;
        const warehouseId = warehouseIdRaw && ObjectId.isValid(warehouseIdRaw)
            ? new ObjectId(warehouseIdRaw)
            : undefined;

        const vendorIdRaw = formData.get('vendorId') as string | null;
        if (!vendorIdRaw || !ObjectId.isValid(vendorIdRaw)) {
            return { error: 'Vendor is required.' };
        }

        if (isEdit) {
            const result = await db.collection('crm_purchase_orders').updateOne(
                { _id: new ObjectId(orderIdRaw!), userId: userObjectId },
                {
                    $set: {
                        vendorId: new ObjectId(vendorIdRaw),
                        orderDate: new Date(formData.get('orderDate') as string),
                        expectedDeliveryDate: formData.get('expectedDeliveryDate') ? new Date(formData.get('expectedDeliveryDate') as string) : undefined,
                        currency: formData.get('currency') as string,
                        lineItems,
                        total,
                        paymentTerms: formData.get('paymentTerms') as string,
                        notes: formData.get('notes') as string,
                        warehouseId,
                        updatedAt: new Date(),
                    },
                }
            );

            if (result.matchedCount === 0) {
                return { error: 'Purchase order not found or permission denied.' };
            }

            revalidatePath('/dashboard/crm/purchases/orders');
            revalidatePath(`/dashboard/crm/purchases/orders/${orderIdRaw}/edit`);
            return { message: 'Purchase order updated successfully.' };
        }

        const orderData: Omit<CrmPurchaseOrder, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            vendorId: new ObjectId(vendorIdRaw),
            orderNumber: orderNumber,
            orderDate: new Date(formData.get('orderDate') as string),
            expectedDeliveryDate: formData.get('expectedDeliveryDate') ? new Date(formData.get('expectedDeliveryDate') as string) : undefined,
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            total,
            paymentTerms: formData.get('paymentTerms') as string,
            notes: formData.get('notes') as string,
            status: 'Draft',
            warehouseId,
        };

        if (!orderData.orderNumber) {
            return { error: 'Order number is required.' };
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
