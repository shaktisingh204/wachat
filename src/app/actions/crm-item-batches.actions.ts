'use server';

/**
 * CRM Item Batches — server actions for `crm_item_batches`.
 *
 * Batch & expiry tracking entity (NO Rust crate, direct Mongo). Each
 * document represents a single physical batch / lot for a tracked item
 * with manufacture / expiry dates, quantity, and optional supplier +
 * location references.
 *
 * Schema (Mongo):
 *   { _id, userId, itemId, itemName, batchNumber, manufactureDate,
 *     expiryDate, quantity, unit, locationId, supplierId, costPrice,
 *     notes, status: 'active'|'expired'|'recalled'|'archived',
 *     createdAt, updatedAt }
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, type Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';

const COLLECTION = 'crm_item_batches';
const BASE_PATH = '/dashboard/crm/inventory/batch-expiry';

type CrmItemBatchStatus = 'active' | 'expired' | 'recalled' | 'archived';

const VALID_STATUSES: ReadonlySet<CrmItemBatchStatus> = new Set([
    'active',
    'expired',
    'recalled',
    'archived',
]);

interface CrmItemBatchDoc {
    _id: string;
    userId: string;
    itemId?: string;
    itemName: string;
    batchNumber: string;
    manufactureDate?: string;
    expiryDate?: string;
    quantity: number;
    unit?: string;
    locationId?: string;
    supplierId?: string;
    costPrice?: number;
    notes?: string;
    status: CrmItemBatchStatus;
    createdAt?: string;
    updatedAt?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (s == null) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asDate(v: FormDataEntryValue | null): Date | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function serialize<T>(doc: T): T {
    return JSON.parse(JSON.stringify(doc)) as T;
}

/* ─── Reads ────────────────────────────────────────────────────────── */

function mapToDto(doc: WithId<Document>): CrmItemBatchDoc {
    return {
        _id: doc._id.toString(),
        userId: doc.userId.toString(),
        itemId: doc.itemId?.toString(),
        itemName: String(doc.itemName),
        batchNumber: String(doc.batchNumber),
        manufactureDate: (doc.manufactureDate instanceof Date) ? doc.manufactureDate.toISOString() : undefined,
        expiryDate: (doc.expiryDate instanceof Date) ? doc.expiryDate.toISOString() : undefined,
        quantity: Number(doc.quantity),
        unit: doc.unit ? String(doc.unit) : undefined,
        locationId: doc.locationId?.toString(),
        supplierId: doc.supplierId?.toString(),
        costPrice: typeof doc.costPrice === 'number' ? doc.costPrice : undefined,
        notes: doc.notes ? String(doc.notes) : undefined,
        status: doc.status as CrmItemBatchStatus,
        createdAt: (doc.createdAt instanceof Date) ? doc.createdAt.toISOString() : undefined,
        updatedAt: (doc.updatedAt instanceof Date) ? doc.updatedAt.toISOString() : undefined,
    };
}

/**
 * Fetch all batches for the active user, sorted by `expiryDate ASC` so
 * expired / soon-to-expire batches surface first.
 */
export async function getCrmItemBatches(): Promise<CrmItemBatchDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_product', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection(COLLECTION)
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ expiryDate: 1, batchNumber: 1 })
            .maxTimeMS(5000)
            .toArray();
        return docs.map(mapToDto);
    } catch (e) {
        console.error('[getCrmItemBatches] failed:', e);
        if (e instanceof Error && e.message.includes('timed out')) {
             throw new Error('Database request timed out. Please try again later.');
        }
        throw new Error('Failed to fetch inventory batches.');
    }
}

export async function getCrmItemBatchById(
    batchId: string,
): Promise<CrmItemBatchDoc | null> {
    if (!batchId || !ObjectId.isValid(batchId)) return null;

    const session = await getSession();
    if (!session?.user) return null;

    const guard = await requirePermission('crm_product', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(COLLECTION).findOne(
            {
                _id: new ObjectId(batchId),
                userId: new ObjectId(session.user._id),
            },
            { maxTimeMS: 5000 }
        );
        return doc ? mapToDto(doc) : null;
    } catch (e) {
        console.error('[getCrmItemBatchById] failed:', e);
        if (e instanceof Error && e.message.includes('timed out')) {
             throw new Error('Database request timed out. Please try again later.');
        }
        throw new Error('Failed to fetch inventory batch.');
    }
}

/* ─── Writes ───────────────────────────────────────────────────────── */

interface SaveState {
    message?: string;
    error?: string;
    id?: string;
}

/**
 * Create / update an item batch. Hidden `batchId` field decides POST vs
 * PATCH (mirrors the policies pattern).
 */
export async function saveCrmItemBatch(
    _prev: SaveState | undefined,
    formData: FormData,
): Promise<SaveState> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const batchId = asString(formData.get('batchId'));
    const isEditing = !!batchId;

    const guard = await requirePermission(
        'crm_product',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const itemName = asString(formData.get('itemName'));
    if (!itemName) return { error: 'Item name is required.' };

    const batchNumber = asString(formData.get('batchNumber'));
    if (!batchNumber) return { error: 'Batch number is required.' };

    const quantity = asNumber(formData.get('quantity')) ?? 0;
    if (!Number.isFinite(quantity)) return { error: 'Quantity is required.' };

    const statusRaw = asString(formData.get('status')) ?? 'active';
    const status: CrmItemBatchStatus = VALID_STATUSES.has(
        statusRaw as CrmItemBatchStatus,
    )
        ? (statusRaw as CrmItemBatchStatus)
        : 'active';

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const doc: Record<string, unknown> = {
            userId,
            itemName,
            batchNumber,
            quantity,
            status,
            updatedAt: new Date(),
        };

        const itemId = asString(formData.get('itemId'));
        if (itemId && ObjectId.isValid(itemId)) doc.itemId = new ObjectId(itemId);

        const supplierId = asString(formData.get('supplierId'));
        if (supplierId && ObjectId.isValid(supplierId))
            doc.supplierId = new ObjectId(supplierId);

        const locationId = asString(formData.get('locationId'));
        if (locationId && ObjectId.isValid(locationId))
            doc.locationId = new ObjectId(locationId);

        const manufactureDate = asDate(formData.get('manufactureDate'));
        if (manufactureDate) doc.manufactureDate = manufactureDate;

        const expiryDate = asDate(formData.get('expiryDate'));
        if (expiryDate) doc.expiryDate = expiryDate;

        const unit = asString(formData.get('unit'));
        if (unit) doc.unit = unit;

        const costPrice = asNumber(formData.get('costPrice'));
        if (costPrice != null) doc.costPrice = costPrice;

        const notes = asString(formData.get('notes'));
        if (notes) doc.notes = notes;

        let resultId: string;
        if (isEditing && ObjectId.isValid(batchId!)) {
            await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(batchId!), userId },
                { $set: doc },
            );
            resultId = batchId!;
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'item_batch',
                entityId: resultId,
                reason: `Updated batch ${batchNumber}`,
            });
        } else {
            doc.createdAt = new Date();
            const res = await db.collection(COLLECTION).insertOne(doc);
            resultId = res.insertedId.toString();
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'item_batch',
                entityId: resultId,
                reason: `Created batch ${batchNumber} for ${itemName}`,
            });
        }

        revalidatePath(BASE_PATH);
        revalidatePath(`${BASE_PATH}/${resultId}`);
        return {
            message: isEditing ? 'Batch updated.' : 'Batch created.',
            id: resultId,
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmItemBatch(
    batchId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!batchId || !ObjectId.isValid(batchId))
        return { success: false, error: 'Invalid batch id.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_product', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const r = await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(batchId),
            userId: new ObjectId(session.user._id),
        });
        if (r.deletedCount === 0)
            return { success: false, error: 'Batch not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'item_batch',
            entityId: batchId,
        });

        revalidatePath(BASE_PATH);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// NOTE: `WithId` is not re-exported — Server Action files may only
// export async functions. Consumers should import the type directly
// from `mongodb` instead.
