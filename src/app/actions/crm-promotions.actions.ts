'use server';

/**
 * CRM Promotions — server actions.
 *
 * Backed by the Mongo `crm_promotions` collection (no Rust crate). Field
 * shape mirrors the spec in `crm_function_plan.md`:
 *   - name, code, description
 *   - type: flat | percent | buy_x_get_y | free_shipping
 *   - value, min_cart, max_uses, used_count
 *   - valid_from, valid_to
 *   - applicable_products[], applicable_categories[], customer_segments[]
 *   - status: draft | scheduled | active | paused | expired | archived
 *
 * Multi-tenant isolation via `userId`. RBAC key: `crm_promotion`.
 */

import { ObjectId, type Filter, type Document } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';

const COLLECTION = 'crm_promotions';
const BASE_PATH = '/dashboard/crm/sales/promotions';

type CrmPromotionStatus =
    | 'draft'
    | 'scheduled'
    | 'active'
    | 'paused'
    | 'expired'
    | 'archived';

type CrmPromotionType =
    | 'flat'
    | 'percent'
    | 'buy_x_get_y'
    | 'free_shipping';

interface CrmPromotionDoc {
    _id: string;
    userId?: string;
    name: string;
    code?: string;
    description?: string;
    type: CrmPromotionType;
    value?: number;
    minCart?: number;
    maxUses?: number;
    usedCount?: number;
    validFrom?: string;
    validTo?: string;
    applicableProducts?: string[];
    applicableCategories?: string[];
    customerSegments?: string[];
    status: CrmPromotionStatus;
    createdAt?: string;
    updatedAt?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asInt(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
}

function asArray(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const parts = s
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
}

function asDate(v: FormDataEntryValue | null): Date | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

const VALID_TYPES: ReadonlySet<CrmPromotionType> = new Set<CrmPromotionType>([
    'flat',
    'percent',
    'buy_x_get_y',
    'free_shipping',
]);

const VALID_STATUSES: ReadonlySet<CrmPromotionStatus> =
    new Set<CrmPromotionStatus>([
        'draft',
        'scheduled',
        'active',
        'paused',
        'expired',
        'archived',
    ]);

function serialize<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

interface PromotionListParams {
    q?: string;
    status?: CrmPromotionStatus | 'all';
    type?: CrmPromotionType | 'all';
    limit?: number;
}

export async function getPromotions(
    filters?: PromotionListParams,
): Promise<{ items: CrmPromotionDoc[]; error?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { items: [], error: 'Unauthorized.' };

    const guard = await requirePermission('crm_promotion', 'view');
    if (!guard.ok) return { items: [], error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = {
            userId: new ObjectId(session.user._id as string),
        };
        if (filters?.status && filters.status !== 'all') filter.status = filters.status;
        if (filters?.type && filters.type !== 'all') filter.type = filters.type;
        if (filters?.q) {
            const re = new RegExp(
                filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            filter.$or = [{ name: re }, { code: re }, { description: re }];
        }

        const docs = await db
            .collection(COLLECTION)
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(filters?.limit ?? 100)
            .toArray();

        return { items: serialize(docs) as unknown as CrmPromotionDoc[] };
    } catch (e) {
        console.error('[getPromotions] error:', e);
        return { items: [], error: 'Failed to load promotions.' };
    }
}

export async function getPromotionById(
    id: string,
): Promise<CrmPromotionDoc | null> {
    if (!id || !ObjectId.isValid(id)) return null;

    const session = await getSession();
    if (!session?.user?._id) return null;

    const guard = await requirePermission('crm_promotion', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        return doc ? (serialize(doc) as unknown as CrmPromotionDoc) : null;
    } catch (e) {
        console.error('[getPromotionById] error:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: Partial<CrmPromotionDoc> & { name: string; type: CrmPromotionType };
    error?: string;
} {
    const name = asString(formData.get('name'));
    if (!name)
        return {
            payload: { name: '', type: 'flat' } as any,
            error: 'Promotion name is required.',
        };

    const rawType = asString(formData.get('type')) ?? 'flat';
    const type = (VALID_TYPES.has(rawType as CrmPromotionType)
        ? rawType
        : 'flat') as CrmPromotionType;

    const rawStatus = asString(formData.get('status'));
    const status =
        rawStatus && VALID_STATUSES.has(rawStatus as CrmPromotionStatus)
            ? (rawStatus as CrmPromotionStatus)
            : undefined;

    return {
        payload: {
            name,
            code: asString(formData.get('code'))?.toUpperCase(),
            description: asString(formData.get('description')),
            type,
            value: asNumber(formData.get('value')),
            minCart: asNumber(formData.get('minCart')),
            maxUses: asInt(formData.get('maxUses')),
            validFrom: asDate(formData.get('validFrom'))?.toISOString(),
            validTo: asDate(formData.get('validTo'))?.toISOString(),
            applicableProducts: asArray(formData.get('applicableProducts')),
            applicableCategories: asArray(formData.get('applicableCategories')),
            customerSegments: asArray(formData.get('customerSegments')),
            ...(status ? { status } : {}),
        },
    };
}

export async function savePromotion(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { error: 'Access denied.' };

    const promotionId = asString(formData.get('promotionId'));
    const isEditing = !!promotionId && ObjectId.isValid(promotionId);

    const guard = await requirePermission(
        'crm_promotion',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        // Convert ISO strings back to Date for storage
        const data: Record<string, unknown> = {
            ...payload,
            updatedAt: now,
        };
        if (payload.validFrom) data.validFrom = new Date(payload.validFrom);
        if (payload.validTo) data.validTo = new Date(payload.validTo);

        if (isEditing) {
            const result = await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(promotionId!), userId: userObjectId },
                { $set: data },
            );
            if (result.matchedCount === 0) {
                return { error: 'Promotion not found.' };
            }
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'promotion',
                    entityId: promotionId!,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath(BASE_PATH);
            revalidatePath(`${BASE_PATH}/${promotionId}`);
            return { message: 'Promotion updated.', id: promotionId };
        }

        data.userId = userObjectId;
        data.createdAt = now;
        data.usedCount = 0;
        if (!data.status) data.status = 'draft';

        const { insertedId } = await db.collection(COLLECTION).insertOne(data);
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'promotion',
                entityId: insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath(BASE_PATH);
        return { message: 'Promotion created.', id: insertedId.toString() };
    } catch (e) {
        console.error('[savePromotion] error:', e);
        return {
            error: e instanceof Error ? e.message : 'Failed to save promotion.',
        };
    }
}

export async function setPromotionStatus(
    id: string,
    status: CrmPromotionStatus,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id))
        return { success: false, error: 'Invalid promotion id.' };
    if (!VALID_STATUSES.has(status))
        return { success: false, error: 'Invalid status.' };

    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_promotion', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status, updatedAt: new Date() } },
        );
        if (result.matchedCount === 0)
            return { success: false, error: 'Promotion not found.' };
        revalidatePath(BASE_PATH);
        revalidatePath(`${BASE_PATH}/${id}`);
        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Failed.',
        };
    }
}

/* ─── KPIs ───────────────────────────────────────────────────────────── */

interface PromotionKpis {
    totalActive: number;
    expiringThisWeek: number;
    totalRedemptions: number;
    avgDiscountPct: number;
}

const EMPTY_PROMO_KPIS: PromotionKpis = {
    totalActive: 0,
    expiringThisWeek: 0,
    totalRedemptions: 0,
    avgDiscountPct: 0,
};

/**
 * KPI snapshot for the promotions list page. Tenant-scoped on
 * `userId`. Computed in a single query window — for tenants with > 200
 * promotions a dedicated aggregate would be more accurate.
 */
export async function getPromotionKpis(): Promise<PromotionKpis> {
    const session = await getSession();
    if (!session?.user?._id) return EMPTY_PROMO_KPIS;
    const guard = await requirePermission('crm_promotion', 'view');
    if (!guard.ok) return EMPTY_PROMO_KPIS;
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();
        const inOneWeek = new Date(now.getTime() + 7 * 86_400_000);

        const [totalActive, expiringThisWeek, allDocs] = await Promise.all([
            db.collection(COLLECTION).countDocuments({
                userId: userObjectId,
                status: 'active',
            }),
            db.collection(COLLECTION).countDocuments({
                userId: userObjectId,
                status: 'active',
                validTo: { $gte: now, $lte: inOneWeek },
            }),
            db
                .collection(COLLECTION)
                .find({ userId: userObjectId })
                .project({ usedCount: 1, type: 1, value: 1 })
                .limit(500)
                .toArray(),
        ]);

        let totalRedemptions = 0;
        let pctSum = 0;
        let pctSamples = 0;
        for (const d of allDocs) {
            const used = Number((d as { usedCount?: number }).usedCount ?? 0);
            if (Number.isFinite(used)) totalRedemptions += used;
            const type = (d as { type?: string }).type;
            const value = Number((d as { value?: number }).value ?? 0);
            if (type === 'percent' && Number.isFinite(value) && value > 0) {
                pctSum += value;
                pctSamples += 1;
            }
        }
        return {
            totalActive,
            expiringThisWeek,
            totalRedemptions,
            avgDiscountPct:
                pctSamples > 0 ? Math.round((pctSum / pctSamples) * 10) / 10 : 0,
        };
    } catch (e) {
        console.error('[getPromotionKpis] error:', e);
        return EMPTY_PROMO_KPIS;
    }
}

/* ─── Bulk mutators ──────────────────────────────────────────────────── */

export async function bulkDeletePromotions(
    ids: string[],
): Promise<{ processed: number; error?: string }> {
    if (!Array.isArray(ids) || ids.length === 0)
        return { processed: 0, error: 'No promotions selected.' };
    const session = await getSession();
    if (!session?.user?._id) return { processed: 0, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_promotion', 'delete');
    if (!guard.ok) return { processed: 0, error: guard.error };
    try {
        const { db } = await connectToDatabase();
        const valid = ids.filter((id) => ObjectId.isValid(id));
        const res = await db.collection(COLLECTION).deleteMany({
            _id: { $in: valid.map((id) => new ObjectId(id)) },
            userId: new ObjectId(session.user._id as string),
        });
        revalidatePath(BASE_PATH);
        return { processed: res.deletedCount ?? 0 };
    } catch (e) {
        return {
            processed: 0,
            error: e instanceof Error ? e.message : 'Failed.',
        };
    }
}

export async function bulkSetPromotionStatus(
    ids: string[],
    status: CrmPromotionStatus,
): Promise<{ processed: number; error?: string }> {
    if (!Array.isArray(ids) || ids.length === 0)
        return { processed: 0, error: 'No promotions selected.' };
    if (!VALID_STATUSES.has(status))
        return { processed: 0, error: 'Invalid status.' };
    const session = await getSession();
    if (!session?.user?._id) return { processed: 0, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_promotion', 'edit');
    if (!guard.ok) return { processed: 0, error: guard.error };
    try {
        const { db } = await connectToDatabase();
        const valid = ids.filter((id) => ObjectId.isValid(id));
        const res = await db.collection(COLLECTION).updateMany(
            {
                _id: { $in: valid.map((id) => new ObjectId(id)) },
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status, updatedAt: new Date() } },
        );
        revalidatePath(BASE_PATH);
        return { processed: res.modifiedCount ?? 0 };
    } catch (e) {
        return {
            processed: 0,
            error: e instanceof Error ? e.message : 'Failed.',
        };
    }
}

export async function deletePromotion(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id))
        return { success: false, error: 'Invalid promotion id.' };

    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };

    const guard = await requirePermission('crm_promotion', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (result.deletedCount === 0)
            return { success: false, error: 'Promotion not found.' };

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'promotion',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath(BASE_PATH);
        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Failed.',
        };
    }
}
