

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmDeliveryChallan, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';

export async function getDeliveryChallanById(
    challanId: string
): Promise<WithId<CrmDeliveryChallan> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(challanId)) return null;

    try {
        const { db } = await connectToDatabase();
        const challan = await db.collection('crm_delivery_challans').findOne({
            _id: new ObjectId(challanId),
            userId: new ObjectId(session.user._id),
        });
        if (!challan) return null;
        return JSON.parse(JSON.stringify(challan));
    } catch (e) {
        console.error('Failed to fetch delivery challan by id:', e);
        return null;
    }
}

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
        
        const filter: any = { userId: userObjectId };
        
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

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when a delivery challan
        // is created in the context of a parent doc (typically a Sales
        // Order, Invoice, or Quotation). Both fields are optional, so
        // existing flows keep working unchanged.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['salesOrder', 'invoice', 'quotation'];
        if (fromKind && fromId && ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) && ObjectId.isValid(fromId)) {
            const parentCollection: Record<string, string> = {
                salesOrder: 'crm_sales_orders',
                invoice: 'crm_invoices',
                quotation: 'crm_quotations',
            };
            const parentNoField: Record<string, string> = {
                salesOrder: 'orderNumber',
                invoice: 'invoiceNumber',
                quotation: 'quotationNumber',
            };
            const coll = parentCollection[fromKind];
            try {
                const parent = await db.collection(coll).findOne({
                    _id: new ObjectId(fromId),
                    userId: new ObjectId(session.user._id),
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
                // ignore lineage seed failures — challan still saves
            }
        }

        const insertResult = await db.collection('crm_delivery_challans').insertOne({
            ...challanData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        // Best-effort back-link onto the parent doc.
        if (lineage && fromKind && fromId) {
            try {
                const parentCollection: Record<string, string> = {
                    salesOrder: 'crm_sales_orders',
                    invoice: 'crm_invoices',
                    quotation: 'crm_quotations',
                };
                const coll = parentCollection[fromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(fromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'deliveryChallan',
                    id: insertResult.insertedId.toString(),
                    no: challanData.challanNumber,
                    status: challanData.status,
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

        revalidatePath('/dashboard/crm/sales/delivery');
        return { message: 'Delivery Challan saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Hard-delete a delivery challan. Used by the §1D list-page row actions
 * and bulk-delete dialog. Tenant-scoped: only deletes when the
 * `userId` matches the session.
 */
export async function deleteDeliveryChallanAction(
    challanId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    if (!ObjectId.isValid(challanId)) {
        return { success: false, error: 'Invalid challan id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('crm_delivery_challans').deleteOne({
            _id: new ObjectId(challanId),
            userId: new ObjectId(session.user._id),
        });
        if (res.deletedCount === 0) {
            return { success: false, error: 'Challan not found.' };
        }
        revalidatePath('/dashboard/crm/sales/delivery');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
