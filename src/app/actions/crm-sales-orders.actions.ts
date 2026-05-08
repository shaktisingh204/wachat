'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmSalesOrder, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';

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


export async function getSalesOrderById(orderId: string): Promise<WithId<CrmSalesOrder> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (!ObjectId.isValid(orderId)) return null;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const order = await db.collection('crm_sales_orders').findOne({
            _id: new ObjectId(orderId),
            userId: userObjectId,
        });

        if (!order) return null;

        return JSON.parse(JSON.stringify(order));
    } catch (e: any) {
        console.error("Failed to fetch CRM sales order:", e);
        return null;
    }
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

        const filter: any = { userId: userObjectId };

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

        // Lineage seeding (crm_function_plan.md §13.5 / §15 Phase 2).
        // Optional `fromKind` + `fromId` form fields propagate the
        // parent's lineage onto the newly-created sales order. All
        // existing flows keep working unchanged when these fields are
        // absent.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['quotation', 'lead', 'deal', 'proforma'];
        if (fromKind && fromId && ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) && ObjectId.isValid(fromId)) {
            const parentCollection: Record<string, string> = {
                quotation: 'crm_quotations',
                lead: 'crm_leads',
                deal: 'crm_deals',
                proforma: 'crm_proforma_invoices',
            };
            const parentNoField: Record<string, string> = {
                quotation: 'quotationNumber',
                lead: 'title',
                deal: 'name',
                proforma: 'proformaNumber',
            };
            const coll = parentCollection[fromKind];
            try {
                const parent = await db.collection(coll).findOne(
                    { _id: new ObjectId(fromId), userId: userObjectId },
                    { projection: { lineage: 1, [parentNoField[fromKind]]: 1, status: 1 } },
                );
                if (parent) {
                    lineage = buildLineageFromParent({
                        kind: fromKind as LineageKind,
                        id: parent._id.toString(),
                        no: (parent[parentNoField[fromKind]] as string | undefined) || undefined,
                        status: (parent.status as string | undefined) || undefined,
                        lineage: (parent.lineage as LineageRef[] | undefined) ?? [],
                    });
                }
            } catch {
                // ignore lineage seed failures — sales order still saves
            }
        }

        const insertResult = await db.collection('crm_sales_orders').insertOne({
            ...orderData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        // Best-effort back-link onto the parent doc.
        if (lineage && fromKind && fromId) {
            try {
                const parentCollection: Record<string, string> = {
                    quotation: 'crm_quotations',
                    lead: 'crm_leads',
                    deal: 'crm_deals',
                    proforma: 'crm_proforma_invoices',
                };
                const coll = parentCollection[fromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(fromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'salesOrder',
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

        revalidatePath('/dashboard/crm/sales/orders');
        return { message: 'Sales order saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateSalesOrderStatus(
    orderId: string,
    status: string,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(orderId)) return { success: false, error: 'Invalid sales order id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const allowed = ['Draft', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
    if (!allowed.includes(status)) return { success: false, error: 'Invalid status.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_sales_orders').updateOne(
            { _id: new ObjectId(orderId), userId: new ObjectId(session.user._id) },
            { $set: { status, updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) return { success: false, error: 'Sales order not found.' };
        revalidatePath('/dashboard/crm/sales/orders');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteSalesOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(orderId)) return { success: false, error: 'Invalid sales order id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_sales_orders').deleteOne({
            _id: new ObjectId(orderId),
            userId: new ObjectId(session.user._id),
        });
        if (result.deletedCount === 0) return { success: false, error: 'Sales order not found.' };
        revalidatePath('/dashboard/crm/sales/orders');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
