'use server';

/**
 * CRM Contract Types — server actions.
 *
 * Backed by the Mongo `crm_contract_types` collection (no Rust crate).
 * Settings-style entity: short name + code, an optional description, the
 * default term length, and an optional default-template pointer.
 *
 * Multi-tenant isolation via `userId`. RBAC key: `crm_contract_type`.
 */

import { ObjectId, type Filter, type Document } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';

const COLLECTION = 'crm_contract_types';
const BASE_PATH = '/dashboard/crm/sales/contracts/types';

type CrmContractTypeStatus = 'active' | 'archived';

interface CrmContractTypeDoc {
    _id: string;
    userId?: string;
    name: string;
    code: string;
    description?: string;
    defaultTermMonths?: number;
    defaultTemplateId?: string;
    isActive: boolean;
    status: CrmContractTypeStatus;
    createdAt?: string;
    updatedAt?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asInt(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

const VALID_STATUSES: ReadonlySet<CrmContractTypeStatus> =
    new Set<CrmContractTypeStatus>(['active', 'archived']);

function serialize<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

interface ContractTypeListParams {
    q?: string;
    status?: CrmContractTypeStatus | 'all';
}

export async function getContractTypes(
    filters?: ContractTypeListParams,
): Promise<{ items: CrmContractTypeDoc[]; error?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { items: [], error: 'Unauthorized.' };

    const guard = await requirePermission('crm_contract_type', 'view');
    if (!guard.ok) return { items: [], error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = {
            userId: new ObjectId(session.user._id as string),
        };
        if (filters?.status && filters.status !== 'all') {
            filter.status = filters.status;
        }
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
            .sort({ name: 1 })
            .toArray();

        return { items: serialize(docs) as unknown as CrmContractTypeDoc[] };
    } catch (e) {
        console.error('[getContractTypes] error:', e);
        return { items: [], error: 'Failed to load contract types.' };
    }
}

export async function getContractTypeById(
    id: string,
): Promise<CrmContractTypeDoc | null> {
    if (!id || !ObjectId.isValid(id)) return null;

    const session = await getSession();
    if (!session?.user?._id) return null;

    const guard = await requirePermission('crm_contract_type', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        return doc
            ? (serialize(doc) as unknown as CrmContractTypeDoc)
            : null;
    } catch (e) {
        console.error('[getContractTypeById] error:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveContractType(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { error: 'Access denied.' };

    const typeId = asString(formData.get('typeId'));
    const isEditing = !!typeId && ObjectId.isValid(typeId);

    const guard = await requirePermission(
        'crm_contract_type',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Name is required.' };

    const codeRaw = asString(formData.get('code'));
    if (!codeRaw) return { error: 'Code is required.' };
    const code = codeRaw.toUpperCase();

    const description = asString(formData.get('description'));
    const defaultTermMonths = asInt(formData.get('defaultTermMonths'));
    const defaultTemplateId = asString(formData.get('defaultTemplateId'));
    const isActive = asBool(formData.get('isActive'));

    const rawStatus = asString(formData.get('status'));
    const status =
        rawStatus && VALID_STATUSES.has(rawStatus as CrmContractTypeStatus)
            ? (rawStatus as CrmContractTypeStatus)
            : 'active';

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        const data: Record<string, unknown> = {
            name,
            code,
            description,
            defaultTermMonths,
            defaultTemplateId,
            isActive,
            status,
            updatedAt: now,
        };

        if (isEditing) {
            const result = await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(typeId!), userId: userObjectId },
                { $set: data },
            );
            if (result.matchedCount === 0) {
                return { error: 'Contract type not found.' };
            }
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'contract_type',
                    entityId: typeId!,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath(BASE_PATH);
            return { message: 'Contract type updated.', id: typeId };
        }

        data.userId = userObjectId;
        data.createdAt = now;

        // Enforce code uniqueness per tenant.
        const dupe = await db
            .collection(COLLECTION)
            .findOne({ userId: userObjectId, code });
        if (dupe) {
            return { error: 'A contract type with this code already exists.' };
        }

        const { insertedId } = await db.collection(COLLECTION).insertOne(data);
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'contract_type',
                entityId: insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath(BASE_PATH);
        return {
            message: 'Contract type created.',
            id: insertedId.toString(),
        };
    } catch (e) {
        console.error('[saveContractType] error:', e);
        return {
            error:
                e instanceof Error
                    ? e.message
                    : 'Failed to save contract type.',
        };
    }
}

export async function deleteContractType(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id))
        return { success: false, error: 'Invalid contract type id.' };

    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };

    const guard = await requirePermission('crm_contract_type', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (result.deletedCount === 0)
            return { success: false, error: 'Contract type not found.' };

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'contract_type',
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
