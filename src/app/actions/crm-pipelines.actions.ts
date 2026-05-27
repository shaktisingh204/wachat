'use server';

/**
 * CRM Pipeline server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, every action delegates to the Rust BFF
 *    (`/v1/crm/pipelines`) via `src/lib/rust-client/crm-pipelines.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the existing pages at
 * `/dashboard/sabbigin/pipelines/**`, the contacts page, and the
 * `edit-pipelines-dialog` / `crm-add-pipeline-dialog` components keep
 * working without changes.
 *
 * Pipelines live as an EMBEDDED array on the `users` collection at
 * `users.crmPipelines[]`. The Rust path uses `_id: ObjectId` for each
 * pipeline + stage so they're individually addressable; the legacy TS path
 * uses uuid `id` strings. Both shapes round-trip — the wire client
 * preserves whichever `_id`/`id` it sees.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { CrmPipeline } from '@/lib/definitions';
import {
    pipelineApi,
    type CrmPipelineDoc,
} from '@/lib/rust-client/crm-pipelines';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Rust-shape → legacy TS-shape adapter ────────────────────────────── */

/**
 * The legacy `CrmPipeline` type uses `id: string`. The Rust path stamps
 * `_id: ObjectId` (hex string). Surface whichever exists so callers that
 * key on `pipeline.id` keep working — and `pipeline._id` is available for
 * new code that wants to address the embedded doc.
 */
function rustDocToLegacy(doc: CrmPipelineDoc): CrmPipeline {
    return {
        id: doc.id || doc._id,
        name: doc.name,
        stages: (doc.stages || []).map((s) => ({
            id: s.id || s._id,
            name: s.name,
            chance: typeof s.chance === 'number' ? s.chance : 0,
        })),
    };
}

/* ─── getCrmPipelines ────────────────────────────────────────────────── */

export async function getCrmPipelines(): Promise<CrmPipeline[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            const items = await pipelineApi.list();
            return items.map(rustDocToLegacy);
        } catch (e) {
            console.error('[getCrmPipelines] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'pipeline', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db
            .collection('users')
            .findOne({ _id: new ObjectId(session.user._id) });
        return user?.crmPipelines || [];
    } catch (e) {
        console.error('Failed to fetch CRM pipelines:', e);
        return [];
    }
}

/* ─── saveCrmPipelines ───────────────────────────────────────────────── */

/**
 * Bulk-save. Preserves the legacy semantics: completely replaces the
 * user's `crmPipelines` array.
 *
 * **Rust path:** there is no single bulk-replace endpoint (the
 * embedded-array model wants per-pipeline `$push` / `$pull`). We approximate
 * by diffing against the current Rust state: delete pipelines that vanished
 * from the input, update pipelines that changed, and create new ones.
 * Within each pipeline we similarly diff stages. This is intentionally
 * best-effort — the dialog that calls this writes the full intended state.
 */
export async function saveCrmPipelines(
    pipelines: any[],
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    // Stamp uuids on anything new so the legacy shape survives round-trip.
    const pipelinesWithIds = pipelines.map((p) => ({
        ...p,
        id: p.id || uuidv4(),
        stages: (p.stages || []).map((s: any) => ({ ...s, id: s.id || uuidv4() })),
    }));

    if (useRustCrm()) {
        try {
            const existing = await pipelineApi.list();
            const existingById = new Map<string, CrmPipelineDoc>();
            for (const p of existing) {
                // Index by both _id (Rust addressable) AND legacy uuid id so
                // the input's `id` field can match either.
                existingById.set(p._id, p);
                if (p.id) existingById.set(p.id, p);
            }

            const inputIds = new Set<string>();

            for (const p of pipelinesWithIds) {
                const inputId: string = String(p.id);
                inputIds.add(inputId);
                const existingDoc = existingById.get(inputId);

                if (!existingDoc) {
                    // New pipeline — create it with its initial stages.
                    await pipelineApi.create({
                        name: p.name,
                        stages: (p.stages || []).map((s: any) => ({
                            name: s.name,
                            chance:
                                typeof s.chance === 'number' ? s.chance : undefined,
                            color: s.color,
                            order: s.order,
                        })),
                    });
                    continue;
                }

                const pipelineRustId = existingDoc._id;

                // Update metadata if it changed.
                if (existingDoc.name !== p.name) {
                    await pipelineApi.update(pipelineRustId, { name: p.name });
                }

                // Diff stages.
                const existingStageById = new Map<
                    string,
                    (typeof existingDoc.stages)[number]
                >();
                for (const s of existingDoc.stages) {
                    existingStageById.set(s._id, s);
                    if (s.id) existingStageById.set(s.id, s);
                }

                const inputStageIds = new Set<string>();
                for (const s of p.stages || []) {
                    const sid = String(s.id);
                    inputStageIds.add(sid);
                    const existingStage = existingStageById.get(sid);
                    if (!existingStage) {
                        await pipelineApi.addStage(pipelineRustId, {
                            name: s.name,
                            chance:
                                typeof s.chance === 'number' ? s.chance : undefined,
                            color: s.color,
                            order: s.order,
                        });
                        continue;
                    }
                    if (
                        existingStage.name !== s.name ||
                        existingStage.chance !== s.chance
                    ) {
                        await pipelineApi.updateStage(
                            pipelineRustId,
                            existingStage._id,
                            {
                                name: s.name,
                                chance:
                                    typeof s.chance === 'number'
                                        ? s.chance
                                        : undefined,
                            },
                        );
                    }
                }

                // Stages that vanished from the input — remove.
                for (const s of existingDoc.stages) {
                    const matchedById = inputStageIds.has(s._id);
                    const matchedByLegacy = s.id && inputStageIds.has(s.id);
                    if (!matchedById && !matchedByLegacy) {
                        await pipelineApi.removeStage(pipelineRustId, s._id);
                    }
                }
            }

            // Pipelines that vanished from the input — remove.
            for (const p of existing) {
                const matchedById = inputIds.has(p._id);
                const matchedByLegacy = p.id && inputIds.has(p.id);
                if (!matchedById && !matchedByLegacy) {
                    await pipelineApi.delete(p._id);
                }
            }

            revalidatePath('/dashboard/sabbigin/pipelines');
            return { success: true };
        } catch (e) {
            console.error('[saveCrmPipelines] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'pipeline', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db
            .collection('users')
            .updateOne(
                { _id: new ObjectId(session.user._id) },
                { $set: { crmPipelines: pipelinesWithIds } },
            );

        revalidatePath('/dashboard/sabbigin/pipelines');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── createCrmPipeline ──────────────────────────────────────────────── */

const DEFAULT_NEW_STAGES = [
    { name: 'New', chance: 10 },
    { name: 'Qualified', chance: 30 },
    { name: 'Proposal', chance: 60 },
    { name: 'Negotiation', chance: 80 },
    { name: 'Won', chance: 100 },
    { name: 'Lost', chance: 0 },
];

export async function createCrmPipeline(
    name: string,
): Promise<{ success: boolean; pipeline?: CrmPipeline; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    if (useRustCrm()) {
        try {
            const { entity } = await pipelineApi.create({
                name,
                stages: DEFAULT_NEW_STAGES,
            });
            revalidatePath('/dashboard/sabbigin/pipelines');
            return {
                success: true,
                pipeline: rustDocToLegacy(entity),
            };
        } catch (e) {
            console.error('[createCrmPipeline] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'pipeline', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    const newPipeline: CrmPipeline = {
        id: uuidv4(),
        name,
        stages: DEFAULT_NEW_STAGES.map((s) => ({
            id: uuidv4(),
            name: s.name,
            chance: s.chance,
        })),
    };

    try {
        const { db } = await connectToDatabase();
        await db
            .collection('users')
            .updateOne(
                { _id: new ObjectId(session.user._id) },
                { $push: { crmPipelines: newPipeline } as any },
            );

        revalidatePath('/dashboard/sabbigin/pipelines');
        return { success: true, pipeline: newPipeline };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── UI-shape types + per-pipeline get/save (PipelineForm) ─────────── */

/**
 * UI-shape stage row used by `<PipelineForm />`. Superset of the
 * `CrmPipeline['stages'][n]` shape — adds `color`, `order`,
 * `probability` (instead of `chance`) and `conditions`. The legacy
 * `chance` field is mirrored from `probability` on save so existing
 * read-only callers keep working.
 */
interface PipelineUiStage {
    _id?: string;
    id?: string;
    name: string;
    color?: string;
    order: number;
    probability?: number;
    conditions?: string;
}

/**
 * UI-shape pipeline doc used by `<PipelineForm />` and the detail page.
 * Extends the legacy `CrmPipeline` shape with the UI-only metadata
 * (description, color, entityKind, status, isDefault) that the form
 * captures.
 */
interface PipelineUiDoc {
    _id?: string;
    id?: string;
    name: string;
    description?: string;
    color?: string;
    entityKind?: 'lead' | 'deal' | 'opportunity';
    status?: 'active' | 'archived' | 'draft';
    isDefault?: boolean;
    stages?: PipelineUiStage[];
    createdAt?: string | Date;
    updatedAt?: string | Date;
}

/**
 * Fetch a single pipeline by id, mapped into the UI-shape. Returns
 * `null` if the id doesn't match any of the user's pipelines.
 *
 * The lookup goes straight to `users.crmPipelines[]` because the UI
 * fields (description / color / status / etc.) only round-trip via the
 * embedded shape — the Rust BFF doesn't surface them yet.
 */
export async function getPipelineById(
    pipelineId: string,
): Promise<PipelineUiDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!pipelineId) return null;

    try {
        const { db } = await connectToDatabase();
        const user = await db
            .collection('users')
            .findOne(
                { _id: new ObjectId(session.user._id) },
                { projection: { crmPipelines: 1 } },
            );
        const list: any[] = user?.crmPipelines ?? [];
        const match = list.find(
            (p) =>
                String(p?.id ?? '') === pipelineId ||
                String(p?._id ?? '') === pipelineId,
        );
        if (!match) return null;

        const stages: PipelineUiStage[] = (match.stages ?? []).map(
            (s: any, i: number) => ({
                _id: s._id ? String(s._id) : undefined,
                id: s.id ? String(s.id) : undefined,
                name: s.name ?? '',
                color: s.color,
                order: typeof s.order === 'number' ? s.order : i,
                probability:
                    typeof s.probability === 'number'
                        ? s.probability
                        : typeof s.chance === 'number'
                          ? s.chance
                          : undefined,
                conditions: s.conditions,
            }),
        );

        return {
            _id: String(match._id ?? match.id ?? pipelineId),
            id: match.id ? String(match.id) : undefined,
            name: match.name ?? '',
            description: match.description,
            color: match.color,
            entityKind: match.entityKind,
            status: match.status,
            isDefault: !!match.isDefault,
            stages,
            createdAt: match.createdAt,
            updatedAt: match.updatedAt,
        };
    } catch (e) {
        console.error('[getPipelineById] failed:', e);
        return null;
    }
}

/**
 * `useActionState`-compatible per-pipeline save used by
 * `<PipelineForm />`. Writes through the embedded `users.crmPipelines[]`
 * array — replaces the matching entry on edit, appends on create.
 */
export async function savePipeline(
    _prevState: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const pipelineId =
        (formData.get('pipelineId') as string | null) || undefined;
    const name = (formData.get('name') as string | null)?.trim() || '';
    if (!name) return { error: 'Pipeline name is required.' };

    const color = (formData.get('color') as string | null) || undefined;
    const description =
        (formData.get('description') as string | null) || undefined;
    const entityKind =
        ((formData.get('entityKind') as string | null) ?? 'lead') as
            | 'lead'
            | 'deal'
            | 'opportunity';
    const status =
        ((formData.get('status') as string | null) ?? 'active') as
            | 'active'
            | 'archived'
            | 'draft';
    const isDefault = formData.get('isDefault') === 'on';

    let stagesRaw: PipelineUiStage[] = [];
    try {
        const raw = formData.get('stages') as string | null;
        if (raw) stagesRaw = JSON.parse(raw) as PipelineUiStage[];
    } catch {
        return { error: 'Invalid stages payload.' };
    }

    const stages = stagesRaw.map((s, i) => ({
        id: s.id || uuidv4(),
        _id: s._id,
        name: (s.name || '').trim(),
        color: s.color,
        order: typeof s.order === 'number' ? s.order : i,
        probability: typeof s.probability === 'number' ? s.probability : 0,
        // Mirror probability into the legacy `chance` field so old
        // read-only consumers keep working.
        chance: typeof s.probability === 'number' ? s.probability : 0,
        conditions: s.conditions,
    }));

    const id = pipelineId || uuidv4();
    const now = new Date();
    const merged = {
        id,
        name,
        color,
        description,
        entityKind,
        status,
        isDefault,
        stages,
        updatedAt: now,
    } as Record<string, unknown>;

    try {
        const { db } = await connectToDatabase();
        const userFilter = { _id: new ObjectId(session.user._id) };
        const user = await db
            .collection('users')
            .findOne(userFilter, { projection: { crmPipelines: 1 } });
        const list: any[] = (user?.crmPipelines as any[]) ?? [];

        const idx = list.findIndex(
            (p) =>
                String(p?.id ?? '') === id || String(p?._id ?? '') === id,
        );
        if (idx === -1) {
            merged.createdAt = now;
            list.push(merged);
        } else {
            list[idx] = { ...list[idx], ...merged };
        }

        // If `isDefault` was checked, clear it on every other pipeline so
        // there is only ever one default at a time.
        if (isDefault) {
            for (const p of list) {
                if (String(p?.id ?? '') !== id) p.isDefault = false;
            }
        }

        await db
            .collection('users')
            .updateOne(userFilter, { $set: { crmPipelines: list } });

        revalidatePath('/dashboard/sabbigin/pipelines');
        revalidatePath(`/dashboard/sabbigin/pipelines/${id}`);
        return { message: 'Pipeline saved.', id };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/* ─── KPI aggregate for the all-pipelines list page ──────────────────── */

interface CrmPipelineKpis {
    /** Total number of pipelines for the tenant. */
    total: number;
    /** Total value of deals currently in flight across all pipelines. */
    inFlightValue: number;
    /** Average days a deal spends in pipeline (open deals only). */
    avgVelocityDays: number;
    /** Name of the pipeline with the most deals attached. */
    topPipelineName: string;
    /** Currency code observed on the bulk of in-flight deals (best-effort). */
    currency: string;
}

const EMPTY_PIPELINE_KPIS: CrmPipelineKpis = {
    total: 0,
    inFlightValue: 0,
    avgVelocityDays: 0,
    topPipelineName: '—',
    currency: 'INR',
};

export async function getCrmPipelineKpis(): Promise<CrmPipelineKpis> {
    const session = await getSession();
    if (!session?.user) return EMPTY_PIPELINE_KPIS;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const user = await db
            .collection('users')
            .findOne({ _id: userObjectId });
        const pipelines: CrmPipeline[] = (user?.crmPipelines as CrmPipeline[] | undefined) ?? [];
        const total = pipelines.length;
        const nameById = new Map<string, string>();
        for (const p of pipelines) {
            if (p?.id) nameById.set(String(p.id), p.name ?? '—');
        }

        const closedStages = new Set(['won', 'lost', 'closed', 'converted']);

        const deals = await db
            .collection('crm_deals')
            .find({ userId: userObjectId })
            .project({ value: 1, currency: 1, stage: 1, status: 1, pipelineId: 1, createdAt: 1, closedAt: 1 })
            .toArray();

        let inFlightValue = 0;
        let inFlightCount = 0;
        let velocityTotalDays = 0;
        let velocityCount = 0;
        const currencyCount = new Map<string, number>();
        const dealsPerPipeline = new Map<string, number>();
        const now = Date.now();

        for (const d of deals as Array<Record<string, unknown>>) {
            const stage = String(d.stage ?? '').toLowerCase();
            const status = String(d.status ?? '').toLowerCase();
            const value = Number(d.value ?? 0);
            const cur = String(d.currency ?? 'INR');
            const pid = String(d.pipelineId ?? '');
            if (pid) {
                dealsPerPipeline.set(pid, (dealsPerPipeline.get(pid) ?? 0) + 1);
            }

            const isClosed = closedStages.has(stage) || closedStages.has(status);
            if (!isClosed) {
                inFlightCount += 1;
                if (Number.isFinite(value)) inFlightValue += value;
                currencyCount.set(cur, (currencyCount.get(cur) ?? 0) + 1);
                const createdAtRaw = d.createdAt;
                const createdMs =
                    createdAtRaw instanceof Date
                        ? createdAtRaw.getTime()
                        : typeof createdAtRaw === 'string'
                          ? Date.parse(createdAtRaw)
                          : NaN;
                if (Number.isFinite(createdMs)) {
                    const days = Math.max(0, (now - createdMs) / (1000 * 60 * 60 * 24));
                    velocityTotalDays += days;
                    velocityCount += 1;
                }
            }
        }

        let topPipelineName = '—';
        let topCount = -1;
        for (const [pid, count] of dealsPerPipeline) {
            if (count > topCount) {
                topCount = count;
                topPipelineName = nameById.get(pid) ?? '—';
            }
        }
        // If no deals at all but pipelines exist, fall back to the first.
        if (topCount <= 0 && pipelines.length > 0) {
            topPipelineName = pipelines[0]?.name ?? '—';
        }

        let currency = 'INR';
        let curBest = -1;
        for (const [c, n] of currencyCount) {
            if (n > curBest) {
                curBest = n;
                currency = c;
            }
        }

        const avgVelocityDays =
            velocityCount > 0 ? Math.round((velocityTotalDays / velocityCount) * 10) / 10 : 0;

        return {
            total,
            inFlightValue,
            avgVelocityDays,
            topPipelineName,
            currency,
        };
    } catch (e) {
        console.error('[getCrmPipelineKpis] failed:', e);
        return { ...EMPTY_PIPELINE_KPIS };
    }
}

/* ─── Bulk delete pipelines (by id, embedded array) ──────────────────── */

export async function bulkDeleteCrmPipelines(
    ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, processed: 0, error: 'Access denied' };
    if (!Array.isArray(ids) || ids.length === 0) {
        return { success: true, processed: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const userFilter = { _id: new ObjectId(session.user._id) };
        const user = await db.collection('users').findOne(userFilter);
        const current: CrmPipeline[] = (user?.crmPipelines as CrmPipeline[] | undefined) ?? [];
        const idSet = new Set(ids.map((s) => String(s)));
        const next = current.filter((p) => !idSet.has(String(p?.id ?? '')));
        const processed = current.length - next.length;

        await db
            .collection('users')
            .updateOne(userFilter, { $set: { crmPipelines: next } });

        revalidatePath('/dashboard/crm/sales-crm/all-pipelines');
        revalidatePath('/dashboard/sabbigin/pipelines');
        return { success: true, processed };
    } catch (e) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}
