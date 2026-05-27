'use server';

/**
 * CRM HR Learning Paths server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read paths
 * delegate to `/v1/crm/learning-paths` on the Rust BFF; otherwise legacy
 * direct-Mongo runs. Failures record via `recordRustFallback` and fall
 * through to the legacy path.
 *
 * Fields (Mongo source-of-truth — snake_case):
 *   name, description, target_audience ('department'|'role'|'all'),
 *   trainings (string[] — training _id refs), duration_weeks,
 *   is_mandatory, status (draft|active|archived)
 *
 * Soft-delete is performed by flipping `status` to `archived`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, type Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmLearningPathsApi } from '@/lib/rust-client/crm-learning-paths';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ──────────────────────────────────────────────────────────── */

type CrmLearningPathStatus = 'draft' | 'active' | 'archived';
type CrmLearningPathAudience = 'all' | 'department' | 'role';

interface CrmLearningPathDoc {
    _id: string;
    userId?: string;
    name: string;
    description?: string;
    targetAudience: CrmLearningPathAudience;
    trainings: string[];
    durationWeeks?: number;
    isMandatory: boolean;
    status: CrmLearningPathStatus;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmLearningPathListParams {
    q?: string;
    status?: CrmLearningPathStatus | 'all';
    targetAudience?: CrmLearningPathAudience;
    limit?: number;
}

interface CrmLearningPathListResponse {
    items: CrmLearningPathDoc[];
}

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

function asInt(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

const VALID_STATUSES: ReadonlySet<CrmLearningPathStatus> = new Set<CrmLearningPathStatus>([
    'draft',
    'active',
    'archived',
]);

const VALID_AUDIENCES: ReadonlySet<CrmLearningPathAudience> = new Set<CrmLearningPathAudience>([
    'all',
    'department',
    'role',
]);

function normaliseStatus(v: string | undefined): CrmLearningPathStatus {
    if (v && VALID_STATUSES.has(v as CrmLearningPathStatus)) {
        return v as CrmLearningPathStatus;
    }
    return 'draft';
}

function normaliseAudience(v: string | undefined): CrmLearningPathAudience {
    if (v && VALID_AUDIENCES.has(v as CrmLearningPathAudience)) {
        return v as CrmLearningPathAudience;
    }
    return 'all';
}

function asTrainingIds(formData: FormData): string[] {
    const list = formData.getAll('trainings');
    return list
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0);
}

function dateToIso(value: unknown): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    }
    return String(value);
}

function toDoc(raw: WithId<Document>): CrmLearningPathDoc {
    const trainingsRaw = raw.trainings ?? raw.training_ids;
    const trainings = Array.isArray(trainingsRaw)
        ? (trainingsRaw as unknown[]).map(String).filter((s) => s.length > 0)
        : [];

    const audience =
        (raw.target_audience as string | undefined) ??
        (raw.targetAudience as string | undefined);

    const duration =
        typeof raw.duration_weeks === 'number'
            ? raw.duration_weeks
            : typeof raw.durationWeeks === 'number'
              ? raw.durationWeeks
              : undefined;

    const mandatory =
        raw.is_mandatory === true || raw.isMandatory === true;

    return {
        _id: String(raw._id),
        userId: raw.userId ? String(raw.userId) : undefined,
        name: String(raw.name ?? ''),
        description: raw.description ? String(raw.description) : undefined,
        targetAudience: normaliseAudience(audience),
        trainings,
        durationWeeks: duration,
        isMandatory: mandatory,
        status: normaliseStatus(raw.status as string | undefined),
        createdAt: dateToIso(raw.createdAt),
        updatedAt: dateToIso(raw.updatedAt),
    };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getLearningPaths(
    filters?: CrmLearningPathListParams,
): Promise<CrmLearningPathListResponse> {
    const empty: CrmLearningPathListResponse = { items: [] };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_learning_path', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmLearningPathsApi.list({
                q: filters?.q,
                status: filters?.status,
                targetAudience: filters?.targetAudience,
                limit: filters?.limit,
            });
            const items = (res.items ?? []).map((row) =>
                toDoc(row as unknown as WithId<Document>),
            );
            return { items };
        } catch (e) {
            console.error(
                '[getLearningPaths] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'learning_path',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
            userId: new ObjectId(session.user._id as string),
        };

        if (filters?.status && filters.status !== 'all') {
            filter.status = filters.status;
        }
        if (filters?.targetAudience) {
            filter.target_audience = filters.targetAudience;
        }
        if (filters?.q) {
            filter.name = { $regex: filters.q, $options: 'i' };
        }

        const limit = Math.min(filters?.limit ?? 100, 500);
        const rows = await db
            .collection('crm_learning_paths')
            .find(filter)
            .sort({ updatedAt: -1, _id: -1 })
            .limit(limit)
            .toArray();

        return { items: rows.map(toDoc) };
    } catch (e) {
        console.error('[getLearningPaths] failed:', e);
        return empty;
    }
}

export async function getLearningPathById(
    id: string,
): Promise<CrmLearningPathDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_learning_path', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmLearningPathsApi.getById(id);
            return toDoc(doc as unknown as WithId<Document>);
        } catch (e) {
            console.error(
                '[getLearningPathById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'learning_path',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const row = await db.collection('crm_learning_paths').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        return row ? toDoc(row) : null;
    } catch (e) {
        console.error('[getLearningPathById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveLearningPath(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const learningPathId = asString(formData.get('learningPathId'));
    const isEditing = !!learningPathId;

    const guard = await requirePermission(
        'crm_learning_path',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Learning path name is required.' };

    const status = normaliseStatus(asString(formData.get('status')));
    const targetAudience = normaliseAudience(
        asString(formData.get('targetAudience')),
    );

    const payload = {
        name,
        description: asString(formData.get('description')) ?? null,
        target_audience: targetAudience,
        trainings: asTrainingIds(formData),
        duration_weeks: asInt(formData.get('durationWeeks')) ?? null,
        is_mandatory: asBool(formData.get('isMandatory')),
        status,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);

        if (isEditing) {
            if (!ObjectId.isValid(learningPathId!)) {
                return { error: 'Invalid learning path id.' };
            }
            const filter = { _id: new ObjectId(learningPathId), userId };
            const before = await db
                .collection('crm_learning_paths')
                .findOne(filter);
            if (!before) return { error: 'Learning path not found.' };

            await db
                .collection('crm_learning_paths')
                .updateOne(filter, { $set: payload });

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'learning_path',
                entityId: learningPathId!,
            });

            revalidatePath('/dashboard/hrm/hr/learning-paths');
            revalidatePath(
                `/dashboard/hrm/hr/learning-paths/${learningPathId}`,
            );
            return { message: 'Learning path updated.', id: learningPathId };
        }

        const insertDoc = {
            ...payload,
            userId,
            createdAt: new Date(),
        };
        const result = await db
            .collection('crm_learning_paths')
            .insertOne(insertDoc);

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'learning_path',
            entityId: result.insertedId.toString(),
        });

        revalidatePath('/dashboard/hrm/hr/learning-paths');
        return {
            message: 'Learning path created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveLearningPath] failed:', msg);
        return { error: `Failed to save learning path: ${msg}` };
    }
}

export async function deleteLearningPath(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid learning path id.' };
    }

    const guard = await requirePermission('crm_learning_path', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const filter = {
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        };

        const result = await db
            .collection('crm_learning_paths')
            .updateOne(filter, {
                $set: {
                    status: 'archived' as CrmLearningPathStatus,
                    updatedAt: new Date(),
                },
            });

        if (result.matchedCount === 0) {
            return { success: false, error: 'Learning path not found.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'archive',
            entityKind: 'learning_path',
            entityId: id,
        });

        revalidatePath('/dashboard/hrm/hr/learning-paths');
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteLearningPath] failed:', msg);
        return {
            success: false,
            error: `Failed to delete learning path: ${msg}`,
        };
    }
}

/* ─── Bulk ────────────────────────────────────────────────────────────── */

export async function bulkArchiveLearningPaths(
    ids: string[],
): Promise<{ succeeded: number; failed: number }> {
    const session = await getSession();
    if (!session?.user) return { succeeded: 0, failed: ids.length };

    const guard = await requirePermission('crm_learning_path', 'edit');
    if (!guard.ok) return { succeeded: 0, failed: ids.length };

    let succeeded = 0;
    let failed = 0;

    let db: Awaited<ReturnType<typeof connectToDatabase>>['db'] | null = null;
    try {
        db = (await connectToDatabase()).db;
    } catch {
        return { succeeded: 0, failed: ids.length };
    }

    for (const id of ids) {
        if (!ObjectId.isValid(id)) { failed++; continue; }
        try {
            const res = await db.collection('crm_learning_paths').updateOne(
                { _id: new ObjectId(id), userId: new ObjectId(session.user._id as string) },
                { $set: { status: 'archived' as CrmLearningPathStatus, updatedAt: new Date() } },
            );
            if (res.matchedCount > 0) succeeded++;
            else failed++;
        } catch {
            failed++;
        }
    }

    if (succeeded > 0) revalidatePath('/dashboard/crm/hr/learning-paths');
    return { succeeded, failed };
}

export async function bulkDeleteLearningPaths(
    ids: string[],
): Promise<{ succeeded: number; failed: number }> {
    // Re-uses archive pattern (soft-delete = status: archived)
    return bulkArchiveLearningPaths(ids);
}
