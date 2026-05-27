'use server';

/**
 * CRM Task Categories — settings-style server actions.
 *
 * No Rust crate; this entity is a tenant-scoped Mongo collection
 * (`crm_task_categories`) used to categorise tasks across projects.
 *
 * Fields: name, parent_id, color, icon, description, display_order,
 * is_active, status. Soft-delete via `status = 'archived'`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { requireSession, serialize } from '@/lib/hr-crud';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmTaskCategoriesApi } from '@/lib/rust-client/crm-task-categories';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

const ENTITY_KIND = 'task_category';

type CrmTaskCategoryStatus = 'active' | 'archived';

interface CrmTaskCategoryDoc {
    _id?: string;
    userId?: string;
    name: string;
    parentId?: string | null;
    color?: string;
    icon?: string;
    description?: string;
    displayOrder?: number;
    isActive?: boolean;
    status?: CrmTaskCategoryStatus;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

const COLLECTION = 'crm_task_categories';
const REVALIDATE = '/dashboard/crm/projects/task-categories';

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

export async function getTaskCategories(): Promise<CrmTaskCategoryDoc[]> {
    const user = await requireSession();
    if (!user) return [];

    const guard = await requirePermission('crm_task_category', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmTaskCategoriesApi.list({ limit: 500 });
            return JSON.parse(
                JSON.stringify(res.items ?? []),
            ) as CrmTaskCategoryDoc[];
        } catch (e) {
            console.error(
                '[getTaskCategories] rust path failed; falling back:',
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
        .sort({ displayOrder: 1, createdAt: -1 })
        .toArray();
    return serialize(docs) as WithId<CrmTaskCategoryDoc>[];
}

export async function getTaskCategoryById(
    id: string,
): Promise<CrmTaskCategoryDoc | null> {
    const user = await requireSession();
    if (!user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_task_category', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmTaskCategoriesApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as CrmTaskCategoryDoc;
        } catch (e) {
            console.error(
                '[getTaskCategoryById] rust path failed; falling back:',
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
    return doc ? (serialize(doc) as CrmTaskCategoryDoc) : null;
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveTaskCategory(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const user = await requireSession();
    if (!user) return { error: 'Access denied.' };

    const categoryId = asString(formData.get('categoryId'));
    const isEditing = !!categoryId;

    const guard = await requirePermission(
        'crm_task_category',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Name is required.' };

    const parentIdRaw = asString(formData.get('parentId'));
    // Guard: parent can't be self (cycles).
    if (isEditing && parentIdRaw && parentIdRaw === categoryId) {
        return { error: 'A category cannot be its own parent.' };
    }
    const parentId =
        parentIdRaw && ObjectId.isValid(parentIdRaw)
            ? new ObjectId(parentIdRaw)
            : null;

    const statusRaw = asString(formData.get('status'));
    const status: CrmTaskCategoryStatus =
        statusRaw === 'archived' ? 'archived' : 'active';

    const now = new Date();
    const data: Record<string, unknown> = {
        name,
        parentId,
        color: asString(formData.get('color')) ?? null,
        icon: asString(formData.get('icon')) ?? null,
        description: asString(formData.get('description')) ?? null,
        displayOrder: asNumber(formData.get('displayOrder')) ?? 0,
        isActive: asBool(formData.get('isActive')),
        status,
        userId: new ObjectId(user._id),
        updatedAt: now,
    };

    try {
        const { db } = await connectToDatabase();
        if (isEditing && categoryId && ObjectId.isValid(categoryId)) {
            await db.collection(COLLECTION).updateOne(
                {
                    _id: new ObjectId(categoryId),
                    userId: new ObjectId(user._id),
                },
                { $set: data },
            );
            void writeAuditEntry({
                tenantUserId: user._id,
                action: 'update',
                entityKind: 'task_category',
                entityId: categoryId,
            });
            revalidatePath(REVALIDATE);
            return { message: 'Category updated.', id: categoryId };
        }
        data.createdAt = now;
        const res = await db.collection(COLLECTION).insertOne(data);
        void writeAuditEntry({
            tenantUserId: user._id,
            action: 'create',
            entityKind: 'task_category',
            entityId: res.insertedId.toString(),
        });
        revalidatePath(REVALIDATE);
        return { message: 'Category created.', id: res.insertedId.toString() };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveTaskCategory] failed:', msg);
        return { error: `Failed to save category: ${msg}` };
    }
}

/**
 * Soft-delete: flips status to 'archived' rather than removing the row.
 * The audit-log and any task referencing this category continue to work.
 */
export async function deleteTaskCategory(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const user = await requireSession();
    if (!user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid category id.' };
    }

    const guard = await requirePermission('crm_task_category', 'delete');
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
            entityKind: 'task_category',
            entityId: id,
        });
        revalidatePath(REVALIDATE);
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteTaskCategory] failed:', msg);
        return { success: false, error: `Failed to archive category: ${msg}` };
    }
}
