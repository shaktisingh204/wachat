'use server';

/**
 * CRM Contract Templates — server actions.
 *
 * Backed by the Mongo `crm_contract_templates` collection (no Rust crate).
 * A template is a reusable contract body (markdown), default term length,
 * default auto-renew flag, and a list of substitution `variables` that
 * the contract editor offers as placeholders.
 *
 * Field shape:
 *   - name, type, body (markdown), default_term_months, default_auto_renew,
 *     variables[], is_active, status
 *
 * Multi-tenant isolation via `userId`. RBAC key: `crm_contract_template`.
 */

import { ObjectId, type Filter, type Document } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';

const COLLECTION = 'crm_contract_templates';
const BASE_PATH = '/dashboard/crm/sales/contracts/templates';

type CrmContractTemplateStatus = 'draft' | 'active' | 'archived';

type CrmContractTemplateType =
    | 'service'
    | 'sales'
    | 'nda'
    | 'msa'
    | 'sow'
    | 'employment'
    | 'other';

interface CrmContractTemplateDoc {
    _id: string;
    userId?: string;
    name: string;
    type: CrmContractTemplateType;
    body?: string;
    defaultTermMonths?: number;
    defaultAutoRenew?: boolean;
    variables?: string[];
    isActive: boolean;
    status: CrmContractTemplateStatus;
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

function asArray(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const parts = s
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
}

const VALID_TYPES: ReadonlySet<CrmContractTemplateType> =
    new Set<CrmContractTemplateType>([
        'service',
        'sales',
        'nda',
        'msa',
        'sow',
        'employment',
        'other',
    ]);

const VALID_STATUSES: ReadonlySet<CrmContractTemplateStatus> =
    new Set<CrmContractTemplateStatus>(['draft', 'active', 'archived']);

function serialize<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

interface ContractTemplateListParams {
    q?: string;
    status?: CrmContractTemplateStatus | 'all';
    type?: CrmContractTemplateType | 'all';
    limit?: number;
}

export async function getContractTemplates(
    filters?: ContractTemplateListParams,
): Promise<{ items: CrmContractTemplateDoc[]; error?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { items: [], error: 'Unauthorized.' };

    const guard = await requirePermission('crm_contract_template', 'view');
    if (!guard.ok) return { items: [], error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = {
            userId: new ObjectId(session.user._id as string),
        };
        if (filters?.status && filters.status !== 'all') {
            filter.status = filters.status;
        }
        if (filters?.type && filters.type !== 'all') {
            filter.type = filters.type;
        }
        if (filters?.q) {
            const re = new RegExp(
                filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            filter.$or = [{ name: re }, { body: re }];
        }

        const docs = await db
            .collection(COLLECTION)
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(filters?.limit ?? 100)
            .toArray();

        return {
            items: serialize(docs) as unknown as CrmContractTemplateDoc[],
        };
    } catch (e) {
        console.error('[getContractTemplates] error:', e);
        return { items: [], error: 'Failed to load contract templates.' };
    }
}

export async function getContractTemplateById(
    id: string,
): Promise<CrmContractTemplateDoc | null> {
    if (!id || !ObjectId.isValid(id)) return null;

    const session = await getSession();
    if (!session?.user?._id) return null;

    const guard = await requirePermission('crm_contract_template', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        return doc
            ? (serialize(doc) as unknown as CrmContractTemplateDoc)
            : null;
    } catch (e) {
        console.error('[getContractTemplateById] error:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: Partial<CrmContractTemplateDoc> & {
        name: string;
        type: CrmContractTemplateType;
    };
    error?: string;
} {
    const name = asString(formData.get('name'));
    if (!name)
        return {
            payload: { name: '', type: 'service' } as Partial<CrmContractTemplateDoc> & {
                name: string;
                type: CrmContractTemplateType;
            },
            error: 'Template name is required.',
        };

    const rawType = asString(formData.get('type')) ?? 'service';
    const type = (VALID_TYPES.has(rawType as CrmContractTemplateType)
        ? rawType
        : 'service') as CrmContractTemplateType;

    const rawStatus = asString(formData.get('status'));
    const status =
        rawStatus &&
        VALID_STATUSES.has(rawStatus as CrmContractTemplateStatus)
            ? (rawStatus as CrmContractTemplateStatus)
            : undefined;

    return {
        payload: {
            name,
            type,
            body: asString(formData.get('body')),
            defaultTermMonths: asInt(formData.get('defaultTermMonths')),
            defaultAutoRenew: asBool(formData.get('defaultAutoRenew')),
            variables: asArray(formData.get('variables')),
            isActive: asBool(formData.get('isActive')),
            ...(status ? { status } : {}),
        },
    };
}

export async function saveContractTemplate(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { error: 'Access denied.' };

    const templateId = asString(formData.get('templateId'));
    const isEditing = !!templateId && ObjectId.isValid(templateId);

    const guard = await requirePermission(
        'crm_contract_template',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        const data: Record<string, unknown> = {
            ...payload,
            updatedAt: now,
        };

        if (isEditing) {
            const result = await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(templateId!), userId: userObjectId },
                { $set: data },
            );
            if (result.matchedCount === 0) {
                return { error: 'Template not found.' };
            }
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'contract_template',
                    entityId: templateId!,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath(BASE_PATH);
            revalidatePath(`${BASE_PATH}/${templateId}`);
            return { message: 'Template updated.', id: templateId };
        }

        data.userId = userObjectId;
        data.createdAt = now;
        if (!data.status) data.status = 'draft';
        if (data.isActive == null) data.isActive = true;

        const { insertedId } = await db
            .collection(COLLECTION)
            .insertOne(data);
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'contract_template',
                entityId: insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath(BASE_PATH);
        return { message: 'Template created.', id: insertedId.toString() };
    } catch (e) {
        console.error('[saveContractTemplate] error:', e);
        return {
            error:
                e instanceof Error
                    ? e.message
                    : 'Failed to save contract template.',
        };
    }
}

export async function setContractTemplateStatus(
    id: string,
    status: CrmContractTemplateStatus,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id))
        return { success: false, error: 'Invalid template id.' };
    if (!VALID_STATUSES.has(status))
        return { success: false, error: 'Invalid status.' };

    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_contract_template', 'edit');
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
            return { success: false, error: 'Template not found.' };
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

export async function deleteContractTemplate(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id))
        return { success: false, error: 'Invalid template id.' };

    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };

    const guard = await requirePermission('crm_contract_template', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (result.deletedCount === 0)
            return { success: false, error: 'Template not found.' };

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'contract_template',
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
