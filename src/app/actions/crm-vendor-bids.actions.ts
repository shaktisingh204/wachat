'use server';

/**
 * CRM Vendor Bid server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, mutations delegate to
 *    `/v1/crm/vendor-bids` on the Rust BFF via
 *    `src/lib/rust-client/crm-vendor-bids.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs against
 *    `crm_vendor_bids`.
 *
 * Export shapes are identical across both paths so the existing
 * `/dashboard/crm/purchase/vendor-bids/**` pages keep working.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmVendorBid, CrmRfq, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import {
    crmVendorBidsApi,
    type CrmVendorBidDoc,
    type CrmVendorBidLineItem,
} from '@/lib/rust-client/crm-vendor-bids';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/** Map the Rust DTO to the loose WithId<CrmVendorBid> legacy callers expect. */
function rustDocToLegacy(doc: CrmVendorBidDoc): WithId<CrmVendorBid> {
    const serialized = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
    // legacy field aliases used by older list views
    if (
        serialized.totals &&
        typeof (serialized.totals as any).total === 'number' &&
        serialized.total == null
    ) {
        serialized.total = (serialized.totals as any).total;
    }
    if (
        serialized.totals &&
        typeof (serialized.totals as any).subTotal === 'number' &&
        serialized.subTotal == null
    ) {
        serialized.subTotal = (serialized.totals as any).subTotal;
    }
    return serialized as WithId<CrmVendorBid>;
}

/**
 * List vendor bids for the current user, optionally filtered by RFQ.
 * Sorted by `submittedAt` descending so the newest bids surface first.
 */
export async function getVendorBids(rfqId?: string): Promise<WithId<CrmVendorBid>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            const bids = await crmVendorBidsApi.list({
                page: 0,
                limit: 200,
                ...(rfqId ? { rfqId } : {}),
            });
            return bids.map(rustDocToLegacy);
        } catch (e) {
            console.error('[getVendorBids] rust path failed; falling back:', e);
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: Record<string, unknown> = { userId: userObjectId };
        if (rfqId && ObjectId.isValid(rfqId)) {
            filter.rfqId = new ObjectId(rfqId);
        }

        const bids = await db.collection('crm_vendor_bids')
            .find(filter)
            .sort({ submittedAt: -1 })
            .toArray();

        return JSON.parse(JSON.stringify(bids));
    } catch (e) {
        console.error('Failed to fetch CRM vendor bids:', e);
        return [];
    }
}

/** Fetch a single vendor bid by id, scoped to the current user. */
export async function getVendorBidById(bidId: string): Promise<WithId<CrmVendorBid> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!bidId) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmVendorBidsApi.getById(bidId);
            return doc ? rustDocToLegacy(doc) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getVendorBidById] rust path failed; falling back:', e);
            // fall through
        }
    }

    if (!ObjectId.isValid(bidId)) return null;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const bid = await db.collection('crm_vendor_bids').findOne({
            _id: new ObjectId(bidId),
            userId: userObjectId,
        });

        if (!bid) return null;
        return JSON.parse(JSON.stringify(bid));
    } catch (e) {
        console.error('Failed to fetch CRM vendor bid:', e);
        return null;
    }
}

/**
 * Create a vendor bid in response to an RFQ. Every bid has an RFQ
 * parent, so we always seed `lineage` from the RFQ and write a
 * back-link onto the parent RFQ. Totals are pre-tax (subTotal === total).
 */
export async function saveVendorBid(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_vendor_bid', 'create');
    if (!guard.ok) return { error: guard.error };

    const rfqIdRaw = formData.get('rfqId') as string | null;
    const vendorIdRaw = formData.get('vendorId') as string | null;
    const currency = (formData.get('currency') as string | null) || '';

    if (!rfqIdRaw) {
        return { error: 'A valid RFQ id is required.' };
    }
    if (!vendorIdRaw) {
        return { error: 'A valid vendor id is required.' };
    }
    if (!currency) {
        return { error: 'Currency is required.' };
    }

    if (useRustCrm()) {
        try {
            // Parse line items.
            const itemsRaw = formData.get('items') as string | null;
            let parsedItems: Array<{
                itemId: string;
                qty: number;
                rate: number;
                leadTimeDays?: number;
                notes?: string;
            }> = [];
            try {
                const parsed = JSON.parse(itemsRaw || '[]');
                if (Array.isArray(parsed)) parsedItems = parsed;
            } catch {
                return { error: 'Items payload is not valid JSON.' };
            }
            if (parsedItems.length === 0) {
                return { error: 'At least one bid line item is required.' };
            }

            const items: CrmVendorBidLineItem[] = parsedItems.map((l) => ({
                itemId: String(l.itemId),
                qty: Number(l.qty) || 0,
                rate: Number(l.rate) || 0,
                ...(l.leadTimeDays !== undefined ? { leadTimeDays: Number(l.leadTimeDays) || 0 } : {}),
                ...(l.notes ? { notes: l.notes } : {}),
            }));

            const subTotal = items.reduce((s, l) => s + l.qty * l.rate, 0);
            const total = subTotal;

            const attachmentsRaw = formData.get('attachments') as string | null;
            let attachments: { fileId: string }[] | undefined;
            if (attachmentsRaw) {
                try {
                    const parsed = JSON.parse(attachmentsRaw);
                    if (Array.isArray(parsed)) {
                        attachments = parsed
                            .filter((u: any): u is string => typeof u === 'string' && !!u)
                            .map((id) => ({ fileId: id }));
                    }
                } catch {
                    // ignore
                }
            }

            const terms = (formData.get('terms') as string | null) || undefined;
            const vendorName = (formData.get('vendorName') as string | null) || undefined;
            const projectId = (formData.get('projectId') as string | null) || undefined;

            const created = await crmVendorBidsApi.create({
                rfqId: rfqIdRaw,
                vendorId: vendorIdRaw,
                items,
                totals: { subTotal, total },
                currency,
                ...(terms ? { terms } : {}),
                ...(vendorName ? { vendorName } : {}),
                ...(attachments && attachments.length ? { attachments } : {}),
                ...(projectId ? { projectId } : {}),
            });

            const id = String(created._id ?? '');
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'vendor_bid',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/purchase/vendor-bids');
            revalidatePath('/dashboard/crm/purchase/rfqs');
            return { message: 'Vendor bid saved successfully.' };
        } catch (e) {
            if (e instanceof RustApiError) {
                console.error('[saveVendorBid] rust path failed; falling back:', e);
            } else {
                console.error('[saveVendorBid] rust path failed; falling back:', e);
            }
            // fall through to legacy
        }
    }

    if (!ObjectId.isValid(rfqIdRaw)) {
        return { error: 'A valid RFQ id is required.' };
    }
    if (!ObjectId.isValid(vendorIdRaw)) {
        return { error: 'A valid vendor id is required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        // Parse line items.
        const itemsRaw = formData.get('items') as string | null;
        let parsedItems: Array<{
            itemId: string;
            qty: number;
            rate: number;
            leadTimeDays?: number;
            notes?: string;
        }> = [];
        try {
            const parsed = JSON.parse(itemsRaw || '[]');
            if (Array.isArray(parsed)) parsedItems = parsed;
        } catch {
            return { error: 'Items payload is not valid JSON.' };
        }
        if (parsedItems.length === 0) {
            return { error: 'At least one bid line item is required.' };
        }

        const items = parsedItems.map((l) => ({
            itemId: new ObjectId(l.itemId),
            qty: Number(l.qty) || 0,
            rate: Number(l.rate) || 0,
            ...(l.leadTimeDays !== undefined ? { leadTimeDays: Number(l.leadTimeDays) || 0 } : {}),
            ...(l.notes ? { notes: l.notes } : {}),
        }));

        const subTotal = items.reduce((s, l) => s + l.qty * l.rate, 0);
        const total = subTotal; // bids are pre-tax — no tax math here.

        // Parse attachments (array of SabFile ids).
        const attachmentsRaw = formData.get('attachments') as string | null;
        let attachments: string[] | undefined;
        if (attachmentsRaw) {
            try {
                const parsed = JSON.parse(attachmentsRaw);
                if (Array.isArray(parsed)) {
                    attachments = parsed.filter((u): u is string => typeof u === 'string' && !!u);
                }
            } catch {
                // ignore malformed JSON
            }
        }

        // Load the parent RFQ — required, both for projectId and for
        // lineage seeding (every bid has an RFQ parent by spec).
        const parent = await db.collection<CrmRfq>('crm_rfqs').findOne({
            _id: new ObjectId(rfqIdRaw),
            userId: userObjectId,
        });
        if (!parent) {
            return { error: 'Parent RFQ not found.' };
        }

        const lineage: LineageRef[] = buildLineageFromParent({
            kind: 'rfq',
            id: parent._id.toString(),
            no: parent.title,
            status: parent.status,
            lineage: parent.lineage ?? [],
        });

        const terms = (formData.get('terms') as string | null) || undefined;
        const submittedAt = new Date();

        const bidDoc: Omit<CrmVendorBid, '_id'> = {
            userId: userObjectId,
            projectId: parent.projectId,
            rfqId: parent._id,
            vendorId: new ObjectId(vendorIdRaw),
            items,
            currency,
            subTotal,
            total,
            ...(terms ? { terms } : {}),
            ...(attachments && attachments.length ? { attachments } : {}),
            status: 'submitted',
            submittedAt,
            createdAt: submittedAt,
            updatedAt: submittedAt,
            lineage,
        };

        const insertResult = await db.collection('crm_vendor_bids').insertOne(bidDoc as any);

        // Push back-link onto the parent RFQ. Best-effort — a failure
        // here must not roll back the bid insert.
        try {
            const vendorName = (formData.get('vendorName') as string | null) || undefined;
            const backLinkNo = vendorName || insertResult.insertedId.toString();
            const updatedParentLineage = appendLineage(parent.lineage, {
                kind: 'vendorBid',
                id: insertResult.insertedId.toString(),
                no: backLinkNo,
                status: 'submitted',
                createdAt: submittedAt.toISOString(),
            });
            await db.collection('crm_rfqs').updateOne(
                { _id: parent._id },
                { $set: { lineage: updatedParentLineage, updatedAt: new Date() } },
            );
        } catch {
            // non-fatal
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'vendor_bid',
                entityId: insertResult.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/purchase/vendor-bids');
        revalidatePath('/dashboard/crm/purchase/rfqs');
        return { message: 'Vendor bid saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Patch a bid's status. When a bid is awarded, the parent RFQ is also
 * flipped to `'awarded'` (best-effort, sequential update — keep it
 * simple per spec).
 */
export async function updateVendorBidStatus(
    bidId: string,
    status: 'submitted' | 'shortlisted' | 'awarded' | 'rejected' | 'withdrawn',
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_vendor_bid', 'edit');
    if (!guard.ok) return { error: guard.error };

    if (!bidId) return { error: 'Invalid bid id.' };

    if (useRustCrm()) {
        try {
            await crmVendorBidsApi.update(bidId, { status });
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'status_change',
                    entityKind: 'vendor_bid',
                    entityId: bidId,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/purchase/vendor-bids');
            revalidatePath('/dashboard/crm/purchase/rfqs');
            return { message: 'Vendor bid status updated.' };
        } catch (e) {
            console.error('[updateVendorBidStatus] rust path failed; falling back:', e);
            // fall through
        }
    }

    if (!ObjectId.isValid(bidId)) return { error: 'Invalid bid id.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const bid = await db.collection<CrmVendorBid>('crm_vendor_bids').findOne({
            _id: new ObjectId(bidId),
            userId: userObjectId,
        });
        if (!bid) return { error: 'Vendor bid not found.' };

        const updateResult = await db.collection('crm_vendor_bids').updateOne(
            { _id: bid._id, userId: userObjectId },
            { $set: { status, updatedAt: new Date() } },
        );
        if (updateResult.matchedCount === 0) {
            return { error: 'Vendor bid not found.' };
        }

        // Cascade: when a bid is awarded, flip the parent RFQ to
        // 'awarded'. Sequential and best-effort — RFQ-level failure
        // shouldn't undo the bid status change.
        if (status === 'awarded') {
            try {
                await db.collection('crm_rfqs').updateOne(
                    { _id: bid.rfqId, userId: userObjectId },
                    { $set: { status: 'awarded', updatedAt: new Date() } },
                );
            } catch {
                // non-fatal
            }
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'status_change',
                entityKind: 'vendor_bid',
                entityId: bidId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/purchase/vendor-bids');
        revalidatePath('/dashboard/crm/purchase/rfqs');
        return { message: 'Vendor bid status updated.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/** Soft-delete a vendor bid by setting `archived: true`. */
export async function deleteVendorBid(
    bidId: string,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_vendor_bid', 'delete');
    if (!guard.ok) return { error: guard.error };

    if (!bidId) return { error: 'Invalid bid id.' };

    if (useRustCrm()) {
        try {
            await crmVendorBidsApi.delete(bidId);
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'vendor_bid',
                    entityId: bidId,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/purchase/vendor-bids');
            return { message: 'Vendor bid archived.' };
        } catch (e) {
            console.error('[deleteVendorBid] rust path failed; falling back:', e);
            // fall through
        }
    }

    if (!ObjectId.isValid(bidId)) return { error: 'Invalid bid id.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const result = await db.collection('crm_vendor_bids').updateOne(
            { _id: new ObjectId(bidId), userId: userObjectId },
            { $set: { archived: true, updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { error: 'Vendor bid not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'vendor_bid',
                entityId: bidId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/purchase/vendor-bids');
        return { message: 'Vendor bid archived.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
