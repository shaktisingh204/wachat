'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmGrn, CrmPurchaseOrder, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';

const COLLECTION = 'crm_grns';

/**
 * Fetch all GRNs for the current user. When `poId` is provided, scope
 * the results to that single Purchase Order. Soft-deleted (`archived`)
 * docs are excluded. Sorted newest-first by `createdAt`.
 */
export async function getGrns(poId?: string): Promise<WithId<CrmGrn>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = {
            userId: userObjectId,
            archived: { $ne: true },
        };

        if (poId && ObjectId.isValid(poId)) {
            filter.poId = new ObjectId(poId);
        }

        const grns = await db.collection<CrmGrn>(COLLECTION)
            .find(filter)
            .sort({ createdAt: -1 })
            .toArray();

        return JSON.parse(JSON.stringify(grns));
    } catch (e) {
        console.error('Failed to fetch CRM GRNs:', e);
        return [];
    }
}

/** Fetch a single GRN by id, scoped to the current user. */
export async function getGrnById(grnId: string): Promise<WithId<CrmGrn> | null> {
    if (!ObjectId.isValid(grnId)) return null;
    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const grn = await db.collection<CrmGrn>(COLLECTION).findOne({
            _id: new ObjectId(grnId),
            userId: new ObjectId(session.user._id),
        });
        return grn ? JSON.parse(JSON.stringify(grn)) : null;
    } catch (e) {
        console.error('Failed to fetch GRN:', e);
        return null;
    }
}

/**
 * Create a Goods Receipt Note. When a valid `poId` is supplied the new
 * GRN seeds its `lineage[]` from the parent Purchase Order (using
 * `buildLineageFromParent`) and a back-link is appended onto the PO's
 * own lineage, best-effort.
 */
export async function saveGrn(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const grnNo = (formData.get('grnNo') as string | null)?.trim();
        if (!grnNo) return { error: 'GRN number is required.' };

        const dateRaw = formData.get('date') as string | null;
        if (!dateRaw) return { error: 'Date is required.' };
        const date = new Date(dateRaw);
        if (Number.isNaN(date.getTime())) return { error: 'Invalid date.' };

        const vendorIdRaw = formData.get('vendorId') as string | null;
        if (!vendorIdRaw || !ObjectId.isValid(vendorIdRaw)) {
            return { error: 'Vendor is required.' };
        }

        const warehouseIdRaw = formData.get('warehouseId') as string | null;
        if (!warehouseIdRaw || !ObjectId.isValid(warehouseIdRaw)) {
            return { error: 'Warehouse is required.' };
        }

        // Items — JSON array.
        let items: CrmGrn['items'] = [];
        try {
            const raw = formData.get('items') as string | null;
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) {
                return { error: 'Items must be a JSON array.' };
            }
            items = parsed
                .filter((row) => row && ObjectId.isValid(row.itemId))
                .map((row) => ({
                    itemId: new ObjectId(row.itemId),
                    orderedQty: Number(row.orderedQty) || 0,
                    receivedQty: Number(row.receivedQty) || 0,
                    acceptedQty: Number(row.acceptedQty) || 0,
                    rejectedQty: Number(row.rejectedQty) || 0,
                    ...(row.batch ? { batch: String(row.batch) } : {}),
                    ...(row.expiry ? { expiry: new Date(row.expiry) } : {}),
                    ...(Array.isArray(row.serialNos) && row.serialNos.length
                        ? { serialNos: row.serialNos.map((s: any) => String(s)) }
                        : {}),
                }));
        } catch {
            return { error: 'Items payload is not valid JSON.' };
        }

        // Attachments — JSON array of file ids.
        let attachments: string[] | undefined;
        try {
            const raw = formData.get('attachments') as string | null;
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    attachments = parsed.map((id: any) => String(id));
                }
            }
        } catch {
            return { error: 'Attachments payload is not valid JSON.' };
        }

        const inspectorIdRaw = formData.get('inspectorId') as string | null;
        const inspectorId = inspectorIdRaw && ObjectId.isValid(inspectorIdRaw)
            ? new ObjectId(inspectorIdRaw)
            : undefined;

        const poIdRaw = formData.get('poId') as string | null;
        const poObjectId = poIdRaw && ObjectId.isValid(poIdRaw)
            ? new ObjectId(poIdRaw)
            : undefined;

        // Lineage seeding — when a valid PO is referenced, copy its
        // chain and prepend the PO itself onto the new GRN.
        let lineage: LineageRef[] | undefined;
        let parentPo: WithId<CrmPurchaseOrder> | null = null;
        if (poObjectId) {
            try {
                parentPo = await db.collection<CrmPurchaseOrder>('crm_purchase_orders').findOne({
                    _id: poObjectId,
                    userId: userObjectId,
                });
                if (parentPo) {
                    lineage = buildLineageFromParent({
                        kind: 'purchaseOrder',
                        id: parentPo._id.toString(),
                        no: parentPo.orderNumber,
                        status: parentPo.status,
                        lineage: parentPo.lineage ?? [],
                    });
                }
            } catch {
                // non-fatal — GRN still saves without seeded lineage
            }
        }

        const now = new Date();
        const doc: any = {
            userId: userObjectId,
            grnNo,
            date,
            ...(poObjectId ? { poId: poObjectId } : {}),
            vendorId: new ObjectId(vendorIdRaw),
            warehouseId: new ObjectId(warehouseIdRaw),
            items,
            ...(inspectorId ? { inspectorId } : {}),
            ...(attachments ? { attachments } : {}),
            status: 'draft' as const,
            ...(lineage ? { lineage } : {}),
            createdAt: now,
            updatedAt: now,
        };

        const insertResult = await db.collection(COLLECTION).insertOne(doc);

        // Best-effort back-link: push the new GRN onto the PO's lineage.
        if (parentPo) {
            try {
                const updatedParentLineage = appendLineage(parentPo.lineage, {
                    kind: 'grn',
                    id: insertResult.insertedId.toString(),
                    no: grnNo,
                    status: 'draft',
                    createdAt: now.toISOString(),
                });
                await db.collection('crm_purchase_orders').updateOne(
                    { _id: parentPo._id, userId: userObjectId },
                    { $set: { lineage: updatedParentLineage, updatedAt: now } },
                );
            } catch {
                // non-fatal
            }
        }

        revalidatePath('/dashboard/crm/purchases/grn');
        return { message: 'GRN saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/** Patch the status field of a GRN, scoped to the current user. */
export async function updateGrnStatus(
    grnId: string,
    status: 'draft' | 'inspected' | 'posted' | 'rejected',
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(grnId)) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(grnId), userId: new ObjectId(session.user._id) },
            { $set: { status, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'GRN not found or permission denied.' };
        }

        revalidatePath('/dashboard/crm/purchases/grn');
        revalidatePath(`/dashboard/crm/purchases/grn/${grnId}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/** Soft-delete a GRN by setting `archived: true`. */
export async function deleteGrn(grnId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(grnId)) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(grnId), userId: new ObjectId(session.user._id) },
            { $set: { archived: true, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'GRN not found or permission denied.' };
        }

        revalidatePath('/dashboard/crm/purchases/grn');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
