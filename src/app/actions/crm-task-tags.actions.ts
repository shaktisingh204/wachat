'use server';

/**
 * CRM Task Tags — settings-style server actions.
 *
 * No Rust crate; this entity is a tenant-scoped Mongo collection
 * (`crm_task_tags`) used for free-form tagging of tasks.
 *
 * Fields: name (unique per tenant), color, description, tasks_count,
 * is_active, status. Soft-delete via `status = 'archived'`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { requireSession, serialize } from '@/lib/hr-crud';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmTaskTagsApi } from '@/lib/rust-client/crm-task-tags';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

const ENTITY_KIND = 'task_tag';

type CrmTaskTagStatus = 'active' | 'archived';

interface CrmTaskTagDoc {
    _id?: string;
    userId?: string;
    name: string;
    color?: string;
    description?: string;
    tasksCount?: number;
    isActive?: boolean;
    status?: CrmTaskTagStatus;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

const COLLECTION = 'crm_task_tags';
const REVALIDATE = '/dashboard/crm/projects/task-tags';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getTaskTags(): Promise<CrmTaskTagDoc[]> {
    const user = await requireSession();
    if (!user) return [];

    const guard = await requirePermission('crm_task_tag', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmTaskTagsApi.list({ limit: 500 });
            return JSON.parse(
                JSON.stringify(res.items ?? []),
            ) as CrmTaskTagDoc[];
        } catch (e) {
            console.error(
                '[getTaskTags] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: ENTITY_KIND,
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    const { db } = await connectToDatabase();
    const docs = await db
        .collection(COLLECTION)
        .find({ userId: new ObjectId(user._id) })
        .sort({ name: 1 })
        .toArray();
    return serialize(docs) as WithId<CrmTaskTagDoc>[];
}

export async function getTaskTagById(id: string): Promise<CrmTaskTagDoc | null> {
    const user = await requireSession();
    if (!user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_task_tag', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmTaskTagsApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as CrmTaskTagDoc;
        } catch (e) {
            console.error(
                '[getTaskTagById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: ENTITY_KIND,
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(user._id),
    });
    return doc ? (serialize(doc) as CrmTaskTagDoc) : null;
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveTaskTag(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const user = await requireSession();
    if (!user) return { error: 'Access denied.' };

    const tagId = asString(formData.get('tagId'));
    const isEditing = !!tagId;

    const guard = await requirePermission(
        'crm_task_tag',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Name is required.' };

    const statusRaw = asString(formData.get('status'));
    const status: CrmTaskTagStatus =
        statusRaw === 'archived' ? 'archived' : 'active';

    try {
        const { db } = await connectToDatabase();

        // Per-tenant unique name guard. Case-insensitive.
        const dupFilter: Record<string, unknown> = {
            userId: new ObjectId(user._id),
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        };
        if (isEditing && tagId && ObjectId.isValid(tagId)) {
            dupFilter._id = { $ne: new ObjectId(tagId) };
        }
        const existing = await db.collection(COLLECTION).findOne(dupFilter);
        if (existing) {
            return { error: 'A tag with this name already exists.' };
        }

        const now = new Date();
        const data: Record<string, unknown> = {
            name,
            color: asString(formData.get('color')) ?? null,
            description: asString(formData.get('description')) ?? null,
            isActive: asBool(formData.get('isActive')),
            status,
            userId: new ObjectId(user._id),
            updatedAt: now,
        };

        if (isEditing && tagId && ObjectId.isValid(tagId)) {
            await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(tagId), userId: new ObjectId(user._id) },
                { $set: data },
            );
            void writeAuditEntry({
                tenantUserId: user._id,
                action: 'update',
                entityKind: 'task_tag',
                entityId: tagId,
            });
            revalidatePath(REVALIDATE);
            return { message: 'Tag updated.', id: tagId };
        }
        data.createdAt = now;
        data.tasksCount = 0;
        const res = await db.collection(COLLECTION).insertOne(data);
        void writeAuditEntry({
            tenantUserId: user._id,
            action: 'create',
            entityKind: 'task_tag',
            entityId: res.insertedId.toString(),
        });
        revalidatePath(REVALIDATE);
        return { message: 'Tag created.', id: res.insertedId.toString() };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveTaskTag] failed:', msg);
        return { error: `Failed to save tag: ${msg}` };
    }
}

/**
 * Soft-delete: flips status to 'archived' rather than removing the row.
 * Any task referencing this tag continues to display the tag name.
 */
export async function deleteTaskTag(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const user = await requireSession();
    if (!user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid tag id.' };

    const guard = await requirePermission('crm_task_tag', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(user._id) },
            { $set: { status: 'archived', isActive: false, updatedAt: new Date() } },
        );
        void writeAuditEntry({
            tenantUserId: user._id,
            action: 'archive',
            entityKind: 'task_tag',
            entityId: id,
        });
        revalidatePath(REVALIDATE);
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteTaskTag] failed:', msg);
        return { success: false, error: `Failed to archive tag: ${msg}` };
    }
}
