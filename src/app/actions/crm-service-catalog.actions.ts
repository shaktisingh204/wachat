'use server';

/**
 * CRM Service Catalog — settings-style server actions.
 *
 * No Rust crate; this entity is a tenant-scoped Mongo collection
 * (`crm_services`) used to catalog non-tangible service offerings —
 * distinct from physical `crm_products`.
 *
 * NOTE: The unfortunately-named `crm-services.actions.ts` sibling
 * file owns Projects/Contracts/Tickets server actions (legacy), so
 * the service catalog lives here under a different path to avoid
 * symbol collisions.
 *
 * Fields: name, code (unique per tenant), description, category,
 * default_price, currency, tax_rate, billable_by (hour|fixed|project),
 * duration_minutes, is_active, status, image_url.
 *
 * Soft-delete via `status = 'archived'`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { requireSession, serialize } from '@/lib/hr-crud';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';

export type CrmServiceStatus = 'active' | 'archived';
export type CrmServiceBillableBy = 'hour' | 'fixed' | 'project';

export interface CrmServiceDoc {
    _id?: string;
    userId?: string;
    name: string;
    code?: string;
    description?: string;
    category?: string;
    defaultPrice?: number;
    currency?: string;
    taxRate?: number;
    billableBy?: CrmServiceBillableBy;
    durationMinutes?: number;
    isActive?: boolean;
    status?: CrmServiceStatus;
    imageUrl?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

const COLLECTION = 'crm_services';
const REVALIDATE = '/dashboard/crm/services';

const VALID_BILLABLE_BY: ReadonlySet<CrmServiceBillableBy> = new Set([
    'hour',
    'fixed',
    'project',
]);

/* ─── Helpers ────────────────────────────────────────────────────────── */

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

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getCrmServices(): Promise<CrmServiceDoc[]> {
    const user = await requireSession();
    if (!user) return [];

    const guard = await requirePermission('crm_service', 'view');
    if (!guard.ok) return [];

    const { db } = await connectToDatabase();
    const docs = await db
        .collection(COLLECTION)
        .find({ userId: new ObjectId(user._id) })
        .sort({ name: 1 })
        .toArray();
    return serialize(docs) as WithId<CrmServiceDoc>[];
}

export async function getCrmServiceById(
    id: string,
): Promise<CrmServiceDoc | null> {
    const user = await requireSession();
    if (!user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_service', 'view');
    if (!guard.ok) return null;

    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(user._id),
    });
    return doc ? (serialize(doc) as CrmServiceDoc) : null;
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveCrmService(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const user = await requireSession();
    if (!user) return { error: 'Access denied.' };

    const serviceId = asString(formData.get('serviceId'));
    const isEditing = !!serviceId;

    const guard = await requirePermission(
        'crm_service',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Service name is required.' };

    const code = asString(formData.get('code'));

    const billableByRaw = asString(formData.get('billableBy'));
    const billableBy: CrmServiceBillableBy =
        billableByRaw && VALID_BILLABLE_BY.has(billableByRaw as CrmServiceBillableBy)
            ? (billableByRaw as CrmServiceBillableBy)
            : 'hour';

    const statusRaw = asString(formData.get('status'));
    const status: CrmServiceStatus =
        statusRaw === 'archived' ? 'archived' : 'active';

    try {
        const { db } = await connectToDatabase();

        // Per-tenant unique code guard (case-insensitive). Code is optional;
        // only enforce when present.
        if (code) {
            const dupFilter: Record<string, unknown> = {
                userId: new ObjectId(user._id),
                code: { $regex: `^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
            };
            if (isEditing && serviceId && ObjectId.isValid(serviceId)) {
                dupFilter._id = { $ne: new ObjectId(serviceId) };
            }
            const existing = await db.collection(COLLECTION).findOne(dupFilter);
            if (existing) {
                return { error: 'A service with this code already exists.' };
            }
        }

        const now = new Date();
        const data: Record<string, unknown> = {
            name,
            code: code ?? null,
            description: asString(formData.get('description')) ?? null,
            category: asString(formData.get('category')) ?? null,
            defaultPrice: asNumber(formData.get('defaultPrice')) ?? 0,
            currency: asString(formData.get('currency')) ?? 'INR',
            taxRate: asNumber(formData.get('taxRate')) ?? 0,
            billableBy,
            durationMinutes: asNumber(formData.get('durationMinutes')) ?? null,
            imageUrl: asString(formData.get('imageUrl')) ?? null,
            isActive: asBool(formData.get('isActive')),
            status,
            userId: new ObjectId(user._id),
            updatedAt: now,
        };

        if (isEditing && serviceId && ObjectId.isValid(serviceId)) {
            await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(serviceId), userId: new ObjectId(user._id) },
                { $set: data },
            );
            void writeAuditEntry({
                tenantUserId: user._id,
                actorId: user._id,
                action: 'update',
                entityKind: 'service',
                entityId: serviceId,
            });
            revalidatePath(REVALIDATE);
            return { message: 'Service updated.', id: serviceId };
        }

        data.createdAt = now;
        const res = await db.collection(COLLECTION).insertOne(data);
        void writeAuditEntry({
            tenantUserId: user._id,
            actorId: user._id,
            action: 'create',
            entityKind: 'service',
            entityId: res.insertedId.toString(),
        });
        revalidatePath(REVALIDATE);
        return { message: 'Service created.', id: res.insertedId.toString() };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveCrmService] failed:', msg);
        return { error: `Failed to save service: ${msg}` };
    }
}

/* ─── KPI + bulk actions ────────────────────────────────────────────── */

export interface CrmServiceKpis {
    total: number;
    active: number;
    archived: number;
    /** Sum of `defaultPrice` across active services (proxy for "total billed"). */
    totalBilled: number;
    /** Service with highest `defaultPrice` among active rows. */
    topRevenueService: { name: string; defaultPrice: number } | null;
}

export async function getCrmServiceKpis(): Promise<CrmServiceKpis> {
    const empty: CrmServiceKpis = {
        total: 0,
        active: 0,
        archived: 0,
        totalBilled: 0,
        topRevenueService: null,
    };

    const user = await requireSession();
    if (!user) return empty;

    const guard = await requirePermission('crm_service', 'view');
    if (!guard.ok) return empty;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(user._id);
        const base = { userId: userObjectId } as Record<string, unknown>;
        const activeFilter = { ...base, status: { $ne: 'archived' } };

        const [total, active, archived, sumAgg, topDoc] = await Promise.all([
            db.collection(COLLECTION).countDocuments(base),
            db.collection(COLLECTION).countDocuments(activeFilter),
            db.collection(COLLECTION).countDocuments({ ...base, status: 'archived' }),
            db
                .collection(COLLECTION)
                .aggregate([
                    { $match: activeFilter },
                    {
                        $group: {
                            _id: null,
                            sum: { $sum: { $ifNull: ['$defaultPrice', 0] } },
                        },
                    },
                ])
                .toArray()
                .catch(() => [] as Array<{ sum?: number }>),
            db
                .collection(COLLECTION)
                .find(activeFilter)
                .sort({ defaultPrice: -1 })
                .limit(1)
                .toArray()
                .catch(() => [] as Array<{ name?: string; defaultPrice?: number }>),
        ]);

        const totalBilled = Number((sumAgg[0] as { sum?: number } | undefined)?.sum ?? 0) || 0;
        const top = topDoc[0] as { name?: string; defaultPrice?: number } | undefined;
        const topRevenueService =
            top && typeof top.name === 'string'
                ? { name: top.name, defaultPrice: Number(top.defaultPrice ?? 0) || 0 }
                : null;

        return { total, active, archived, totalBilled, topRevenueService };
    } catch (e) {
        console.error('[getCrmServiceKpis] failed:', e);
        return empty;
    }
}

export type BulkServiceOp = 'archive' | 'unarchive' | 'delete';

export async function bulkServiceAction(
    ids: string[],
    op: BulkServiceOp,
): Promise<{ success: boolean; processed: number; error?: string }> {
    const user = await requireSession();
    if (!user) return { success: false, processed: 0, error: 'Access denied.' };

    const guard = await requirePermission(
        'crm_service',
        op === 'delete' ? 'delete' : 'edit',
    );
    if (!guard.ok) return { success: false, processed: 0, error: guard.error };

    const validIds = (ids ?? []).filter((id) => ObjectId.isValid(id));
    if (validIds.length === 0) {
        return { success: false, processed: 0, error: 'No valid service ids.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(user._id);
        const filter = {
            _id: { $in: validIds.map((id) => new ObjectId(id)) },
            userId: userObjectId,
        };

        if (op === 'delete') {
            const r = await db.collection(COLLECTION).deleteMany(filter);
            revalidatePath(REVALIDATE);
            return { success: true, processed: r.deletedCount ?? 0 };
        }

        const isArchive = op === 'archive';
        const r = await db.collection(COLLECTION).updateMany(filter, {
            $set: {
                status: isArchive ? 'archived' : 'active',
                isActive: !isArchive,
                updatedAt: new Date(),
            },
        });
        revalidatePath(REVALIDATE);
        return { success: true, processed: r.modifiedCount ?? 0 };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, processed: 0, error: msg };
    }
}

/**
 * Soft-delete: flips status to 'archived' rather than removing the row.
 */
export async function deleteCrmService(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const user = await requireSession();
    if (!user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid service id.' };

    const guard = await requirePermission('crm_service', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(user._id) },
            { $set: { status: 'archived', isActive: false, updatedAt: new Date() } },
        );
        void writeAuditEntry({
            tenantUserId: user._id,
            actorId: user._id,
            action: 'archive',
            entityKind: 'service',
            entityId: id,
        });
        revalidatePath(REVALIDATE);
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteCrmService] failed:', msg);
        return { success: false, error: `Failed to archive service: ${msg}` };
    }
}
