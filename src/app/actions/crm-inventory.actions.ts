'use server';

/**
 * Stock-adjustment server actions — §1D rebuild.
 *
 * Reads + status/approval mutators + bulk operations. The `save…`
 * action lives in `./crm-inventory-writes.actions.ts` to keep both
 * files under the 600-line cap; it's re-exported from this module so
 * callers keep their existing import paths working.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type {
    CrmStockAdjustment,
    CrmStockAdjustmentStatus,
} from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { saveCrmStockAdjustment as saveCrmStockAdjustmentImpl } from './crm-inventory-writes.actions';

// `'use server'` modules may only export async functions, so we wrap the
// re-export rather than using `export { saveCrmStockAdjustment } from ...`.
export async function saveCrmStockAdjustment(
    prevState: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string; adjustmentId?: string }> {
    return saveCrmStockAdjustmentImpl(prevState, formData);
}

/* ─── Types ────────────────────────────────────────────────────────── */

export interface CrmStockAdjustmentFilters {
    status?: CrmStockAdjustmentStatus | '';
    warehouseId?: string;
    reason?: string;
    approverId?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface CrmStockAdjustmentKpis {
    pending: number;
    approved: number;
    rejected: number;
    totalImpactValue: number;
}

const EMPTY_KPIS: CrmStockAdjustmentKpis = {
    pending: 0,
    approved: 0,
    rejected: 0,
    totalImpactValue: 0,
};

const LOOKUP_PIPELINE = [
    {
        $lookup: {
            from: 'crm_products',
            localField: 'productId',
            foreignField: '_id',
            as: 'productInfo',
        },
    },
    {
        $lookup: {
            from: 'crm_warehouses',
            localField: 'warehouseId',
            foreignField: '_id',
            as: 'warehouseInfo',
        },
    },
    { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$warehouseInfo', preserveNullAndEmptyArrays: true } },
    {
        $addFields: {
            productName: '$productInfo.name',
            warehouseName: '$warehouseInfo.name',
        },
    },
    { $project: { productInfo: 0, warehouseInfo: 0 } },
];

/* ─── Reads ────────────────────────────────────────────────────────── */

export async function getCrmStockAdjustmentById(
    adjustmentId: string,
): Promise<WithId<CrmStockAdjustment> | null> {
    if (!adjustmentId || !ObjectId.isValid(adjustmentId)) return null;
    const session = await getSession();
    if (!session?.user) return null;
    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection('crm_stock_adjustments')
            .aggregate([
                {
                    $match: {
                        _id: new ObjectId(adjustmentId),
                        userId: new ObjectId(session.user._id),
                    },
                },
                ...LOOKUP_PIPELINE,
            ])
            .toArray();
        if (docs.length === 0) return null;
        return JSON.parse(JSON.stringify(docs[0]));
    } catch (e) {
        console.error('Failed to fetch CRM stock adjustment:', e);
        recordRustFallback({ entity: 'stock_adjustment', op: 'get' });
        return null;
    }
}

export async function getCrmStockAdjustments(): Promise<
    WithId<CrmStockAdjustment>[]
> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const rows = await db
            .collection('crm_stock_adjustments')
            .aggregate([
                { $match: { userId: new ObjectId(session.user._id) } },
                { $sort: { date: -1 } },
                ...LOOKUP_PIPELINE,
            ])
            .toArray();
        return JSON.parse(JSON.stringify(rows));
    } catch (e) {
        console.error('Failed to fetch CRM stock adjustments:', e);
        recordRustFallback({ entity: 'stock_adjustment', op: 'list' });
        return [];
    }
}

export async function getCrmStockAdjustmentsPaginated(
    page = 1,
    limit = 20,
    search = '',
    filters: CrmStockAdjustmentFilters = {},
): Promise<{ adjustments: WithId<CrmStockAdjustment>[]; total: number }> {
    const session = await getSession();
    if (!session?.user) return { adjustments: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const match: Record<string, unknown> = {
            userId: new ObjectId(session.user._id),
        };

        if (filters.status) match.status = filters.status;
        if (filters.warehouseId && ObjectId.isValid(filters.warehouseId)) {
            match.warehouseId = new ObjectId(filters.warehouseId);
        }
        if (filters.reason) match.reason = filters.reason;
        if (filters.approverId && ObjectId.isValid(filters.approverId)) {
            match.approvedBy = new ObjectId(filters.approverId);
        }
        if (filters.dateFrom || filters.dateTo) {
            const range: Record<string, Date> = {};
            if (filters.dateFrom) range.$gte = new Date(filters.dateFrom);
            if (filters.dateTo) range.$lte = new Date(filters.dateTo);
            match.date = range;
        }
        if (search.trim()) {
            const rx = new RegExp(
                search.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'),
                'i',
            );
            (match as any).$or = [
                { adjustmentNumber: rx },
                { referenceNumber: rx },
                { notes: rx },
            ];
        }

        const [total, rows] = await Promise.all([
            db.collection('crm_stock_adjustments').countDocuments(match),
            db
                .collection('crm_stock_adjustments')
                .aggregate([
                    { $match: match },
                    { $sort: { date: -1 } },
                    ...LOOKUP_PIPELINE,
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                ])
                .toArray(),
        ]);

        return { adjustments: JSON.parse(JSON.stringify(rows)), total };
    } catch (e) {
        console.error('Failed to fetch paginated CRM stock adjustments:', e);
        recordRustFallback({ entity: 'stock_adjustment', op: 'list' });
        return { adjustments: [], total: 0 };
    }
}

export async function getCrmStockAdjustmentKpis(): Promise<CrmStockAdjustmentKpis> {
    const session = await getSession();
    if (!session?.user) return EMPTY_KPIS;

    try {
        const { db } = await connectToDatabase();
        const base = { userId: new ObjectId(session.user._id) };

        const [counts, impactRes] = await Promise.all([
            db
                .collection('crm_stock_adjustments')
                .aggregate([
                    { $match: base },
                    {
                        $group: {
                            _id: { $ifNull: ['$status', 'pending'] },
                            count: { $sum: 1 },
                        },
                    },
                ])
                .toArray(),
            db
                .collection('crm_stock_adjustments')
                .aggregate([
                    { $match: base },
                    {
                        $group: {
                            _id: null,
                            impact: {
                                $sum: {
                                    $abs: {
                                        $multiply: [
                                            { $ifNull: ['$quantity', 0] },
                                            { $ifNull: ['$costPerUnit', 0] },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                ])
                .toArray(),
        ]);

        const byStatus: Record<string, number> = {};
        for (const c of counts) byStatus[String(c._id)] = c.count;

        return {
            pending: byStatus['pending'] || 0,
            approved: byStatus['approved'] || 0,
            rejected: byStatus['rejected'] || 0,
            totalImpactValue: impactRes[0]?.impact || 0,
        };
    } catch (e) {
        console.error('Failed to compute stock-adjustment KPIs:', e);
        recordRustFallback({ entity: 'stock_adjustment', op: 'other' });
        return EMPTY_KPIS;
    }
}

/* ─── Writes (excluding `saveCrmStockAdjustment`, see writes file) ── */

export async function updateCrmStockAdjustment(
    _prevState: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string; adjustmentId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const adjustmentId = formData.get('adjustmentId') as string;
    if (!adjustmentId || !ObjectId.isValid(adjustmentId)) {
        return { error: 'Invalid adjustment ID.' };
    }

    try {
        const reason = formData.get('reason') as CrmStockAdjustment['reason'];
        const notes = (formData.get('notes') as string | null) || undefined;
        const referenceNumber =
            (formData.get('referenceNumber') as string | null) || undefined;
        if (!reason) return { error: 'Reason is required.' };

        const { db } = await connectToDatabase();
        const result = await db.collection('crm_stock_adjustments').updateOne(
            {
                _id: new ObjectId(adjustmentId),
                userId: new ObjectId(session.user._id),
            },
            {
                $set: {
                    reason,
                    notes,
                    referenceNumber,
                    updatedAt: new Date(),
                },
            },
        );

        if (result.matchedCount === 0)
            return { error: 'Adjustment not found or access denied.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'stock_adjustment',
            entityId: adjustmentId,
        });

        revalidatePath('/dashboard/crm/inventory/adjustments');
        revalidatePath(`/dashboard/crm/inventory/adjustments/${adjustmentId}`);
        return { message: 'Adjustment updated.', adjustmentId };
    } catch (e) {
        recordRustFallback({ entity: 'stock_adjustment', op: 'update' });
        return { error: getErrorMessage(e) };
    }
}

async function setApprovalStatus(
    adjustmentId: string,
    target: 'approved' | 'rejected',
    approvalNotes?: string,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(adjustmentId))
        return { success: false, error: 'Invalid adjustment id.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const r = await db.collection('crm_stock_adjustments').updateOne(
            {
                _id: new ObjectId(adjustmentId),
                userId: new ObjectId(session.user._id),
            },
            {
                $set: {
                    status: target,
                    approvedBy: new ObjectId(session.user._id),
                    approvedByName: session.user.name || undefined,
                    approvedAt: new Date(),
                    approvalNotes: approvalNotes || undefined,
                    updatedAt: new Date(),
                },
            },
        );
        if (r.matchedCount === 0)
            return { success: false, error: 'Adjustment not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'status_change',
            entityKind: 'stock_adjustment',
            entityId: adjustmentId,
            reason: target === 'approved' ? 'Approved' : 'Rejected',
        });

        revalidatePath('/dashboard/crm/inventory/adjustments');
        revalidatePath(`/dashboard/crm/inventory/adjustments/${adjustmentId}`);
        return { success: true };
    } catch (e) {
        recordRustFallback({ entity: 'stock_adjustment', op: 'update' });
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function approveCrmStockAdjustment(
    adjustmentId: string,
    approvalNotes?: string,
): Promise<{ success: boolean; error?: string }> {
    return setApprovalStatus(adjustmentId, 'approved', approvalNotes);
}

export async function rejectCrmStockAdjustment(
    adjustmentId: string,
    approvalNotes?: string,
): Promise<{ success: boolean; error?: string }> {
    return setApprovalStatus(adjustmentId, 'rejected', approvalNotes);
}

export async function deleteCrmStockAdjustment(
    adjustmentId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(adjustmentId))
        return { success: false, error: 'Invalid adjustment id.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const r = await db.collection('crm_stock_adjustments').deleteOne({
            _id: new ObjectId(adjustmentId),
            userId: new ObjectId(session.user._id),
        });
        if (r.deletedCount === 0)
            return { success: false, error: 'Adjustment not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'stock_adjustment',
            entityId: adjustmentId,
        });

        revalidatePath('/dashboard/crm/inventory/adjustments');
        return { success: true };
    } catch (e) {
        recordRustFallback({ entity: 'stock_adjustment', op: 'delete' });
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function bulkStockAdjustmentAction(
    ids: string[],
    op: 'approve' | 'reject' | 'delete',
): Promise<{ success: boolean; processed: number; error?: string }> {
    if (!Array.isArray(ids) || ids.length === 0)
        return {
            success: false,
            processed: 0,
            error: 'No adjustments selected.',
        };

    const session = await getSession();
    if (!session?.user)
        return { success: false, processed: 0, error: 'Access denied.' };

    let processed = 0;
    for (const id of ids) {
        if (!ObjectId.isValid(id)) continue;
        let res: { success: boolean; error?: string };
        if (op === 'approve') res = await approveCrmStockAdjustment(id);
        else if (op === 'reject') res = await rejectCrmStockAdjustment(id);
        else res = await deleteCrmStockAdjustment(id);
        if (res.success) processed += 1;
    }

    return { success: processed > 0, processed };
}
