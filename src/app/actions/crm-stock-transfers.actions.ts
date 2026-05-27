'use server';

/**
 * Stock-transfer server actions — §1B inventory rebuild.
 *
 * A stock transfer moves inventory from one warehouse to another. Records
 * `transferNumber` (auto), `fromWarehouseId`, `toWarehouseId`,
 * `transferDate`, `lineItems[]`, `status`, `notes`, `attachments[]`.
 *
 * Direct Mongo: no Rust crate exists for this entity today. All
 * mutations are gated by `requirePermission('crm_stock_transfer', …)`
 * and append an `crm_audit_log` row via `writeAuditEntry`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, type Filter } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';

/* ─── Types ────────────────────────────────────────────────────────── */

type CrmStockTransferStatus =
    | 'Draft'
    | 'Requested'
    | 'Approved'
    | 'InTransit'
    | 'Received'
    | 'Cancelled'
    | 'archived';

type CrmStockTransferReason =
    | 'rebalance'
    | 'restock'
    | 'return'
    | 'damaged'
    | 'project'
    | 'other';

interface CrmStockTransferLineItem {
    itemId: ObjectId;
    itemName?: string;
    quantity: number;
    unit?: string;
}

interface CrmStockTransferAttachment {
    id: string;
    url: string;
    name: string;
    mime?: string;
    size?: number;
}

interface CrmStockTransfer {
    _id: ObjectId;
    userId: ObjectId;
    transferNumber: string;
    fromWarehouseId: ObjectId;
    fromWarehouseName?: string;
    toWarehouseId: ObjectId;
    toWarehouseName?: string;
    transferDate: Date;
    lineItems: CrmStockTransferLineItem[];
    status: CrmStockTransferStatus;
    notes?: string;
    attachments?: CrmStockTransferAttachment[];
    archived?: boolean;
    requesterId?: ObjectId | string;
    requesterName?: string;
    approverId?: ObjectId | string;
    approverName?: string;
    receivedById?: ObjectId | string;
    receivedByName?: string;
    expectedDate?: Date;
    receivedDate?: Date;
    reason?: CrmStockTransferReason | string;
    carrier?: string;
    trackingNumber?: string;
    createdAt: Date;
    updatedAt: Date;
}

interface CrmStockTransferFilters {
    status?: CrmStockTransferStatus | '';
    fromWarehouseId?: string;
    toWarehouseId?: string;
    dateFrom?: string;
    dateTo?: string;
    includeArchived?: boolean;
}

interface CrmStockTransferKpis {
    total: number;
    inTransit: number;
    received: number;
    draft: number;
}

const EMPTY_KPIS: CrmStockTransferKpis = {
    total: 0,
    inTransit: 0,
    received: 0,
    draft: 0,
};

const COLLECTION = 'crm_stock_transfers';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function parseLineItemsFromFormData(
    formData: FormData,
): CrmStockTransferLineItem[] {
    const grouped = new Map<number, Record<string, string>>();
    formData.forEach((value, key) => {
        const m = key.match(/^lineItems\[(\d+)\]\[(\w+)\]$/);
        if (!m) return;
        const idx = Number(m[1]);
        const field = m[2];
        if (!grouped.has(idx)) grouped.set(idx, {});
        grouped.get(idx)![field] = String(value);
    });

    const items: CrmStockTransferLineItem[] = [];
    for (const [, row] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
        if (!row.itemId || !ObjectId.isValid(row.itemId)) continue;
        const qty = row.quantity ? Number(row.quantity) : 0;
        if (!Number.isFinite(qty) || qty <= 0) continue;
        items.push({
            itemId: new ObjectId(row.itemId),
            itemName: row.itemName || undefined,
            quantity: qty,
            unit: row.unit || undefined,
        });
    }
    return items;
}

function parseAttachmentsFromFormData(
    formData: FormData,
): CrmStockTransferAttachment[] {
    const grouped = new Map<number, Record<string, string>>();
    formData.forEach((value, key) => {
        const m = key.match(/^attachments\[(\d+)\]\[(\w+)\]$/);
        if (!m) return;
        const idx = Number(m[1]);
        const field = m[2];
        if (!grouped.has(idx)) grouped.set(idx, {});
        grouped.get(idx)![field] = String(value);
    });

    const attachments: CrmStockTransferAttachment[] = [];
    for (const [, row] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
        if (!row.url || !row.id) continue;
        attachments.push({
            id: row.id,
            url: row.url,
            name: row.name || row.id,
            mime: row.mime || undefined,
            size: row.size ? Number(row.size) : undefined,
        });
    }
    return attachments;
}

async function nextTransferNumber(
    db: import('mongodb').Db,
    userId: ObjectId,
): Promise<string> {
    try {
        const count = await db.collection(COLLECTION).countDocuments({ userId }, { maxTimeMS: 5000 });
        return `ST-${String(count + 1).padStart(4, '0')}`;
    } catch {
        return `ST-${Date.now().toString(36).toUpperCase()}`;
    }
}

/* ─── Reads ────────────────────────────────────────────────────────── */

export async function getStockTransferById(
    id: string,
): Promise<WithId<CrmStockTransfer> | null> {
    if (!id || !ObjectId.isValid(id)) return null;
    const session = await getSession();
    if (!session?.user) return null;

    const guard = await requirePermission('crm_stock_transfer', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection<CrmStockTransfer>(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        }, { maxTimeMS: 5000 });
        return doc ? JSON.parse(JSON.stringify(doc)) : null;
    } catch (e) {
        console.error('Failed to fetch CRM stock transfer:', e);
        recordRustFallback({ entity: 'stock_transfer', op: 'get' });
        return null;
    }
}

export async function getStockTransfers(
    page = 1,
    limit = 20,
    search = '',
    filters: CrmStockTransferFilters = {},
): Promise<{
    transfers: WithId<CrmStockTransfer>[];
    total: number;
    kpis: CrmStockTransferKpis;
}> {
    const session = await getSession();
    if (!session?.user) {
        return { transfers: [], total: 0, kpis: EMPTY_KPIS };
    }

    const guard = await requirePermission('crm_stock_transfer', 'view');
    if (!guard.ok) {
        return { transfers: [], total: 0, kpis: EMPTY_KPIS };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const query: Filter<CrmStockTransfer> = { userId };

        if (!filters.includeArchived) {
            query.status = { $ne: 'archived' };
            query.archived = { $ne: true };
        }
        if (filters.status) {
            // Override the ne:archived clause when explicitly filtering by it.
            query.status = filters.status;
        }
        if (
            filters.fromWarehouseId &&
            ObjectId.isValid(filters.fromWarehouseId)
        ) {
            query.fromWarehouseId = new ObjectId(filters.fromWarehouseId);
        }
        if (filters.toWarehouseId && ObjectId.isValid(filters.toWarehouseId)) {
            query.toWarehouseId = new ObjectId(filters.toWarehouseId);
        }
        if (filters.dateFrom || filters.dateTo) {
            const range: Record<string, Date> = {};
            if (filters.dateFrom) range.$gte = new Date(filters.dateFrom);
            if (filters.dateTo) range.$lte = new Date(filters.dateTo);
            query.transferDate = range;
        }
        if (search.trim()) {
            const rx = new RegExp(
                search.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'),
                'i',
            );
            query.$or = [
                { transferNumber: rx },
                { notes: rx },
            ];
        }

        const cursor = db.collection<CrmStockTransfer>(COLLECTION).find(query);
        const total = await cursor.clone().count();
        const transfers = await cursor
            .sort({ transferDate: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();

        // KPIs are scoped to non-archived rows regardless of current filter.
        const kpiBase = {
            userId,
            status: { $ne: 'archived' as const },
            archived: { $ne: true },
        };
        const [totalK, inTransit, received, draft] = await Promise.all([
            db.collection(COLLECTION).countDocuments(kpiBase),
            db.collection(COLLECTION).countDocuments({
                ...kpiBase,
                status: 'InTransit',
            }),
            db.collection(COLLECTION).countDocuments({
                ...kpiBase,
                status: 'Received',
            }),
            db.collection(COLLECTION).countDocuments({
                ...kpiBase,
                status: 'Draft',
            }),
        ]);

        return {
            transfers: JSON.parse(JSON.stringify(transfers)),
            total,
            kpis: {
                total: totalK,
                inTransit,
                received,
                draft,
            },
        };
    } catch (e) {
        console.error('Failed to fetch CRM stock transfers:', e);
        recordRustFallback({ entity: 'stock_transfer', op: 'list' });
        return { transfers: [], total: 0, kpis: EMPTY_KPIS };
    }
}

/* ─── Writes ───────────────────────────────────────────────────────── */

export async function saveStockTransfer(
    _prevState: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string; transferId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const transferId = (formData.get('transferId') as string | null) || null;
    const isEditing = !!transferId;

    const guard = await requirePermission(
        'crm_stock_transfer',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    try {
        const userId = new ObjectId(session.user._id);
        const { db } = await connectToDatabase();

        const fromWarehouseRaw = formData.get('fromWarehouseId') as string;
        const toWarehouseRaw = formData.get('toWarehouseId') as string;
        if (!fromWarehouseRaw || !ObjectId.isValid(fromWarehouseRaw)) {
            return { error: 'Source warehouse is required.' };
        }
        if (!toWarehouseRaw || !ObjectId.isValid(toWarehouseRaw)) {
            return { error: 'Destination warehouse is required.' };
        }
        if (fromWarehouseRaw === toWarehouseRaw) {
            return {
                error: 'Source and destination warehouse must differ.',
            };
        }

        const dateRaw = formData.get('transferDate') as string | null;
        const transferDate = dateRaw ? new Date(dateRaw) : new Date();

        const lineItems = parseLineItemsFromFormData(formData);
        if (lineItems.length === 0) {
            return { error: 'At least one line item with quantity is required.' };
        }

        const attachments = parseAttachmentsFromFormData(formData);
        const statusRaw =
            (formData.get('status') as CrmStockTransferStatus | null) ||
            'Draft';
        const allowedStatus: CrmStockTransferStatus[] = [
            'Draft',
            'Requested',
            'Approved',
            'InTransit',
            'Received',
            'Cancelled',
        ];
        const status: CrmStockTransferStatus = allowedStatus.includes(statusRaw)
            ? statusRaw
            : 'Draft';
        const notes = (formData.get('notes') as string | null) || undefined;

        const fromName =
            (formData.get('fromWarehouseName') as string | null) || undefined;
        const toName =
            (formData.get('toWarehouseName') as string | null) || undefined;

        const asOptionalObjectId = (raw: FormDataEntryValue | null) => {
            if (raw == null) return undefined;
            const s = String(raw).trim();
            return s && ObjectId.isValid(s) ? new ObjectId(s) : undefined;
        };
        const asOptionalString = (raw: FormDataEntryValue | null) => {
            if (raw == null) return undefined;
            const s = String(raw).trim();
            return s.length > 0 ? s : undefined;
        };
        const asOptionalDate = (raw: FormDataEntryValue | null) => {
            const s = asOptionalString(raw);
            if (!s) return undefined;
            const d = new Date(s);
            return Number.isNaN(d.getTime()) ? undefined : d;
        };

        const baseDoc: Partial<CrmStockTransfer> = {
            userId,
            fromWarehouseId: new ObjectId(fromWarehouseRaw),
            fromWarehouseName: fromName,
            toWarehouseId: new ObjectId(toWarehouseRaw),
            toWarehouseName: toName,
            transferDate,
            lineItems,
            status,
            notes,
            attachments,
            requesterId: asOptionalObjectId(formData.get('requesterId')),
            requesterName: asOptionalString(formData.get('requesterName')),
            approverId: asOptionalObjectId(formData.get('approverId')),
            approverName: asOptionalString(formData.get('approverName')),
            receivedById: asOptionalObjectId(formData.get('receivedById')),
            receivedByName: asOptionalString(formData.get('receivedByName')),
            expectedDate: asOptionalDate(formData.get('expectedDate')),
            receivedDate: asOptionalDate(formData.get('receivedDate')),
            reason: asOptionalString(formData.get('reason')),
            carrier: asOptionalString(formData.get('carrier')),
            trackingNumber: asOptionalString(formData.get('trackingNumber')),
            updatedAt: new Date(),
        };

        if (isEditing && transferId && ObjectId.isValid(transferId)) {
            const existing = await db.collection(COLLECTION).findOne({
                _id: new ObjectId(transferId),
                userId,
            });
            if (!existing) return { error: 'Stock transfer not found.' };

            await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(transferId), userId },
                { $set: baseDoc },
            );

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'stock_transfer',
                entityId: transferId,
                reason: `Updated stock transfer "${existing.transferNumber ?? transferId.slice(-6)}"`,
            });

            revalidatePath('/dashboard/crm/inventory/stock-transfers');
            revalidatePath(
                `/dashboard/crm/inventory/stock-transfers/${transferId}`,
            );
            return {
                message: 'Stock transfer saved.',
                transferId,
            };
        }

        const transferNumber = await nextTransferNumber(db, userId);
        const createDoc: Partial<CrmStockTransfer> = {
            ...baseDoc,
            transferNumber,
            createdAt: new Date(),
        };
        const res = await db
            .collection(COLLECTION)
            .insertOne(createDoc as CrmStockTransfer);

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'stock_transfer',
            entityId: String(res.insertedId),
            reason: `Created stock transfer "${transferNumber}"`,
        });

        revalidatePath('/dashboard/crm/inventory/stock-transfers');
        return {
            message: `Stock transfer ${transferNumber} created.`,
            transferId: String(res.insertedId),
        };
    } catch (e) {
        recordRustFallback({
            entity: 'stock_transfer',
            op: isEditing ? 'update' : 'create',
        });
        return { error: getErrorMessage(e) };
    }
}

export async function deleteStockTransfer(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid transfer ID.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_stock_transfer', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const doc = await db.collection(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId,
        });
        if (!doc) return { success: false, error: 'Stock transfer not found.' };

        await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId,
        });

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'stock_transfer',
            entityId: id,
            reason: `Deleted stock transfer "${doc.transferNumber ?? id.slice(-6)}"`,
        });

        revalidatePath('/dashboard/crm/inventory/stock-transfers');
        return { success: true };
    } catch (e) {
        recordRustFallback({ entity: 'stock_transfer', op: 'delete' });
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function archiveStockTransfer(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid transfer ID.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_stock_transfer', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const res = await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(id), userId },
            {
                $set: {
                    status: 'archived',
                    archived: true,
                    updatedAt: new Date(),
                },
            },
        );
        if (res.matchedCount === 0) {
            return { success: false, error: 'Stock transfer not found.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'archive',
            entityKind: 'stock_transfer',
            entityId: id,
        });

        revalidatePath('/dashboard/crm/inventory/stock-transfers');
        revalidatePath(`/dashboard/crm/inventory/stock-transfers/${id}`);
        return { success: true };
    } catch (e) {
        recordRustFallback({ entity: 'stock_transfer', op: 'update' });
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function cancelStockTransfer(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid transfer ID.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_stock_transfer', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const res = await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(id), userId },
            {
                $set: {
                    status: 'Cancelled',
                    updatedAt: new Date(),
                },
            },
        );
        if (res.matchedCount === 0) {
            return { success: false, error: 'Stock transfer not found.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'status_change',
            entityKind: 'stock_transfer',
            entityId: id,
            reason: 'Cancelled',
        });

        revalidatePath('/dashboard/crm/inventory/stock-transfers');
        revalidatePath(`/dashboard/crm/inventory/stock-transfers/${id}`);
        return { success: true };
    } catch (e) {
        recordRustFallback({ entity: 'stock_transfer', op: 'update' });
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Bulk ─────────────────────────────────────────────────────────── */

/**
 * Bulk action on stock transfers owned by the current user.
 *
 * Operations:
 *   - `approve`  → sets status to `Approved`
 *   - `cancel`   → sets status to `Cancelled`
 *   - `delete`   → hard-deletes documents
 */
export async function bulkStockTransferAction(
    ids: string[],
    op: 'approve' | 'cancel' | 'delete',
): Promise<{ success: boolean; processed: number; error?: string }> {
    if (!ids.length) {
        return { success: false, processed: 0, error: 'No IDs provided.' };
    }
    const session = await getSession();
    if (!session?.user) {
        return { success: false, processed: 0, error: 'Access denied.' };
    }

    const permission = op === 'delete' ? 'delete' : 'edit';
    const guard = await requirePermission('crm_stock_transfer', permission);
    if (!guard.ok) {
        return { success: false, processed: 0, error: guard.error };
    }

    const validIds = ids.filter((id) => ObjectId.isValid(id));
    if (validIds.length === 0) {
        return { success: false, processed: 0, error: 'No valid IDs.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const objectIds = validIds.map((id) => new ObjectId(id));
        const filter = { _id: { $in: objectIds }, userId };

        let processed = 0;

        if (op === 'delete') {
            const res = await db.collection(COLLECTION).deleteMany(filter);
            processed = res.deletedCount ?? 0;
        } else {
            const status =
                op === 'approve' ? 'Approved' : 'Cancelled';
            const res = await db.collection(COLLECTION).updateMany(filter, {
                $set: { status, updatedAt: new Date() },
            });
            processed = res.modifiedCount ?? 0;
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: op === 'delete' ? 'delete' : 'status_change',
                entityKind: 'stock_transfer',
                entityId: validIds.join(','),
                reason: `bulk_${op} on ${processed} transfers`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/inventory/stock-transfers');
        return { success: true, processed };
    } catch (e) {
        recordRustFallback({ entity: 'stock_transfer', op: 'update' });
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}
