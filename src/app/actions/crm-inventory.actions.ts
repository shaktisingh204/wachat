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

interface CrmStockAdjustmentFilters {
    status?: CrmStockAdjustmentStatus | '';
    warehouseId?: string;
    reason?: string;
    approverId?: string;
    dateFrom?: string;
    dateTo?: string;
}

interface CrmStockAdjustmentKpis {
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

/* ─── Deep-view KPI + chart aggregators (§1D inventory deep-views) ───── */

/**
 * KPI tile data for the All-Transactions deep view. Aggregates the
 * current-month txn count by type, plus the top item by absolute volume
 * and gross value across all line items.
 */
interface AllTransactionsDeepKpis {
    txnThisMonth: number;
    saleCount: number;
    returnCount: number;
    adjustmentCount: number;
    topItem: { name: string; quantity: number } | null;
    totalValue: number;
    /** Month label + count tuples, oldest first, last 6 months. */
    monthlySeries: Array<{ month: string; count: number; value: number }>;
}

export async function getAllTransactionsDeepKpis(): Promise<AllTransactionsDeepKpis> {
    const empty: AllTransactionsDeepKpis = {
        txnThisMonth: 0,
        saleCount: 0,
        returnCount: 0,
        adjustmentCount: 0,
        topItem: null,
        totalValue: 0,
        monthlySeries: [],
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const [invoices, creditNotes, adjustments] = await Promise.all([
            db.collection('crm_invoices').find({ userId, invoiceDate: { $gte: sixMonthsAgo } }).toArray(),
            db.collection('crm_credit_notes').find({ userId, creditNoteDate: { $gte: sixMonthsAgo } }).toArray(),
            db.collection('crm_stock_adjustments').find({ userId, date: { $gte: sixMonthsAgo } }).toArray(),
        ]);

        let saleCount = 0;
        let returnCount = 0;
        let adjustmentCount = 0;
        let totalValue = 0;
        let txnThisMonth = 0;

        const itemVolume = new Map<string, number>();
        const monthBuckets = new Map<string, { count: number; value: number }>();

        const bumpMonth = (date: Date, value: number): void => {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const bucket = monthBuckets.get(key) ?? { count: 0, value: 0 };
            bucket.count += 1;
            bucket.value += value;
            monthBuckets.set(key, bucket);
        };

        for (const inv of invoices as Array<{ invoiceDate?: Date; lineItems?: Array<{ name?: string; quantity?: number; rate?: number }> }>) {
            const date = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date();
            let value = 0;
            for (const item of inv.lineItems ?? []) {
                const qty = Number(item.quantity ?? 0);
                const rate = Number(item.rate ?? 0);
                value += qty * rate;
                const name = item.name ?? 'Unknown';
                itemVolume.set(name, (itemVolume.get(name) ?? 0) + qty);
            }
            totalValue += value;
            bumpMonth(date, value);
            saleCount += 1;
            if (date >= monthStart) txnThisMonth += 1;
        }

        for (const note of creditNotes as Array<{ creditNoteDate?: Date; lineItems?: Array<{ name?: string; quantity?: number; rate?: number }> }>) {
            const date = note.creditNoteDate ? new Date(note.creditNoteDate) : new Date();
            let value = 0;
            for (const item of note.lineItems ?? []) {
                const qty = Number(item.quantity ?? 0);
                const rate = Number(item.rate ?? 0);
                value += qty * rate;
                const name = item.name ?? 'Unknown';
                itemVolume.set(name, (itemVolume.get(name) ?? 0) + qty);
            }
            totalValue += value;
            bumpMonth(date, value);
            returnCount += 1;
            if (date >= monthStart) txnThisMonth += 1;
        }

        for (const adj of adjustments as Array<{ date?: Date; quantity?: number; costPerUnit?: number }>) {
            const date = adj.date ? new Date(adj.date) : new Date();
            const value = Math.abs(Number(adj.quantity ?? 0) * Number(adj.costPerUnit ?? 0));
            totalValue += value;
            bumpMonth(date, value);
            adjustmentCount += 1;
            if (date >= monthStart) txnThisMonth += 1;
        }

        let topItem: AllTransactionsDeepKpis['topItem'] = null;
        for (const [name, qty] of itemVolume.entries()) {
            if (!topItem || qty > topItem.quantity) topItem = { name, quantity: qty };
        }

        // Build a continuous 6-month series so the chart never has gaps.
        const monthlySeries: AllTransactionsDeepKpis['monthlySeries'] = [];
        const cursor = new Date(sixMonthsAgo);
        for (let i = 0; i < 6; i++) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            const bucket = monthBuckets.get(key) ?? { count: 0, value: 0 };
            monthlySeries.push({
                month: cursor.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
                count: bucket.count,
                value: bucket.value,
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }

        return {
            txnThisMonth,
            saleCount,
            returnCount,
            adjustmentCount,
            topItem,
            totalValue,
            monthlySeries,
        };
    } catch (e) {
        console.error('[getAllTransactionsDeepKpis] failed:', e);
        return empty;
    }
}

/**
 * KPI tile + top-N data for the Party Transactions deep view.
 * Sums dr/cr per party across invoices and credit notes.
 */
interface PartyTransactionsDeepKpis {
    totalParties: number;
    topParty: { name: string; volume: number } | null;
    totalDebit: number;
    totalCredit: number;
    outstandingBalance: number;
    topN: Array<{ name: string; volume: number; debit: number; credit: number }>;
}

export async function getPartyTransactionsDeepKpis(): Promise<PartyTransactionsDeepKpis> {
    const empty: PartyTransactionsDeepKpis = {
        totalParties: 0,
        topParty: null,
        totalDebit: 0,
        totalCredit: 0,
        outstandingBalance: 0,
        topN: [],
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const [accounts, invoices, creditNotes] = await Promise.all([
            db.collection('crm_accounts').find({ userId }).project({ name: 1 }).toArray(),
            db.collection('crm_invoices').find({ userId }).toArray(),
            db.collection('crm_credit_notes').find({ userId }).toArray(),
        ]);

        const accountMap = new Map(accounts.map((a) => [String(a._id), String((a as { name?: string }).name ?? 'Unknown')]));
        const perParty = new Map<string, { debit: number; credit: number; outstanding: number }>();

        for (const inv of invoices as Array<{ accountId?: ObjectId; totalAmount?: number; amountPaid?: number }>) {
            if (!inv.accountId) continue;
            const key = String(inv.accountId);
            const bucket = perParty.get(key) ?? { debit: 0, credit: 0, outstanding: 0 };
            const total = Number(inv.totalAmount ?? 0);
            const paid = Number(inv.amountPaid ?? 0);
            bucket.debit += total;
            bucket.outstanding += Math.max(total - paid, 0);
            perParty.set(key, bucket);
        }

        for (const note of creditNotes as Array<{ accountId?: ObjectId; totalAmount?: number }>) {
            if (!note.accountId) continue;
            const key = String(note.accountId);
            const bucket = perParty.get(key) ?? { debit: 0, credit: 0, outstanding: 0 };
            bucket.credit += Number(note.totalAmount ?? 0);
            perParty.set(key, bucket);
        }

        let totalDebit = 0;
        let totalCredit = 0;
        let outstandingBalance = 0;
        const ranked: PartyTransactionsDeepKpis['topN'] = [];
        for (const [key, value] of perParty.entries()) {
            totalDebit += value.debit;
            totalCredit += value.credit;
            outstandingBalance += value.outstanding;
            ranked.push({
                name: accountMap.get(key) ?? 'Unknown',
                volume: value.debit + value.credit,
                debit: value.debit,
                credit: value.credit,
            });
        }
        ranked.sort((a, b) => b.volume - a.volume);
        const topN = ranked.slice(0, 10);
        const topParty = topN[0] ? { name: topN[0].name, volume: topN[0].volume } : null;

        return {
            totalParties: perParty.size,
            topParty,
            totalDebit,
            totalCredit,
            outstandingBalance,
            topN,
        };
    } catch (e) {
        console.error('[getPartyTransactionsDeepKpis] failed:', e);
        return empty;
    }
}

/**
 * KPI tile + warehouse breakdown for the Stock-Value deep view.
 * Marks items as "slow" when they have stock but no sales in the last
 * 90 days, "fast" when they sold ≥ 10 units in that window.
 */
interface StockValueDeepKpis {
    totalStockValue: number;
    slowMovingValue: number;
    fastMovingValue: number;
    byWarehouse: Array<{ warehouseId: string; warehouseName: string; value: number; units: number }>;
}

export async function getStockValueDeepKpis(): Promise<StockValueDeepKpis> {
    const empty: StockValueDeepKpis = {
        totalStockValue: 0,
        slowMovingValue: 0,
        fastMovingValue: 0,
        byWarehouse: [],
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const ninetyDays = new Date();
        ninetyDays.setDate(ninetyDays.getDate() - 90);

        const [products, warehouses, recentInvoices] = await Promise.all([
            db.collection('crm_products').find({ userId, manageStock: true }).toArray(),
            db.collection('crm_warehouses').find({ userId }).project({ name: 1 }).toArray(),
            db.collection('crm_invoices').find({ userId, invoiceDate: { $gte: ninetyDays } }).toArray(),
        ]);

        const warehouseMap = new Map(warehouses.map((w) => [String(w._id), String((w as { name?: string }).name ?? 'Unknown')]));
        const recentVolume = new Map<string, number>();
        for (const inv of recentInvoices as Array<{ lineItems?: Array<{ name?: string; quantity?: number }> }>) {
            for (const item of inv.lineItems ?? []) {
                const name = item.name ?? '';
                if (!name) continue;
                recentVolume.set(name, (recentVolume.get(name) ?? 0) + Number(item.quantity ?? 0));
            }
        }

        const perWarehouse = new Map<string, { value: number; units: number; name: string }>();
        let totalStockValue = 0;
        let slowMovingValue = 0;
        let fastMovingValue = 0;

        type ProductRow = {
            name?: string;
            price?: number;
            buyingPrice?: number;
            stock?: number;
            inventory?: Array<{ warehouseId?: ObjectId; stock?: number }>;
        };

        for (const product of products as ProductRow[]) {
            const valuationPrice = Number(product.buyingPrice ?? product.price ?? 0);
            const sold90 = recentVolume.get(product.name ?? '') ?? 0;
            const isFast = sold90 >= 10;
            const isSlow = sold90 === 0;

            const inv = product.inventory ?? [];
            if (inv.length > 0) {
                for (const slot of inv) {
                    const stock = Number(slot.stock ?? 0);
                    if (stock <= 0) continue;
                    const value = stock * valuationPrice;
                    totalStockValue += value;
                    if (isFast) fastMovingValue += value;
                    if (isSlow) slowMovingValue += value;
                    const whId = slot.warehouseId ? String(slot.warehouseId) : 'default';
                    const whName = warehouseMap.get(whId) ?? 'Default';
                    const bucket = perWarehouse.get(whId) ?? { value: 0, units: 0, name: whName };
                    bucket.value += value;
                    bucket.units += stock;
                    perWarehouse.set(whId, bucket);
                }
            } else if ((product.stock ?? 0) > 0) {
                const stock = Number(product.stock);
                const value = stock * valuationPrice;
                totalStockValue += value;
                if (isFast) fastMovingValue += value;
                if (isSlow) slowMovingValue += value;
                const bucket = perWarehouse.get('default') ?? { value: 0, units: 0, name: 'Default' };
                bucket.value += value;
                bucket.units += stock;
                perWarehouse.set('default', bucket);
            }
        }

        const byWarehouse: StockValueDeepKpis['byWarehouse'] = [...perWarehouse.entries()]
            .map(([warehouseId, b]) => ({ warehouseId, warehouseName: b.name, value: b.value, units: b.units }))
            .sort((a, b) => b.value - a.value);

        return { totalStockValue, slowMovingValue, fastMovingValue, byWarehouse };
    } catch (e) {
        console.error('[getStockValueDeepKpis] failed:', e);
        return empty;
    }
}

/**
 * KPI tile + monthly P&L data for the Product P&L deep view.
 */
interface PnlDeepKpis {
    grossSales: number;
    totalCogs: number;
    grossMarginPct: number;
    topProfitable: { name: string; profit: number } | null;
    monthlyPnl: Array<{ month: string; revenue: number; cogs: number; profit: number }>;
}

export async function getPnlDeepKpis(): Promise<PnlDeepKpis> {
    const empty: PnlDeepKpis = {
        grossSales: 0,
        totalCogs: 0,
        grossMarginPct: 0,
        topProfitable: null,
        monthlyPnl: [],
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const [products, invoices] = await Promise.all([
            db.collection('crm_products').find({ userId }).toArray(),
            db.collection('crm_invoices').find({ userId, invoiceDate: { $gte: sixMonthsAgo } }).toArray(),
        ]);

        const costByName = new Map<string, number>();
        for (const p of products as Array<{ name?: string; buyingPrice?: number; price?: number }>) {
            const name = p.name ?? '';
            if (!name) continue;
            costByName.set(name, Number(p.buyingPrice ?? p.price ?? 0));
        }

        const monthBuckets = new Map<string, { revenue: number; cogs: number }>();
        const profitByItem = new Map<string, number>();
        let grossSales = 0;
        let totalCogs = 0;

        for (const inv of invoices as Array<{ invoiceDate?: Date; lineItems?: Array<{ name?: string; quantity?: number; rate?: number }> }>) {
            const date = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date();
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const bucket = monthBuckets.get(key) ?? { revenue: 0, cogs: 0 };
            for (const item of inv.lineItems ?? []) {
                const qty = Number(item.quantity ?? 0);
                const rate = Number(item.rate ?? 0);
                const name = item.name ?? '';
                const unitCost = costByName.get(name) ?? 0;
                const revenue = qty * rate;
                const cogs = qty * unitCost;
                bucket.revenue += revenue;
                bucket.cogs += cogs;
                grossSales += revenue;
                totalCogs += cogs;
                profitByItem.set(name, (profitByItem.get(name) ?? 0) + (revenue - cogs));
            }
            monthBuckets.set(key, bucket);
        }

        const cursor = new Date(sixMonthsAgo);
        const monthlyPnl: PnlDeepKpis['monthlyPnl'] = [];
        for (let i = 0; i < 6; i++) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            const bucket = monthBuckets.get(key) ?? { revenue: 0, cogs: 0 };
            monthlyPnl.push({
                month: cursor.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
                revenue: bucket.revenue,
                cogs: bucket.cogs,
                profit: bucket.revenue - bucket.cogs,
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }

        let topProfitable: PnlDeepKpis['topProfitable'] = null;
        for (const [name, profit] of profitByItem.entries()) {
            if (!topProfitable || profit > topProfitable.profit) topProfitable = { name, profit };
        }

        const grossMarginPct = grossSales > 0 ? ((grossSales - totalCogs) / grossSales) * 100 : 0;

        return { grossSales, totalCogs, grossMarginPct, topProfitable, monthlyPnl };
    } catch (e) {
        console.error('[getPnlDeepKpis] failed:', e);
        return empty;
    }
}
