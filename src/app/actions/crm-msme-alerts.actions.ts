'use server';

/**
 * Server actions for the MSME 45-day delayed-payment alerts surface
 * (`/dashboard/crm/tax/msme-alerts`). The heavy logic lives in
 * `src/lib/india-tax/msme-45-day.ts`; this file is the
 * Mongo-talking, session-aware, RBAC-guarded thin shim.
 *
 * RBAC: gated on the new `crm_msme` module key (must be added to the
 * tenant's role + plan ceiling — flagged in the deliverable summary).
 *
 * Email / SMS notifications are NOT wired here — that's a follow-up.
 * For now we just persist alerts (via the daily cron) and surface them
 * in the dashboard page.
 */
import { revalidatePath } from 'next/cache';
import { ObjectId, type Document, type Filter } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import {
    computeMsmeOverduebills,
    type MsmeDb,
    type MsmeOverdueResult,
    type RawBill,
    type RawVendor,
} from '@/lib/india-tax/msme-45-day';

const LIST_PATH = '/dashboard/crm/tax/msme-alerts';

/**
 * Build a tenant-scoped `MsmeDb` adapter over Mongo. Kept private to
 * this module — the cron handler builds its own equivalent.
 */
async function tenantMsmeDb(tenantUserId: string): Promise<MsmeDb> {
    const { db } = await connectToDatabase();
    return {
        async findMsmeVendors(uid: string): Promise<RawVendor[]> {
            if (!ObjectId.isValid(uid)) return [];
            return (await db
                .collection('crm_vendors')
                .find({ userId: new ObjectId(uid), isMsme: true } as Filter<Document>)
                .project({
                    _id: 1,
                    name: 1,
                    isMsme: 1,
                    udyamRegistrationNumber: 1,
                    msmeCategory: 1,
                    msmePaymentTermsDays: 1,
                })
                .toArray()) as unknown as RawVendor[];
        },
        async findOpenBillsForVendors(
            uid: string,
            vendorIds: string[],
        ): Promise<RawBill[]> {
            if (!ObjectId.isValid(uid) || vendorIds.length === 0) return [];
            const vendorOids = vendorIds
                .filter((v) => ObjectId.isValid(v))
                .map((v) => new ObjectId(v));
            const vendorIn = [...vendorIds, ...vendorOids];
            return (await db
                .collection('crm_bills')
                .find({
                    userId: new ObjectId(uid),
                    vendorId: { $in: vendorIn },
                    status: { $nin: ['paid', 'cancelled'] },
                } as Filter<Document>)
                .project({
                    _id: 1,
                    userId: 1,
                    vendorId: 1,
                    billNo: 1,
                    billDate: 1,
                    dueDate: 1,
                    status: 1,
                    paidAt: 1,
                    amountPaid: 1,
                    balance: 1,
                    totals: 1,
                })
                .limit(5000)
                .toArray()) as unknown as RawBill[];
            // The tenant + isMsme filters keep the working set tight; 5k
            // is a generous safety belt.
            void uid;
        },
    };
}

/* ─── Read ─────────────────────────────────────────────────────── */

type GetMsmeOverdueBillsResult =
    | { ok: true; data: MsmeOverdueResult }
    | { ok: false; error: string };

export async function getMsmeOverdueBills(): Promise<GetMsmeOverdueBillsResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_msme', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const tenantUserId = String(session.user._id);
        const db = await tenantMsmeDb(tenantUserId);
        const data = await computeMsmeOverduebills(tenantUserId, db, new Date());
        return { ok: true, data };
    } catch (e) {
        console.error('[getMsmeOverdueBills] failed:', e);
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'Internal error',
        };
    }
}

/* ─── Dismiss ──────────────────────────────────────────────────── */

interface DismissMsmeAlertInput {
    alertId: string;
    reason: string;
}

export async function dismissMsmeAlert(
    alertId: string,
    reason: string,
): Promise<{ success: boolean; error?: string }> {
    if (!alertId) return { success: false, error: 'Missing alert id.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_msme', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    const trimmedReason = (reason ?? '').trim();
    if (!trimmedReason) {
        return { success: false, error: 'A dismissal reason is required.' };
    }

    if (!ObjectId.isValid(alertId)) {
        return { success: false, error: 'Invalid alert id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const tenantUserId = String(session.user._id);
        const update = await db.collection('crm_msme_alerts').findOneAndUpdate(
            {
                _id: new ObjectId(alertId),
                userId: new ObjectId(tenantUserId),
            } as Filter<Document>,
            {
                $set: {
                    dismissed: true,
                    dismissedAt: new Date(),
                    dismissedReason: trimmedReason,
                    updatedAt: new Date(),
                },
            },
            { returnDocument: 'after' },
        );

        if (!update) {
            return { success: false, error: 'Alert not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId,
                actorId: tenantUserId,
                action: 'msme_alert_dismissed',
                entityKind: 'msme_alert',
                entityId: alertId,
                reason: trimmedReason,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath(LIST_PATH);
        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Internal error',
        };
    }
}

/* ─── Bulk mark paid ────────────────────────────────────────────── */

type BulkMsmePaidResult =
    | { ok: true; updated: number }
    | { ok: false; error: string };

/**
 * Stamps `crm_bills` rows as `status: 'paid'` for the given bill IDs.
 * All IDs must belong to the authenticated tenant — the query enforces
 * this via the `userId` filter.
 */
export async function bulkMarkMsmePaid(
    billIds: string[],
): Promise<BulkMsmePaidResult> {
    if (!billIds.length) return { ok: true, updated: 0 };

    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_msme', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    const validIds = billIds.filter((id) => ObjectId.isValid(id));
    if (!validIds.length) return { ok: false, error: 'No valid bill IDs provided.' };

    try {
        const { db } = await connectToDatabase();
        const tenantUserId = String(session.user._id);

        const result = await db.collection('crm_bills').updateMany(
            {
                _id: { $in: validIds.map((id) => new ObjectId(id)) },
                userId: new ObjectId(tenantUserId),
            } as Filter<Document>,
            {
                $set: {
                    status: 'paid',
                    paidAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );

        try {
            await writeAuditEntry({
                tenantUserId,
                action: 'update',
                entityKind: 'msme_bill_bulk_paid',
                entityId: tenantUserId,
                reason: `Bulk MSME mark-paid: ${result.modifiedCount} bills`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath(LIST_PATH);
        return { ok: true, updated: result.modifiedCount };
    } catch (e) {
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'Internal error',
        };
    }
}

/* ─── Bulk request extension ────────────────────────────────────── */

type BulkMsmeExtensionResult =
    | { ok: true; flagged: number }
    | { ok: false; error: string };

/**
 * Flags `crm_bills` rows with `extensionRequested: true` for tracking.
 * Actual negotiation (email, terms update) happens outside the system.
 */
export async function bulkRequestMsmeExtension(
    billIds: string[],
): Promise<BulkMsmeExtensionResult> {
    if (!billIds.length) return { ok: true, flagged: 0 };

    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_msme', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    const validIds = billIds.filter((id) => ObjectId.isValid(id));
    if (!validIds.length) return { ok: false, error: 'No valid bill IDs provided.' };

    try {
        const { db } = await connectToDatabase();
        const tenantUserId = String(session.user._id);

        const result = await db.collection('crm_bills').updateMany(
            {
                _id: { $in: validIds.map((id) => new ObjectId(id)) },
                userId: new ObjectId(tenantUserId),
            } as Filter<Document>,
            {
                $set: {
                    extensionRequested: true,
                    extensionRequestedAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );

        try {
            await writeAuditEntry({
                tenantUserId,
                action: 'update',
                entityKind: 'msme_bill_extension_requested',
                entityId: tenantUserId,
                reason: `Bulk MSME extension request: ${result.modifiedCount} bills`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath(LIST_PATH);
        return { ok: true, flagged: result.modifiedCount };
    } catch (e) {
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'Internal error',
        };
    }
}
