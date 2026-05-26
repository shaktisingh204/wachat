'use server';

/**
 * CRM HR Recognitions — Mongo-only server actions.
 *
 * No Rust crate exists for recognitions, so every code path reads from /
 * writes to the `crm_recognitions` collection directly. Field shape:
 *   - fromEmployeeId / fromEmployeeName
 *   - toEmployeeId   / toEmployeeName
 *   - category   ('achievement'|'teamwork'|'leadership'|'innovation'
 *                  |'customer_service'|'other')
 *   - message    (textarea)
 *   - badgeUrl   (SabFile)
 *   - points     (integer)
 *   - isPublic   (boolean)
 *   - awardProgramId
 *   - status     ('draft'|'pending'|'approved'|'archived')
 *
 * Returns are shaped to match the canonical `{ message | error, id }` and
 * `{ success, error }` envelopes used elsewhere so the form / list pages
 * stay drop-in compatible.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, type Filter } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmRecognitionsApi } from '@/lib/rust-client/crm-recognitions';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ──────────────────────────────────────────────────────────── */

export type CrmRecognitionCategory =
    | 'achievement'
    | 'teamwork'
    | 'leadership'
    | 'innovation'
    | 'customer_service'
    | 'other';

export type CrmRecognitionStatus =
    | 'draft'
    | 'pending'
    | 'approved'
    | 'archived';

export interface CrmRecognitionDoc {
    _id: string;
    userId?: string;
    fromEmployeeId?: string;
    fromEmployeeName?: string;
    toEmployeeId?: string;
    toEmployeeName?: string;
    category?: CrmRecognitionCategory;
    message?: string;
    badgeUrl?: string;
    points?: number;
    isPublic?: boolean;
    awardProgramId?: string;
    status?: CrmRecognitionStatus;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmRecognitionListFilters {
    q?: string;
    status?: CrmRecognitionStatus;
    category?: CrmRecognitionCategory;
    isPublic?: boolean;
    limit?: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const COLLECTION = 'crm_recognitions';

const VALID_CATEGORIES: ReadonlySet<CrmRecognitionCategory> = new Set([
    'achievement',
    'teamwork',
    'leadership',
    'innovation',
    'customer_service',
    'other',
]);

const VALID_STATUSES: ReadonlySet<CrmRecognitionStatus> = new Set([
    'draft',
    'pending',
    'approved',
    'archived',
]);

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

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function serialize<T extends Record<string, unknown>>(
    doc: WithId<T> | null,
): CrmRecognitionDoc | null {
    if (!doc) return null;
    return JSON.parse(JSON.stringify({ ...doc, _id: String(doc._id) }));
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getRecognitions(
    filters?: CrmRecognitionListFilters,
): Promise<{ items: CrmRecognitionDoc[] }> {
    const session = await getSession();
    if (!session?.user) return { items: [] };

    const guard = await requirePermission('crm_recognition', 'view');
    if (!guard.ok) return { items: [] };

    if (useRustCrm()) {
        try {
            const res = await crmRecognitionsApi.list({
                q: filters?.q,
                status: filters?.status,
                category: filters?.category,
                isPublic: filters?.isPublic,
                limit: filters?.limit,
            });
            return {
                items: JSON.parse(
                    JSON.stringify(res.items ?? []),
                ) as CrmRecognitionDoc[],
            };
        } catch (e) {
            console.error('[getRecognitions] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'recognition',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const query: Filter<Record<string, unknown>> = {
            userId: new ObjectId(session.user._id),
        };

        if (filters?.status && VALID_STATUSES.has(filters.status)) {
            query.status = filters.status;
        }
        if (filters?.category && VALID_CATEGORIES.has(filters.category)) {
            query.category = filters.category;
        }
        if (typeof filters?.isPublic === 'boolean') {
            query.isPublic = filters.isPublic;
        }
        const q = filters?.q?.trim();
        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query.$or = [
                { message: rx },
                { toEmployeeName: rx },
                { fromEmployeeName: rx },
            ];
        }

        const cursor = db
            .collection(COLLECTION)
            .find(query)
            .sort({ createdAt: -1 })
            .limit(Math.min(filters?.limit ?? 100, 500));

        const docs = await cursor.toArray();
        return {
            items: docs
                .map((d) => serialize(d))
                .filter((x): x is CrmRecognitionDoc => !!x),
        };
    } catch (e) {
        console.error('[getRecognitions] failed:', e);
        return { items: [] };
    }
}

export async function getRecognitionById(
    id: string,
): Promise<CrmRecognitionDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_recognition', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmRecognitionsApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as CrmRecognitionDoc;
        } catch (e) {
            console.error('[getRecognitionById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'recognition',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return serialize(doc);
    } catch (e) {
        console.error('[getRecognitionById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export interface SavePayload {
    fromEmployeeId?: string;
    fromEmployeeName?: string;
    toEmployeeId?: string;
    toEmployeeName?: string;
    category?: CrmRecognitionCategory;
    message?: string;
    badgeUrl?: string;
    points?: number;
    isPublic?: boolean;
    awardProgramId?: string;
    status?: CrmRecognitionStatus;
}

function readPayload(formData: FormData): {
    payload: SavePayload;
    error?: string;
} {
    const toEmployeeName = asString(formData.get('toEmployeeName'));
    const message = asString(formData.get('message'));
    if (!toEmployeeName)
        return { payload: {}, error: 'Recipient name is required.' };
    if (!message) return { payload: {}, error: 'Message is required.' };

    const categoryRaw = asString(formData.get('category'));
    const category: CrmRecognitionCategory | undefined =
        categoryRaw && VALID_CATEGORIES.has(categoryRaw as CrmRecognitionCategory)
            ? (categoryRaw as CrmRecognitionCategory)
            : undefined;

    const statusRaw = asString(formData.get('status'));
    const status: CrmRecognitionStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmRecognitionStatus)
            ? (statusRaw as CrmRecognitionStatus)
            : undefined;

    return {
        payload: {
            fromEmployeeId: asString(formData.get('fromEmployeeId')),
            fromEmployeeName: asString(formData.get('fromEmployeeName')),
            toEmployeeId: asString(formData.get('toEmployeeId')),
            toEmployeeName,
            message,
            badgeUrl: asString(formData.get('badgeUrl')),
            points: asNumber(formData.get('points')),
            isPublic: asBool(formData.get('isPublic')),
            awardProgramId: asString(formData.get('awardProgramId')),
            ...(category ? { category } : {}),
            ...(status ? { status } : {}),
        },
    };
}

export async function saveRecognition(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const recognitionId = asString(formData.get('recognitionId'));
    const isEditing = !!recognitionId;

    const guard = await requirePermission(
        'crm_recognition',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        const { db } = await connectToDatabase();

        if (isEditing) {
            if (!ObjectId.isValid(recognitionId!))
                return { error: 'Invalid recognition id.' };

            const setDoc: Record<string, unknown> = {
                ...payload,
                updatedAt: new Date(),
            };
            await db.collection(COLLECTION).updateOne(
                {
                    _id: new ObjectId(recognitionId!),
                    userId: new ObjectId(session.user._id),
                },
                { $set: setDoc },
            );
            revalidatePath('/dashboard/hrm/hr/recognition');
            revalidatePath(`/dashboard/hrm/hr/recognition/${recognitionId}`);
            return { message: 'Recognition updated.', id: recognitionId };
        }

        const now = new Date();
        const insertDoc = {
            userId: new ObjectId(session.user._id),
            ...payload,
            status: payload.status ?? 'approved',
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLLECTION).insertOne(insertDoc);
        revalidatePath('/dashboard/hrm/hr/recognition');
        return {
            message: 'Recognition created.',
            id: res.insertedId.toString(),
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveRecognition] failed:', msg);
        return { error: `Failed to save recognition: ${msg}` };
    }
}

export async function deleteRecognition(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id))
        return { success: false, error: 'Recognition id is required.' };

    const guard = await requirePermission('crm_recognition', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        revalidatePath('/dashboard/hrm/hr/recognition');
        return { success: res.deletedCount > 0 };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteRecognition] failed:', msg);
        return { success: false, error: `Failed to delete recognition: ${msg}` };
    }
}
