'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmPurchaseOrder, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { requirePermission } from '@/lib/rbac-server';

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

    const orderIdRaw = formData.get('orderId') as string | null;
    const isEdit = !!orderIdRaw && ObjectId.isValid(orderIdRaw);

    const guard = await requirePermission('crm_purchase_order', isEdit ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

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

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when a Purchase Order
        // is created in the context of a parent doc (typically an RFQ
        // or a Vendor Bid). Both fields are optional, so existing
        // flows keep working unchanged.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['rfq', 'vendorBid'];
        if (fromKind && fromId && ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) && ObjectId.isValid(fromId)) {
            const parentCollection: Record<string, string> = {
                rfq: 'crm_rfqs',
                vendorBid: 'crm_vendor_bids',
            };
            const parentNoField: Record<string, string> = {
                rfq: 'rfqNumber',
                vendorBid: 'bidNumber',
            };
            const coll = parentCollection[fromKind];
            try {
                const parent = await db.collection(coll).findOne({
                    _id: new ObjectId(fromId),
                    userId: userObjectId,
                });
                if (parent) {
                    lineage = buildLineageFromParent({
                        kind: fromKind as LineageKind,
                        id: parent._id.toString(),
                        no: (parent[parentNoField[fromKind]] as string | undefined) || undefined,
                        status: (parent.status as string | undefined) || undefined,
                        lineage: (parent.lineage as LineageRef[] | undefined) ?? undefined,
                    });
                }
            } catch {
                // ignore lineage seed failures — purchase order still saves
            }
        }

        const insertResult = await db.collection('crm_purchase_orders').insertOne({
            ...orderData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        // Best-effort back-link onto the parent doc.
        if (lineage && fromKind && fromId) {
            try {
                const parentCollection: Record<string, string> = {
                    rfq: 'crm_rfqs',
                    vendorBid: 'crm_vendor_bids',
                };
                const coll = parentCollection[fromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(fromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'purchaseOrder',
                    id: insertResult.insertedId.toString(),
                    no: orderData.orderNumber,
                    status: orderData.status,
                    createdAt: new Date().toISOString(),
                });
                await db.collection(coll).updateOne(
                    { _id: new ObjectId(fromId) },
                    { $set: { lineage: updatedParentLineage, updatedAt: new Date() } },
                );
            } catch {
                // non-fatal
            }
        }

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

    const guard = await requirePermission('crm_purchase_order', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

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
