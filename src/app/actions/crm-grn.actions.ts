'use server';

/**
 * CRM GRN (Goods Receipt Note) server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, mutations delegate to
 *    `/v1/crm/grns` on the Rust BFF via `src/lib/rust-client/crm-grns.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs against
 *    `crm_grns`.
 *
 * Export shapes are identical across both paths so the existing pages at
 * `/dashboard/crm/purchases/grn/**` keep working without changes.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmGrn, CrmPurchaseOrder, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import {
    crmGrnsApi,
    type CrmGrnDoc,
    type CrmGrnLineItem,
} from '@/lib/rust-client/crm-grns';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

const COLLECTION = 'crm_grns';

/** Map the Rust DTO to the loose WithId<CrmGrn> legacy callers expect. */
function rustDocToLegacy(doc: CrmGrnDoc): WithId<CrmGrn> {
    return JSON.parse(JSON.stringify(doc)) as WithId<CrmGrn>;
}

/**
 * Fetch all GRNs for the current user. When `poId` is provided, scope
 * the results to that single Purchase Order. Soft-deleted (`archived`)
 * docs are excluded. Sorted newest-first by `createdAt`.
 */
export async function getGrns(poId?: string): Promise<WithId<CrmGrn>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_grn', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const grns = await crmGrnsApi.list({
                page: 0,
                limit: 200,
                ...(poId ? { poId } : {}),
            });
            return grns.map(rustDocToLegacy);
        } catch (e) {
            console.error('[getGrns] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'grn', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

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
    if (!grnId) return null;
    const session = await getSession();
    if (!session?.user) return null;

    const guard = await requirePermission('crm_grn', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmGrnsApi.getById(grnId);
            return doc ? rustDocToLegacy(doc) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getGrnById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'grn', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(grnId)) return null;

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

    const guard = await requirePermission('crm_grn', 'create');
    if (!guard.ok) return { error: guard.error };

    const grnNo = (formData.get('grnNo') as string | null)?.trim();
    if (!grnNo) return { error: 'GRN number is required.' };

    const dateRaw = formData.get('date') as string | null;
    if (!dateRaw) return { error: 'Date is required.' };
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) return { error: 'Invalid date.' };

    const vendorIdRaw = formData.get('vendorId') as string | null;
    if (!vendorIdRaw) {
        return { error: 'Vendor is required.' };
    }

    const warehouseIdRaw = formData.get('warehouseId') as string | null;
    if (!warehouseIdRaw) {
        return { error: 'Warehouse is required.' };
    }

    if (useRustCrm()) {
        try {
            // Items — JSON array.
            let items: CrmGrnLineItem[] = [];
            try {
                const raw = formData.get('items') as string | null;
                const parsed = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(parsed)) {
                    return { error: 'Items must be a JSON array.' };
                }
                items = parsed
                    .filter((row) => row && typeof row.itemId === 'string' && row.itemId)
                    .map((row) => ({
                        itemId: String(row.itemId),
                        orderedQty: Number(row.orderedQty) || 0,
                        receivedQty: Number(row.receivedQty) || 0,
                        acceptedQty: Number(row.acceptedQty) || 0,
                        rejectedQty: Number(row.rejectedQty) || 0,
                        ...(row.batch ? { batch: String(row.batch) } : {}),
                        ...(row.expiry ? { expiry: new Date(row.expiry).toISOString() } : {}),
                        ...(Array.isArray(row.serialNos) && row.serialNos.length
                            ? { serialNos: row.serialNos.map((s: any) => String(s)) }
                            : {}),
                    }));
            } catch {
                return { error: 'Items payload is not valid JSON.' };
            }

            // Attachments
            let attachments: { url: string; name?: string }[] | undefined;
            try {
                const raw = formData.get('attachments') as string | null;
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        attachments = parsed
                            .filter((id: any): id is string => typeof id === 'string' && !!id)
                            .map((id) => ({ url: id }));
                    }
                }
            } catch {
                return { error: 'Attachments payload is not valid JSON.' };
            }

            const inspectorIdRaw = (formData.get('inspectorId') as string | null) || undefined;
            const poIdRaw = (formData.get('poId') as string | null) || undefined;
            const projectId = (formData.get('projectId') as string | null) || undefined;

            const created = await crmGrnsApi.create({
                grnNo,
                date: date.toISOString(),
                vendorId: vendorIdRaw,
                warehouseId: warehouseIdRaw,
                items,
                ...(poIdRaw ? { poId: poIdRaw } : {}),
                ...(inspectorIdRaw ? { inspectorId: inspectorIdRaw } : {}),
                ...(attachments && attachments.length ? { attachments } : {}),
                ...(projectId ? { projectId } : {}),
            });

            const id = String(created._id ?? '');
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'grn',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/purchases/grn');
            return { message: 'GRN saved successfully.' };
        } catch (e) {
            console.error('[saveGrn] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'grn', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through to legacy
        }
    }

    if (!ObjectId.isValid(vendorIdRaw)) {
        return { error: 'Vendor is required.' };
    }
    if (!ObjectId.isValid(warehouseIdRaw)) {
        return { error: 'Warehouse is required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

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

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'grn',
                entityId: insertResult.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
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
    if (!grnId) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_grn', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmGrnsApi.update(grnId, { status });
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'status_change',
                    entityKind: 'grn',
                    entityId: grnId,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/purchases/grn');
            revalidatePath(`/dashboard/crm/purchases/grn/${grnId}`);
            return { success: true };
        } catch (e) {
            console.error('[updateGrnStatus] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'grn', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(grnId)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(grnId), userId: new ObjectId(session.user._id) },
            { $set: { status, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'GRN not found or permission denied.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'status_change',
                entityKind: 'grn',
                entityId: grnId,
            });
        } catch {
            /* non-fatal */
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
    if (!grnId) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_grn', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmGrnsApi.delete(grnId);
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'grn',
                    entityId: grnId,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/purchases/grn');
            return { success: true };
        } catch (e) {
            console.error('[deleteGrn] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'grn', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(grnId)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(grnId), userId: new ObjectId(session.user._id) },
            { $set: { archived: true, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'GRN not found or permission denied.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'grn',
                entityId: grnId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/purchases/grn');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
