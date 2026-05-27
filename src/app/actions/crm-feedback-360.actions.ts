'use server';

/**
 * CRM HR Feedback 360 — server actions with dual implementation.
 *
 * When `USE_RUST_CRM === 'true'` reads/writes route through the Rust BFF
 * `/v1/crm/feedback-360`; otherwise the legacy direct-Mongo path runs.
 * Failures record via `recordRustFallback` and fall through to the legacy
 * path.
 *
 * Documents are tenant-scoped (`userId`) and follow the camelCase DTO
 * shape used by the other performance modules:
 *
 *   employeeId, employeeName, period, reviewerIds, reviewerResponses,
 *   aggregatedScores, overallRating, status, completedAt
 *
 * `reviewerResponses` is a structured Vec — each entry carries:
 *   { reviewerId, role, scores, comments, submittedAt }
 *
 * `aggregatedScores` / `overallRating` are computed server-side from the
 * reviewer responses (on the legacy path) before persisting.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { connectToDatabase } from '@/lib/mongodb';
import { serialize } from '@/lib/hr-crud';
import { crmFeedback360Api } from '@/lib/rust-client/crm-feedback-360';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ──────────────────────────────────────────────────────────── */

type Feedback360Status =
    | 'draft'
    | 'in_progress'
    | 'completed'
    | 'archived';

type Feedback360ReviewerRole =
    | 'self'
    | 'manager'
    | 'peer'
    | 'direct_report'
    | 'other';

interface Feedback360ReviewerResponse {
    reviewerId: string;
    role: Feedback360ReviewerRole;
    scores?: Record<string, number>;
    comments?: string;
    submittedAt?: string;
}

interface Feedback360Doc {
    _id: string;
    userId?: string;
    employeeId: string;
    employeeName?: string;
    period?: string;
    reviewerIds: string[];
    reviewerResponses?: Feedback360ReviewerResponse[];
    aggregatedScores?: Record<string, number>;
    overallRating?: number;
    status: Feedback360Status;
    completedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface Feedback360ListParams {
    q?: string;
    status?: Feedback360Status | 'all';
    employeeId?: string;
    period?: string;
    limit?: number;
}

interface Feedback360ListResponse {
    items: Feedback360Doc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

interface Feedback360CreateInput {
    employeeId: string;
    employeeName?: string;
    period?: string;
    reviewerIds: string[];
    reviewerResponses?: Feedback360ReviewerResponse[];
    aggregatedScores?: Record<string, number>;
    overallRating?: number;
    status?: Feedback360Status;
    completedAt?: string;
}

type Feedback360UpdateInput = Partial<Feedback360CreateInput>;

/* ─── Helpers ────────────────────────────────────────────────────────── */

const COLLECTION = 'crm_feedback_360';

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asStringArray(v: FormDataEntryValue | null): string[] {
    const s = asString(v);
    if (!s) return [];
    // Accept JSON array or comma-separated list.
    try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
            return parsed
                .map((x) => (typeof x === 'string' ? x.trim() : ''))
                .filter((x) => x.length > 0);
        }
    } catch {
        /* fall through to comma split */
    }
    return s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
}

const VALID_STATUSES: ReadonlySet<Feedback360Status> =
    new Set<Feedback360Status>([
        'draft',
        'in_progress',
        'completed',
        'archived',
    ]);

const VALID_ROLES: ReadonlySet<Feedback360ReviewerRole> =
    new Set<Feedback360ReviewerRole>([
        'self',
        'manager',
        'peer',
        'direct_report',
        'other',
    ]);

function parseReviewerResponses(
    raw: FormDataEntryValue | null,
): Feedback360ReviewerResponse[] {
    const s = asString(raw);
    if (!s) return [];
    try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) return [];
        const out: Feedback360ReviewerResponse[] = [];
        for (const item of parsed) {
            if (!item || typeof item !== 'object') continue;
            const o = item as Record<string, unknown>;
            const reviewerId =
                typeof o.reviewerId === 'string' ? o.reviewerId.trim() : '';
            if (!reviewerId) continue;
            const roleRaw =
                typeof o.role === 'string' ? o.role.trim() : 'peer';
            const role = (VALID_ROLES.has(roleRaw as Feedback360ReviewerRole)
                ? roleRaw
                : 'peer') as Feedback360ReviewerRole;
            const entry: Feedback360ReviewerResponse = {
                reviewerId,
                role,
            };
            if (o.scores && typeof o.scores === 'object') {
                const scores: Record<string, number> = {};
                for (const [k, v] of Object.entries(
                    o.scores as Record<string, unknown>,
                )) {
                    const n = typeof v === 'number' ? v : Number(v);
                    if (Number.isFinite(n)) scores[k] = n;
                }
                if (Object.keys(scores).length > 0) entry.scores = scores;
            }
            if (typeof o.comments === 'string' && o.comments.trim()) {
                entry.comments = o.comments.trim();
            }
            if (typeof o.submittedAt === 'string' && o.submittedAt.trim()) {
                entry.submittedAt = o.submittedAt.trim();
            }
            out.push(entry);
        }
        return out;
    } catch {
        return [];
    }
}

function aggregate(
    responses: Feedback360ReviewerResponse[],
): { aggregatedScores: Record<string, number>; overallRating?: number } {
    const sums = new Map<string, { total: number; n: number }>();
    for (const r of responses) {
        if (!r.scores) continue;
        for (const [k, v] of Object.entries(r.scores)) {
            const slot = sums.get(k) ?? { total: 0, n: 0 };
            slot.total += v;
            slot.n += 1;
            sums.set(k, slot);
        }
    }
    const aggregatedScores: Record<string, number> = {};
    for (const [k, { total, n }] of sums.entries()) {
        if (n > 0) {
            aggregatedScores[k] = Math.round((total / n) * 100) / 100;
        }
    }
    const vals = Object.values(aggregatedScores);
    const overallRating =
        vals.length > 0
            ? Math.round(
                  (vals.reduce((a, b) => a + b, 0) / vals.length) * 100,
              ) / 100
            : undefined;
    return { aggregatedScores, overallRating };
}

async function requireUserId(): Promise<string | null> {
    const session = await getSession();
    if (!session?.user) return null;
    return String(session.user._id);
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getFeedback360s(
    filters?: Feedback360ListParams,
): Promise<Feedback360ListResponse> {
    const limit = Math.max(1, Math.min(500, filters?.limit ?? 100));
    const empty: Feedback360ListResponse = {
        items: [],
        page: 1,
        limit,
        hasMore: false,
    };

    const userId = await requireUserId();
    if (!userId) return empty;

    const guard = await requirePermission('crm_feedback_360', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmFeedback360Api.list({
                q: filters?.q,
                status: filters?.status,
                employeeId: filters?.employeeId,
                period: filters?.period,
                limit,
            });
            return {
                items: JSON.parse(
                    JSON.stringify(res.items ?? []),
                ) as Feedback360Doc[],
                page: res.page ?? 1,
                limit: res.limit ?? limit,
                hasMore: !!res.hasMore,
            };
        } catch (e) {
            console.error(
                '[getFeedback360s] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'feedback_360',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const mongoFilter: Record<string, unknown> = {
            userId: new ObjectId(userId),
        };
        if (filters?.status && filters.status !== 'all') {
            mongoFilter.status = filters.status;
        }
        if (filters?.employeeId) {
            mongoFilter.employeeId = filters.employeeId;
        }
        if (filters?.period) {
            mongoFilter.period = filters.period;
        }
        if (filters?.q && filters.q.trim()) {
            const rx = new RegExp(
                filters.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            mongoFilter.$or = [
                { employeeName: rx },
                { employeeId: rx },
                { period: rx },
            ];
        }
        const docs = await db
            .collection(COLLECTION)
            .find(mongoFilter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
        return {
            items: serialize(docs) as unknown as Feedback360Doc[],
            page: 1,
            limit,
            hasMore: docs.length === limit,
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[getFeedback360s] mongo call failed:', msg);
        recordRustFallback({
            entity: 'feedback_360',
            op: 'list',
        });
        return empty;
    }
}

export async function getFeedback360ById(
    id: string,
): Promise<Feedback360Doc | null> {
    const userId = await requireUserId();
    if (!userId) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_feedback_360', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmFeedback360Api.getById(id);
            return JSON.parse(JSON.stringify(doc)) as Feedback360Doc;
        } catch (e) {
            console.error(
                '[getFeedback360ById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'feedback_360',
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
            userId: new ObjectId(userId),
        });
        return doc ? (serialize(doc) as unknown as Feedback360Doc) : null;
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[getFeedback360ById] mongo call failed:', msg);
        recordRustFallback({
            entity: 'feedback_360',
            op: 'get',
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: Omit<Feedback360CreateInput, 'status'>;
    status?: Feedback360Status;
    error?: string;
} {
    const employeeId = asString(formData.get('employeeId'));
    if (!employeeId) {
        return {
            payload: {
                employeeId: '',
                reviewerIds: [],
            },
            error: 'Employee id is required.',
        };
    }
    const reviewerIds = asStringArray(formData.get('reviewerIds'));
    const reviewerResponses = parseReviewerResponses(
        formData.get('reviewerResponses'),
    );
    const { aggregatedScores, overallRating } = aggregate(reviewerResponses);

    const statusRaw = asString(formData.get('status'));
    const status: Feedback360Status | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as Feedback360Status)
            ? (statusRaw as Feedback360Status)
            : undefined;

    const overallOverride = asNumber(formData.get('overallRating'));

    const payload: Omit<Feedback360CreateInput, 'status'> = {
        employeeId,
        employeeName: asString(formData.get('employeeName')),
        period: asString(formData.get('period')),
        reviewerIds,
        reviewerResponses,
        aggregatedScores:
            Object.keys(aggregatedScores).length > 0
                ? aggregatedScores
                : undefined,
        overallRating:
            overallOverride != null ? overallOverride : overallRating,
        completedAt: asString(formData.get('completedAt')),
    };

    return { payload, status };
}

export async function saveFeedback360(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const userId = await requireUserId();
    if (!userId) return { error: 'Access denied.' };

    const reviewId = asString(formData.get('reviewId'));
    const isEditing = !!reviewId;

    const guard = await requirePermission(
        'crm_feedback_360',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, status, error } = readPayload(formData);
    if (error) return { error };

    if (useRustCrm()) {
        try {
            const completedAtIso = payload.completedAt;
            if (isEditing && ObjectId.isValid(reviewId!)) {
                await crmFeedback360Api.update(reviewId!, {
                    employeeId: payload.employeeId,
                    employeeName: payload.employeeName,
                    period: payload.period,
                    reviewerIds: payload.reviewerIds,
                    reviewerResponses: payload.reviewerResponses,
                    overallRating: payload.overallRating,
                    ...(status ? { status } : {}),
                    ...(completedAtIso ? { completedAt: completedAtIso } : {}),
                });
                revalidatePath('/dashboard/hrm/hr/feedback-360');
                revalidatePath(`/dashboard/hrm/hr/feedback-360/${reviewId}`);
                return { message: '360° feedback updated.', id: reviewId };
            }

            const created = await crmFeedback360Api.create({
                employeeId: payload.employeeId,
                employeeName: payload.employeeName,
                period: payload.period,
                reviewerIds: payload.reviewerIds,
                reviewerResponses: payload.reviewerResponses,
                overallRating: payload.overallRating,
                status: status ?? 'draft',
                ...(completedAtIso ? { completedAt: completedAtIso } : {}),
            });
            const newId = String(created.id ?? created.entity?._id ?? '');
            revalidatePath('/dashboard/hrm/hr/feedback-360');
            return { message: '360° feedback created.', id: newId };
        } catch (e) {
            console.error(
                '[saveFeedback360] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'feedback_360',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through to legacy Mongo path
        }
    }

    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const baseDoc: Record<string, unknown> = {
            ...payload,
            ...(status ? { status } : {}),
            updatedAt: now,
        };
        // Coerce ISO date strings to Date so Mongo stores native datetimes.
        if (typeof baseDoc.completedAt === 'string') {
            const d = new Date(baseDoc.completedAt as string);
            if (!Number.isNaN(d.getTime())) baseDoc.completedAt = d;
        }

        if (isEditing && ObjectId.isValid(reviewId!)) {
            await db.collection(COLLECTION).updateOne(
                {
                    _id: new ObjectId(reviewId!),
                    userId: new ObjectId(userId),
                },
                { $set: baseDoc },
            );
            revalidatePath('/dashboard/hrm/hr/feedback-360');
            revalidatePath(`/dashboard/hrm/hr/feedback-360/${reviewId}`);
            return {
                message: '360° feedback updated.',
                id: reviewId,
            };
        }

        const insertDoc: Record<string, unknown> = {
            ...baseDoc,
            userId: new ObjectId(userId),
            status: status ?? 'draft',
            createdAt: now,
        };
        const res = await db.collection(COLLECTION).insertOne(insertDoc);
        revalidatePath('/dashboard/hrm/hr/feedback-360');
        return {
            message: '360° feedback created.',
            id: res.insertedId.toString(),
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveFeedback360] mongo call failed:', msg);
        recordRustFallback({
            entity: 'feedback_360',
            op: isEditing ? 'update' : 'create',
        });
        return { error: `Failed to save 360° feedback: ${msg}` };
    }
}

export async function deleteFeedback360(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const userId = await requireUserId();
    if (!userId) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Review id is required.' };
    }

    const guard = await requirePermission('crm_feedback_360', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            const res = await crmFeedback360Api.delete(id);
            revalidatePath('/dashboard/hrm/hr/feedback-360');
            return { success: !!res?.deleted };
        } catch (e) {
            console.error(
                '[deleteFeedback360] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'feedback_360',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(userId),
        });
        revalidatePath('/dashboard/hrm/hr/feedback-360');
        return { success: res.deletedCount > 0 };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteFeedback360] mongo call failed:', msg);
        recordRustFallback({
            entity: 'feedback_360',
            op: 'delete',
        });
        return { success: false, error: `Failed to delete review: ${msg}` };
    }
}
