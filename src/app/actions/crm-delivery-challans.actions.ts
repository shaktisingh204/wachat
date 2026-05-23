'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmDeliveryChallan, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmDeliveryChallansApi } from '@/lib/rust-client/crm-delivery-challans';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getDeliveryChallanById(
    challanId: string
): Promise<WithId<CrmDeliveryChallan> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(challanId)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmDeliveryChallansApi.getById(challanId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getDeliveryChallanById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'delivery_challan',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

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

export async function getDeliveryChallansByIds(
    challanIds: string[]
): Promise<WithId<CrmDeliveryChallan>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    if (!challanIds || challanIds.length === 0) return [];

    const validIds = challanIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    if (validIds.length === 0) return [];

    try {
        const { db } = await connectToDatabase();
        const challans = await db.collection('crm_delivery_challans').find({
            _id: { $in: validIds },
            userId: new ObjectId(session.user._id),
        }).toArray();
        return JSON.parse(JSON.stringify(challans));
    } catch (e) {
        console.error('Failed to fetch delivery challans by ids:', e);
        return [];
    }
}

export async function getDeliveryChallans(
    page: number = 1,
    limit: number = 20,
    query?: string,
    filters?: {
        status?: string;
        clientId?: string;
        transporterId?: string;
        dateFrom?: string;
        dateTo?: string;
        warehouseId?: string;
    }
): Promise<{ challans: WithId<CrmDeliveryChallan>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { challans: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: any = { userId: userObjectId };
        
        if (query) {
            filter.challanNumber = { $regex: query, $options: 'i' };
        }
        
        if (filters?.status) {
            filter.status = filters.status;
        }
        
        if (filters?.clientId && ObjectId.isValid(filters.clientId)) {
            filter.accountId = new ObjectId(filters.clientId);
        }
        
        if (filters?.dateFrom || filters?.dateTo) {
            filter.challanDate = {};
            if (filters.dateFrom) {
                const df = new Date(filters.dateFrom);
                if (!isNaN(df.getTime())) {
                    filter.challanDate.$gte = df;
                }
            }
            if (filters.dateTo) {
                const dt = new Date(filters.dateTo);
                if (!isNaN(dt.getTime())) {
                    filter.challanDate.$lte = dt;
                }
            }
            if (Object.keys(filter.challanDate).length === 0) {
                delete filter.challanDate;
            }
        }
        
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

export async function saveDeliveryChallan(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const id = (formData.get('_id') as string | null) ?? '';

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

        // §13.5 lineage hints — pulled once so both code paths (Rust /
        // Mongo fallback) can forward them. The Rust handler now owns
        // the parent lookup + chain build, so the action no longer has
        // to duplicate that logic on the create path.
        const fromKindRaw = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['salesOrder', 'invoice', 'quotation'];
        const fromKind: 'salesOrder' | 'invoice' | 'quotation' | null =
            fromKindRaw && ALLOWED_PARENT_KINDS.includes(fromKindRaw as LineageKind)
                ? (fromKindRaw as 'salesOrder' | 'invoice' | 'quotation')
                : null;

        // ── Rust path (create only — update still goes through Mongo
        // for now, since the Rust update handler does not own lineage).
        // The Rust handler reads `fromKind`/`fromId` and stamps the
        // lineage chain on the new DC inside the same insert, replacing
        // the old post-create Mongo back-fill in this action.
        if (!id && useRustCrm()) {
            try {
                const challanDateRaw = formData.get('challanDate') as string;
                const challanDateIso = challanDateRaw
                    ? new Date(challanDateRaw).toISOString()
                    : new Date().toISOString();
                const created = await crmDeliveryChallansApi.create({
                    challanNumber: challanData.challanNumber,
                    accountId: challanData.accountId?.toString(),
                    challanDate: challanDateIso,
                    lineItems: lineItems,
                    reason: challanData.reason || undefined,
                    transportDetails: challanData.transportDetails,
                    notes: challanData.notes || undefined,
                    ...(fromKind && fromId && ObjectId.isValid(fromId)
                        ? { fromKind, fromId }
                        : {}),
                });
                revalidatePath('/dashboard/crm/sales/delivery');
                return {
                    message: 'Delivery Challan saved successfully.',
                    id: created.id,
                };
            } catch (e) {
                console.error('[saveDeliveryChallan] rust path failed; falling back:', e);
                recordRustFallback({
                    entity: 'delivery_challan',
                    op: 'create',
                    errorCode: e instanceof RustApiError ? e.code : undefined,
                    status: e instanceof RustApiError ? e.status : undefined,
                });
                // fall through to Mongo path
            }
        }

        const { db } = await connectToDatabase();

        // PATCH branch — when the form ships a hidden `_id`, update in place.
        if (id && ObjectId.isValid(id)) {
            const { userId: _u, ...patch } = challanData;
            const result = await db.collection('crm_delivery_challans').updateOne(
                {
                    _id: new ObjectId(id),
                    userId: new ObjectId(session.user._id),
                },
                {
                    $set: {
                        ...patch,
                        updatedAt: new Date(),
                    },
                },
            );
            if (result.matchedCount === 0) {
                return { error: 'Delivery challan not found.' };
            }
            revalidatePath('/dashboard/crm/sales/delivery');
            revalidatePath(`/dashboard/crm/sales/delivery/${id}`);
            return { message: 'Delivery Challan updated.', id };
        }

        // Mongo-fallback lineage seeding. Only reached when the Rust
        // path is disabled or failed — the Rust handler owns the
        // canonical implementation in
        // `crm-delivery-challans::seed_lineage_from_parent`.
        let lineage: LineageRef[] | undefined;
        if (fromKind && fromId && ObjectId.isValid(fromId)) {
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

        const insertedId = insertResult.insertedId.toString();

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
        return { message: 'Delivery Challan saved successfully.', id: insertedId };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * KPI snapshot for the delivery list page. Multi-tenant: only counts
 * challans owned by the calling session's user.
 */
export interface DeliveryChallanKpis {
    totalChallans: number;
    inTransit: number;
    deliveredToday: number;
    returned: number;
    draft: number;
    delivered: number;
}

export async function getDeliveryChallanKpis(): Promise<DeliveryChallanKpis> {
    const empty: DeliveryChallanKpis = {
        totalChallans: 0,
        inTransit: 0,
        deliveredToday: 0,
        returned: 0,
        draft: 0,
        delivered: 0,
    };
    const session = await getSession();
    if (!session?.user) return empty;
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const [totalChallans, inTransit, deliveredToday, returned, draft, delivered] =
            await Promise.all([
                db.collection('crm_delivery_challans').countDocuments({
                    userId: userObjectId,
                }),
                db.collection('crm_delivery_challans').countDocuments({
                    userId: userObjectId,
                    status: 'In Transit',
                }),
                db.collection('crm_delivery_challans').countDocuments({
                    userId: userObjectId,
                    status: 'Delivered',
                    challanDate: { $gte: dayStart, $lt: dayEnd },
                }),
                db.collection('crm_delivery_challans').countDocuments({
                    userId: userObjectId,
                    status: 'Returned',
                }),
                db.collection('crm_delivery_challans').countDocuments({
                    userId: userObjectId,
                    status: 'Draft',
                }),
                db.collection('crm_delivery_challans').countDocuments({
                    userId: userObjectId,
                    status: 'Delivered',
                }),
            ]);
        return { totalChallans, inTransit, deliveredToday, returned, draft, delivered };
    } catch (e) {
        console.error('[getDeliveryChallanKpis] failed:', e);
        return empty;
    }
}

/**
 * Update the workflow status of a delivery challan. Tenant-scoped.
 * Used by the list-page bulk-status select.
 */
export async function setDeliveryChallanStatus(
    challanId: string,
    status: 'Draft' | 'In Transit' | 'Delivered' | 'Returned',
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    if (!ObjectId.isValid(challanId)) {
        return { success: false, error: 'Invalid challan id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('crm_delivery_challans').updateOne(
            {
                _id: new ObjectId(challanId),
                userId: new ObjectId(session.user._id),
            },
            { $set: { status, updatedAt: new Date() } },
        );
        if (res.matchedCount === 0) {
            return { success: false, error: 'Challan not found.' };
        }
        revalidatePath('/dashboard/crm/sales/delivery');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
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
