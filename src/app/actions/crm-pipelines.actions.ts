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
 * `/dashboard/crm/sales-crm/pipelines/**`, the contacts page, and the
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
import { getErrorMessage } from '@/lib/utils';

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

            revalidatePath('/dashboard/crm/sales-crm/pipelines');
            return { success: true };
        } catch (e) {
            console.error('[saveCrmPipelines] rust path failed; falling back:', e);
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

        revalidatePath('/dashboard/crm/sales-crm/pipelines');
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
            revalidatePath('/dashboard/crm/sales-crm/pipelines');
            return {
                success: true,
                pipeline: rustDocToLegacy(entity),
            };
        } catch (e) {
            console.error('[createCrmPipeline] rust path failed; falling back:', e);
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

        revalidatePath('/dashboard/crm/sales-crm/pipelines');
        return { success: true, pipeline: newPipeline };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
