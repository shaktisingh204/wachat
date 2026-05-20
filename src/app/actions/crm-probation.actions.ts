'use server';

/**
 * CRM HR Probation — server-action wrappers.
 *
 * NO Rust crate exists for this entity (per Employee Transitions plan):
 * every code-path reads/writes the `crm_probations` Mongo collection
 * directly, tenant-scoped via `userId == session.user._id`.
 *
 * Schema (per Employee Transitions §2):
 *   - employeeId, employeeName
 *   - startDate, endDate (Date)
 *   - evaluatorId, evaluatorName
 *   - criteria: Array<{ name, target?, achieved?, score? }>
 *   - overallScore?: number
 *   - recommendation?: 'confirm' | 'extend' | 'terminate'
 *   - notes?: string
 *   - status: 'in_progress' | 'confirmed' | 'extended' | 'terminated' | 'archived'
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmProbationsApi } from '@/lib/rust-client/crm-probation';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ──────────────────────────────────────────────────────────── */

export type ProbationStatus =
    | 'in_progress'
    | 'confirmed'
    | 'extended'
    | 'terminated'
    | 'archived';

export type ProbationRecommendation = 'confirm' | 'extend' | 'terminate';

export interface ProbationCriterion {
    name: string;
    target?: string;
    achieved?: string;
    score?: number;
}

export interface CrmProbationDoc {
    _id?: ObjectId;
    userId: ObjectId;
    employeeId?: string;
    employeeName?: string;
    startDate?: Date;
    endDate?: Date;
    evaluatorId?: string;
    evaluatorName?: string;
    criteria: ProbationCriterion[];
    overallScore?: number;
    recommendation?: ProbationRecommendation;
    notes?: string;
    status: ProbationStatus;
    createdAt: Date;
    updatedAt: Date;
}

const VALID_STATUSES: ReadonlySet<ProbationStatus> = new Set<ProbationStatus>([
    'in_progress',
    'confirmed',
    'extended',
    'terminated',
    'archived',
]);

const VALID_RECOMMENDATIONS: ReadonlySet<ProbationRecommendation> =
    new Set<ProbationRecommendation>(['confirm', 'extend', 'terminate']);

/* ─── Helpers ────────────────────────────────────────────────────────── */

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

function parseCriteriaJson(raw: string | null | undefined): ProbationCriterion[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((c) => {
                if (!c || typeof c !== 'object') return null;
                const rec = c as Record<string, unknown>;
                const name = typeof rec.name === 'string' ? rec.name.trim() : '';
                if (!name) return null;
                const score =
                    typeof rec.score === 'number' && Number.isFinite(rec.score)
                        ? rec.score
                        : typeof rec.score === 'string' && rec.score.trim() !== ''
                            ? Number(rec.score)
                            : undefined;
                return {
                    name,
                    target: typeof rec.target === 'string' ? rec.target : undefined,
                    achieved: typeof rec.achieved === 'string' ? rec.achieved : undefined,
                    score: Number.isFinite(score as number) ? (score as number) : undefined,
                } as ProbationCriterion;
            })
            .filter((x): x is ProbationCriterion => !!x);
    } catch {
        return [];
    }
}

function revalidateSurfaces(id?: string): void {
    revalidatePath('/dashboard/hrm/hr/probation');
    revalidatePath('/dashboard/crm/hr/probation');
    if (id) {
        revalidatePath(`/dashboard/hrm/hr/probation/${id}`);
        revalidatePath(`/dashboard/crm/hr/probation/${id}`);
    }
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export interface ProbationListFilters {
    q?: string;
    status?: ProbationStatus | 'all';
}

export async function getCrmProbations(
    filters?: ProbationListFilters,
): Promise<WithId<CrmProbationDoc>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_probation', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmProbationsApi.list({
                q: filters?.q,
                status: filters?.status,
            });
            return JSON.parse(JSON.stringify(res.items ?? [])) as WithId<CrmProbationDoc>[];
        } catch (e) {
            console.error('[getCrmProbations] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'probation',
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
        } else {
            // Default list view hides archived rows.
            filter.status = { $ne: 'archived' };
        }
        if (filters?.q) {
            const q = filters.q.trim();
            if (q) {
                const re = new RegExp(
                    q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                    'i',
                );
                filter.$or = [
                    { employeeName: re },
                    { employeeId: re },
                    { evaluatorName: re },
                ];
            }
        }

        const docs = await db
            .collection<CrmProbationDoc>('crm_probations')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();
        return JSON.parse(JSON.stringify(docs)) as WithId<CrmProbationDoc>[];
    } catch (e) {
        console.error('[getCrmProbations]', e);
        return [];
    }
}

export async function getCrmProbationById(
    id: string,
): Promise<WithId<CrmProbationDoc> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_probation', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmProbationsApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as WithId<CrmProbationDoc>;
        } catch (e) {
            console.error('[getCrmProbationById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'probation',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection<CrmProbationDoc>('crm_probations')
            .findOne({
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            });
        return doc
            ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmProbationDoc>)
            : null;
    } catch (e) {
        console.error('[getCrmProbationById]', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

interface PayloadResult {
    payload: Partial<CrmProbationDoc>;
    error?: string;
}

function readPayload(formData: FormData): PayloadResult {
    const employeeName = asString(formData.get('employeeName'));
    const employeeId = asString(formData.get('employeeId'));
    if (!employeeName && !employeeId) {
        return { payload: {}, error: 'Employee name or ID is required.' };
    }

    const statusRaw = asString(formData.get('status'));
    const status: ProbationStatus = VALID_STATUSES.has(
        statusRaw as ProbationStatus,
    )
        ? (statusRaw as ProbationStatus)
        : 'in_progress';

    const recommendationRaw = asString(formData.get('recommendation'));
    const recommendation = VALID_RECOMMENDATIONS.has(
        recommendationRaw as ProbationRecommendation,
    )
        ? (recommendationRaw as ProbationRecommendation)
        : undefined;

    const startRaw = asString(formData.get('startDate'));
    const endRaw = asString(formData.get('endDate'));

    const criteria = parseCriteriaJson(
        (formData.get('criteria') as string | null) ?? '[]',
    );

    const payload: Partial<CrmProbationDoc> = {
        employeeName,
        employeeId,
        evaluatorId: asString(formData.get('evaluatorId')),
        evaluatorName: asString(formData.get('evaluatorName')),
        notes: asString(formData.get('notes')),
        overallScore: asNumber(formData.get('overallScore')),
        recommendation,
        criteria,
        status,
        updatedAt: new Date(),
    };
    if (startRaw) payload.startDate = new Date(startRaw);
    if (endRaw) payload.endDate = new Date(endRaw);

    return { payload };
}

export async function saveCrmProbation(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const idRaw = asString(formData.get('probationId'));
    const isEditing = !!idRaw && ObjectId.isValid(idRaw);

    const guard = await requirePermission(
        'crm_probation',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);

        if (isEditing) {
            const res = await db
                .collection<CrmProbationDoc>('crm_probations')
                .updateOne(
                    { _id: new ObjectId(idRaw!), userId },
                    { $set: payload },
                );
            if (res.matchedCount === 0) {
                return { error: 'Probation record not found or access denied.' };
            }
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'probation',
                entityId: idRaw!,
            });
            revalidateSurfaces(idRaw!);
            return { message: 'Probation updated.', id: idRaw };
        }

        const doc: CrmProbationDoc = {
            userId,
            criteria: payload.criteria ?? [],
            status: payload.status ?? 'in_progress',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...payload,
        };

        const result = await db
            .collection<CrmProbationDoc>('crm_probations')
            .insertOne(doc);

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'probation',
            entityId: String(result.insertedId),
        });

        revalidateSurfaces();
        return {
            message: 'Probation created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveCrmProbation]', e);
        return { error: `Failed to save probation: ${msg}` };
    }
}

export async function deleteCrmProbation(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid id.' };
    }

    const guard = await requirePermission('crm_probation', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('crm_probations').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (res.matchedCount === 0) {
            return { success: false, error: 'Not found.' };
        }
        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'archive',
            entityKind: 'probation',
            entityId: id,
        });
        revalidateSurfaces(id);
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, error: msg };
    }
}

/* ─── Bulk + KPIs ────────────────────────────────────────────────────── */

export interface CrmProbationKpis {
    total: number;
    inProgress: number;
    endingThisMonth: number;
    extended: number;
    confirmed: number;
    terminated: number;
}

export async function getCrmProbationKpis(): Promise<CrmProbationKpis> {
    const empty: CrmProbationKpis = {
        total: 0,
        inProgress: 0,
        endingThisMonth: 0,
        extended: 0,
        confirmed: 0,
        terminated: 0,
    };
    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_probation', 'view');
    if (!guard.ok) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const [total, inProgress, endingThisMonth, extended, confirmed, terminated] =
            await Promise.all([
                db.collection('crm_probations').countDocuments({
                    userId,
                    status: { $ne: 'archived' },
                }),
                db.collection('crm_probations').countDocuments({
                    userId,
                    status: 'in_progress',
                }),
                db.collection('crm_probations').countDocuments({
                    userId,
                    status: 'in_progress',
                    endDate: { $gte: monthStart, $lt: monthEnd },
                }),
                db.collection('crm_probations').countDocuments({
                    userId,
                    status: 'extended',
                }),
                db.collection('crm_probations').countDocuments({
                    userId,
                    status: 'confirmed',
                }),
                db.collection('crm_probations').countDocuments({
                    userId,
                    status: 'terminated',
                }),
            ]);

        return {
            total,
            inProgress,
            endingThisMonth,
            extended,
            confirmed,
            terminated,
        };
    } catch (e) {
        console.error('[getCrmProbationKpis]', e);
        return empty;
    }
}

async function bulkSetProbationStatus(
    ids: string[],
    status: ProbationStatus,
): Promise<{ success: boolean; updated: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, updated: 0, error: 'Access denied.' };
    }
    const guard = await requirePermission('crm_probation', 'update');
    if (!guard.ok) {
        return { success: false, updated: 0, error: guard.error };
    }
    const oids = ids
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
    if (oids.length === 0) return { success: true, updated: 0 };
    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('crm_probations').updateMany(
            {
                _id: { $in: oids },
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status, updatedAt: new Date() } },
        );
        revalidateSurfaces();
        return { success: true, updated: res.modifiedCount };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, updated: 0, error: msg };
    }
}

export async function bulkConfirmProbations(ids: string[]) {
    return bulkSetProbationStatus(ids, 'confirmed');
}

export async function bulkExtendProbations(ids: string[]) {
    return bulkSetProbationStatus(ids, 'extended');
}

export async function bulkTerminateProbations(ids: string[]) {
    return bulkSetProbationStatus(ids, 'terminated');
}

export async function bulkArchiveProbations(ids: string[]) {
    return bulkSetProbationStatus(ids, 'archived');
}
