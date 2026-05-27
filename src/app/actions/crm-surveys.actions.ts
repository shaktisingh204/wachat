'use server';

/**
 * CRM HR Surveys — server actions with dual implementation.
 *
 * When `USE_RUST_CRM === 'true'` reads/writes route through the Rust BFF
 * `/v1/crm/surveys`; otherwise the legacy direct-Mongo path runs. Failures
 * record via `recordRustFallback` and fall through to the legacy path.
 *
 * Field shape:
 *   - title          (required)
 *   - description    (textarea)
 *   - type           ('engagement'|'exit'|'onboarding'|'pulse'|'custom')
 *   - questions      (array of `{ label, type, required, options }`)
 *   - targetAudience ('all'|'department'|'team'|'role')
 *   - anonymous      (boolean)
 *   - startsAt / endsAt
 *   - responseCount  (integer, server-managed)
 *   - status         ('draft'|'active'|'closed'|'archived')
 *
 * Questions are POSTed back as a JSON string in a hidden `questions` field
 * (the form builds them with a structured QuestionRepeater client widget).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, type Filter } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmSurveysApi } from '@/lib/rust-client/crm-surveys';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ──────────────────────────────────────────────────────────── */

type CrmSurveyType =
    | 'engagement'
    | 'exit'
    | 'onboarding'
    | 'pulse'
    | 'custom';

type CrmSurveyStatus = 'draft' | 'active' | 'closed' | 'archived';

type CrmSurveyAudience = 'all' | 'department' | 'team' | 'role';

type CrmSurveyQuestionType =
    | 'short_text'
    | 'long_text'
    | 'single_choice'
    | 'multiple_choice'
    | 'rating'
    | 'boolean';

interface CrmSurveyQuestion {
    label: string;
    type: CrmSurveyQuestionType;
    required?: boolean;
    options?: string[];
}

interface CrmSurveyDoc {
    _id: string;
    userId?: string;
    title?: string;
    description?: string;
    type?: CrmSurveyType;
    questions?: CrmSurveyQuestion[];
    targetAudience?: CrmSurveyAudience;
    audienceIds?: string[];
    anonymous?: boolean;
    startsAt?: string;
    endsAt?: string;
    responseCount?: number;
    status?: CrmSurveyStatus;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmSurveyListFilters {
    q?: string;
    status?: CrmSurveyStatus;
    type?: CrmSurveyType;
    limit?: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const COLLECTION = 'crm_surveys';

const VALID_TYPES: ReadonlySet<CrmSurveyType> = new Set([
    'engagement',
    'exit',
    'onboarding',
    'pulse',
    'custom',
]);

const VALID_STATUSES: ReadonlySet<CrmSurveyStatus> = new Set([
    'draft',
    'active',
    'closed',
    'archived',
]);

const VALID_AUDIENCES: ReadonlySet<CrmSurveyAudience> = new Set([
    'all',
    'department',
    'team',
    'role',
]);

const VALID_QUESTION_TYPES: ReadonlySet<CrmSurveyQuestionType> = new Set([
    'short_text',
    'long_text',
    'single_choice',
    'multiple_choice',
    'rating',
    'boolean',
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

function asList(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const out = s
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    return out.length > 0 ? out : undefined;
}

/** Parse the structured `questions` payload posted by the form. The form
 *  sends a single hidden `questions` field whose value is the JSON
 *  representation of `Array<{ label, type, required, options }>`. */
function parseQuestions(v: FormDataEntryValue | null): CrmSurveyQuestion[] {
    const raw = asString(v);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((q: unknown): CrmSurveyQuestion | null => {
                if (!q || typeof q !== 'object') return null;
                const obj = q as Record<string, unknown>;
                const label = String(obj.label ?? '').trim();
                const typeRaw = String(obj.type ?? '');
                if (!label) return null;
                if (!VALID_QUESTION_TYPES.has(typeRaw as CrmSurveyQuestionType))
                    return null;
                const opts = Array.isArray(obj.options)
                    ? (obj.options as unknown[])
                          .map((o) => String(o).trim())
                          .filter((o) => o.length > 0)
                    : undefined;
                return {
                    label,
                    type: typeRaw as CrmSurveyQuestionType,
                    required: !!obj.required,
                    ...(opts && opts.length > 0 ? { options: opts } : {}),
                };
            })
            .filter((q): q is CrmSurveyQuestion => !!q);
    } catch {
        return [];
    }
}

function serialize<T extends Record<string, unknown>>(
    doc: WithId<T> | null,
): CrmSurveyDoc | null {
    if (!doc) return null;
    return JSON.parse(JSON.stringify({ ...doc, _id: String(doc._id) }));
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getSurveys(
    filters?: CrmSurveyListFilters,
): Promise<{ items: CrmSurveyDoc[] }> {
    const session = await getSession();
    if (!session?.user) return { items: [] };

    const guard = await requirePermission('crm_survey', 'view');
    if (!guard.ok) return { items: [] };

    if (useRustCrm()) {
        try {
            const res = await crmSurveysApi.list({
                q: filters?.q,
                status: filters?.status,
                type: filters?.type,
                limit: filters?.limit,
            });
            return {
                items: JSON.parse(JSON.stringify(res.items ?? [])),
            };
        } catch (e) {
            console.error(
                '[getSurveys] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'survey',
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
        if (filters?.type && VALID_TYPES.has(filters.type)) {
            query.type = filters.type;
        }
        const q = filters?.q?.trim();
        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query.$or = [{ title: rx }, { description: rx }];
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
                .filter((x): x is CrmSurveyDoc => !!x),
        };
    } catch (e) {
        console.error('[getSurveys] failed:', e);
        return { items: [] };
    }
}

export async function getSurveyById(
    id: string,
): Promise<CrmSurveyDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_survey', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmSurveysApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error(
                '[getSurveyById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'survey',
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
        console.error('[getSurveyById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

interface SavePayload {
    title?: string;
    description?: string;
    type?: CrmSurveyType;
    questions: CrmSurveyQuestion[];
    targetAudience?: CrmSurveyAudience;
    audienceIds?: string[];
    anonymous?: boolean;
    startsAt?: Date;
    endsAt?: Date;
    status?: CrmSurveyStatus;
}

function toDate(v: FormDataEntryValue | null): Date | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function readPayload(formData: FormData): {
    payload: SavePayload;
    error?: string;
} {
    const title = asString(formData.get('title'));
    if (!title)
        return {
            payload: { questions: [] },
            error: 'Title is required.',
        };

    const typeRaw = asString(formData.get('type'));
    const type: CrmSurveyType | undefined =
        typeRaw && VALID_TYPES.has(typeRaw as CrmSurveyType)
            ? (typeRaw as CrmSurveyType)
            : undefined;

    const statusRaw = asString(formData.get('status'));
    const status: CrmSurveyStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmSurveyStatus)
            ? (statusRaw as CrmSurveyStatus)
            : undefined;

    const audienceRaw = asString(formData.get('targetAudience'));
    const targetAudience: CrmSurveyAudience | undefined =
        audienceRaw && VALID_AUDIENCES.has(audienceRaw as CrmSurveyAudience)
            ? (audienceRaw as CrmSurveyAudience)
            : undefined;

    return {
        payload: {
            title,
            description: asString(formData.get('description')),
            ...(type ? { type } : {}),
            questions: parseQuestions(formData.get('questions')),
            ...(targetAudience ? { targetAudience } : {}),
            audienceIds: asList(formData.get('audienceIds')),
            anonymous: asBool(formData.get('anonymous')),
            startsAt: toDate(formData.get('startsAt')),
            endsAt: toDate(formData.get('endsAt')),
            ...(status ? { status } : {}),
        },
    };
}

export async function saveSurvey(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const surveyId = asString(formData.get('surveyId'));
    const isEditing = !!surveyId;

    const guard = await requirePermission(
        'crm_survey',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    if (useRustCrm()) {
        try {
            const startsAtIso = payload.startsAt
                ? payload.startsAt.toISOString()
                : undefined;
            const endsAtIso = payload.endsAt
                ? payload.endsAt.toISOString()
                : undefined;

            if (isEditing) {
                if (!ObjectId.isValid(surveyId!))
                    return { error: 'Invalid survey id.' };
                await crmSurveysApi.update(surveyId!, {
                    title: payload.title,
                    description: payload.description,
                    type: payload.type,
                    questions: payload.questions,
                    targetAudience: payload.targetAudience,
                    audienceIds: payload.audienceIds,
                    anonymous: payload.anonymous,
                    ...(startsAtIso ? { startsAt: startsAtIso } : {}),
                    ...(endsAtIso ? { endsAt: endsAtIso } : {}),
                    status: payload.status,
                });
                revalidatePath('/dashboard/hrm/hr/surveys');
                revalidatePath(`/dashboard/hrm/hr/surveys/${surveyId}`);
                return { message: 'Survey updated.', id: surveyId };
            }

            const created = await crmSurveysApi.create({
                title: payload.title!,
                description: payload.description,
                type: payload.type,
                questions: payload.questions,
                targetAudience: payload.targetAudience,
                audienceIds: payload.audienceIds,
                anonymous: payload.anonymous,
                ...(startsAtIso ? { startsAt: startsAtIso } : {}),
                ...(endsAtIso ? { endsAt: endsAtIso } : {}),
                status: payload.status ?? 'draft',
            });
            const newId = String(created.id ?? created.entity?._id ?? '');
            revalidatePath('/dashboard/hrm/hr/surveys');
            return { message: 'Survey created.', id: newId };
        } catch (e) {
            console.error('[saveSurvey] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'survey',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through to legacy Mongo path
        }
    }

    try {
        const { db } = await connectToDatabase();

        if (isEditing) {
            if (!ObjectId.isValid(surveyId!))
                return { error: 'Invalid survey id.' };

            const setDoc: Record<string, unknown> = {
                ...payload,
                updatedAt: new Date(),
            };
            await db.collection(COLLECTION).updateOne(
                {
                    _id: new ObjectId(surveyId!),
                    userId: new ObjectId(session.user._id),
                },
                { $set: setDoc },
            );
            revalidatePath('/dashboard/hrm/hr/surveys');
            revalidatePath(`/dashboard/hrm/hr/surveys/${surveyId}`);
            return { message: 'Survey updated.', id: surveyId };
        }

        const now = new Date();
        const insertDoc = {
            userId: new ObjectId(session.user._id),
            ...payload,
            status: payload.status ?? 'draft',
            responseCount: 0,
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLLECTION).insertOne(insertDoc);
        revalidatePath('/dashboard/hrm/hr/surveys');
        return {
            message: 'Survey created.',
            id: res.insertedId.toString(),
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveSurvey] failed:', msg);
        return { error: `Failed to save survey: ${msg}` };
    }
}

export async function deleteSurvey(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id))
        return { success: false, error: 'Survey id is required.' };

    const guard = await requirePermission('crm_survey', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            const res = await crmSurveysApi.delete(id);
            revalidatePath('/dashboard/hrm/hr/surveys');
            return { success: !!res?.deleted };
        } catch (e) {
            console.error('[deleteSurvey] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'survey',
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
            userId: new ObjectId(session.user._id),
        });
        revalidatePath('/dashboard/hrm/hr/surveys');
        return { success: res.deletedCount > 0 };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteSurvey] failed:', msg);
        return { success: false, error: `Failed to delete survey: ${msg}` };
    }
}
