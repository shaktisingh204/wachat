'use server';

/**
 * CRM Welcome Kits — Mongo-backed (no Rust crate).
 *
 * Tracks onboarding "swag boxes" issued per employee: items list,
 * shipping address, tracking number, and a lifecycle status
 * (pending / shipped / delivered / archived).
 *
 * The `items` array on the form is submitted as a single JSON string in
 * the `itemsJson` field so we don't have to special-case nested
 * FormData. Each item is `{ name, sku?, delivered, delivered_at? }`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';

const COLLECTION = 'crm_welcome_kits';
const BASE_PATH = '/dashboard/hrm/hr/welcome-kit';
const RBAC_KEY = 'crm_welcome_kit';
const ENTITY_KIND = 'welcome_kit';

export type CrmWelcomeKitStatus =
    | 'pending'
    | 'shipped'
    | 'delivered'
    | 'archived';

export interface CrmWelcomeKitItem {
    name: string;
    sku?: string;
    delivered: boolean;
    delivered_at?: string | null;
}

export interface CrmWelcomeKitDoc {
    _id: string;
    userId?: string;
    employee_id: string;
    employee_name?: string;
    items: CrmWelcomeKitItem[];
    shipping_address?: string;
    status: CrmWelcomeKitStatus;
    tracking_number?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmWelcomeKitFilters {
    q?: string;
    status?: CrmWelcomeKitStatus | 'all';
    employeeId?: string;
}

const VALID_STATUSES: ReadonlySet<CrmWelcomeKitStatus> =
    new Set<CrmWelcomeKitStatus>(['pending', 'shipped', 'delivered', 'archived']);

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function serialize<T extends WithId<Record<string, unknown>>>(doc: T): CrmWelcomeKitDoc {
    return JSON.parse(JSON.stringify(doc)) as CrmWelcomeKitDoc;
}

function parseItems(raw: string | undefined): CrmWelcomeKitItem[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((it): CrmWelcomeKitItem | null => {
                if (!it || typeof it !== 'object') return null;
                const obj = it as Record<string, unknown>;
                const name = typeof obj.name === 'string' ? obj.name.trim() : '';
                if (!name) return null;
                return {
                    name,
                    sku: typeof obj.sku === 'string' ? obj.sku.trim() || undefined : undefined,
                    delivered: !!obj.delivered,
                    delivered_at:
                        typeof obj.delivered_at === 'string' && obj.delivered_at
                            ? obj.delivered_at
                            : null,
                };
            })
            .filter((it): it is CrmWelcomeKitItem => it !== null);
    } catch {
        return [];
    }
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getWelcomeKits(
    filters?: CrmWelcomeKitFilters,
): Promise<CrmWelcomeKitDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
            userId: new ObjectId(session.user._id as string),
        };

        if (filters?.status && filters.status !== 'all') filter.status = filters.status;
        if (filters?.employeeId) filter.employee_id = filters.employeeId;

        if (filters?.q) {
            const rx = new RegExp(filters.q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
            filter.$or = [
                { employee_name: { $regex: rx } },
                { employee_id: { $regex: rx } },
                { tracking_number: { $regex: rx } },
            ];
        }

        const rows = await db
            .collection(COLLECTION)
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();

        return rows.map((r) => serialize(r as WithId<Record<string, unknown>>));
    } catch (e) {
        console.error('[getWelcomeKits] failed:', e);
        return [];
    }
}

export async function getWelcomeKitById(id: string): Promise<CrmWelcomeKitDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return serialize(doc as WithId<Record<string, unknown>>);
    } catch (e) {
        console.error('[getWelcomeKitById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export interface WelcomeKitPayload {
    employee_id: string;
    employee_name?: string;
    items: CrmWelcomeKitItem[];
    shipping_address?: string;
    status: CrmWelcomeKitStatus;
    tracking_number?: string;
}

function readPayload(formData: FormData): {
    payload?: WelcomeKitPayload;
    error?: string;
} {
    const employee_id = asString(formData.get('employee_id'));
    if (!employee_id) return { error: 'Employee id is required.' };

    const statusRaw = asString(formData.get('status')) ?? 'pending';
    const status: CrmWelcomeKitStatus = VALID_STATUSES.has(statusRaw as CrmWelcomeKitStatus)
        ? (statusRaw as CrmWelcomeKitStatus)
        : 'pending';

    const items = parseItems(asString(formData.get('itemsJson')));

    return {
        payload: {
            employee_id,
            employee_name: asString(formData.get('employee_name')),
            items,
            shipping_address: asString(formData.get('shipping_address')),
            tracking_number: asString(formData.get('tracking_number')),
            status,
        },
    };
}

export async function saveWelcomeKit(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const kitId = asString(formData.get('kitId'));
    const isEditing = !!kitId;

    const guard = await requirePermission(RBAC_KEY, isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error || !payload) return { error: error ?? 'Invalid payload.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing && ObjectId.isValid(kitId!)) {
            const result = await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(kitId!), userId: userObjectId },
                { $set: { ...payload, updatedAt: now } },
            );
            if (result.matchedCount === 0) return { error: 'Welcome kit not found.' };

            void writeAuditEntry({
                tenantUserId: session.user._id as string,
                action: 'update',
                entityKind: ENTITY_KIND,
                entityId: kitId!,
                reason: `Welcome kit status=${payload.status}`,
            });
            revalidatePath(BASE_PATH);
            revalidatePath(`${BASE_PATH}/${kitId}`);
            return { message: 'Welcome kit updated.', id: kitId! };
        }

        const inserted = await db.collection(COLLECTION).insertOne({
            ...payload,
            userId: userObjectId,
            createdAt: now,
            updatedAt: now,
        });
        const id = inserted.insertedId.toString();

        void writeAuditEntry({
            tenantUserId: session.user._id as string,
            action: 'create',
            entityKind: ENTITY_KIND,
            entityId: id,
            reason: `Welcome kit for employee ${payload.employee_id}`,
        });

        revalidatePath(BASE_PATH);
        return { message: 'Welcome kit created.', id };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveWelcomeKit] failed:', msg);
        return { error: `Failed to save welcome kit: ${msg}` };
    }
}

export async function deleteWelcomeKit(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission(RBAC_KEY, 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (result.deletedCount > 0) {
            void writeAuditEntry({
                tenantUserId: session.user._id as string,
                action: 'delete',
                entityKind: ENTITY_KIND,
                entityId: id,
            });
        }
        revalidatePath(BASE_PATH);
        return { success: result.deletedCount > 0 };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteWelcomeKit] failed:', msg);
        return { success: false, error: msg };
    }
}
