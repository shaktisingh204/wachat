'use server';

/**
 * DataPrep server actions.
 *
 * Thin proxies over the Rust BFF (`dataprep-recipes`, `dataprep-profiles`,
 * `dataprep-runs`). Direct Mongo access is reserved for the legacy CSV
 * upload → in-band rows path; persisted recipes / runs / profiles all go
 * through the Rust handlers.
 *
 * Multi-tenant scoping is enforced server-side by Rust via `userId`
 * derived from the verified JWT; these actions only forward the bearer.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import {
    dataprepRecipeApi,
    type DataprepRecipeCreateInput,
    type DataprepRecipeDoc,
    type DataprepRecipeListResult,
    type DataprepRecipePreviewInput,
    type DataprepRecipePreviewResult,
    type DataprepRecipeRunInput,
    type DataprepRecipeRunResult,
    type DataprepRecipeUpdateInput,
} from '@/lib/rust-client/sabprep-recipes';
import {
    dataprepProfileApi,
    type ColumnProfile,
    type DataprepProfileDoc,
} from '@/lib/rust-client/sabprep-profiles';
import {
    dataprepRunApi,
    type DataprepRunDoc,
    type DataprepRunListResult,
} from '@/lib/rust-client/sabprep-runs';
import type { Row, Step } from '@/lib/rust-client/sabprep-steps';

/* ─── helpers ───────────────────────────────────────────────────────── */

function revalidateDataprep(recipeId?: string): void {
    revalidatePath('/dashboard/dataprep');
    if (recipeId) {
        revalidatePath(`/dashboard/dataprep/recipes/${recipeId}`);
    }
}

async function requireUserId(): Promise<string> {
    const session = await getSession();
    if (!session?.user?._id) {
        throw new Error('Not signed in.');
    }
    return String(session.user._id);
}

/* ─── Recipes ───────────────────────────────────────────────────────── */

export async function listRecipes(params?: {
    q?: string;
    page?: number;
    limit?: number;
    status?: 'active' | 'archived' | 'all';
}): Promise<DataprepRecipeListResult> {
    await requireUserId();
    return dataprepRecipeApi.list(params);
}

export async function getRecipe(id: string): Promise<DataprepRecipeDoc | null> {
    await requireUserId();
    try {
        return await dataprepRecipeApi.getById(id);
    } catch {
        return null;
    }
}

export async function createRecipe(
    input: DataprepRecipeCreateInput,
): Promise<{ id: string; entity: DataprepRecipeDoc }> {
    await requireUserId();
    const res = await dataprepRecipeApi.create(input);
    revalidateDataprep();
    return res;
}

export async function updateRecipe(
    id: string,
    patch: DataprepRecipeUpdateInput,
): Promise<DataprepRecipeDoc> {
    await requireUserId();
    const res = await dataprepRecipeApi.update(id, patch);
    revalidateDataprep(id);
    return res;
}

export async function deleteRecipe(id: string): Promise<{ deleted: boolean }> {
    await requireUserId();
    const res = await dataprepRecipeApi.delete(id);
    revalidateDataprep(id);
    return res;
}

export async function previewRecipe(
    input: DataprepRecipePreviewInput,
): Promise<DataprepRecipePreviewResult> {
    await requireUserId();
    return dataprepRecipeApi.preview(input);
}

export async function runRecipe(
    id: string,
    input: DataprepRecipeRunInput = {},
): Promise<DataprepRecipeRunResult> {
    await requireUserId();
    const res = await dataprepRecipeApi.run(id, input);
    revalidateDataprep(id);
    return res;
}

/** Convenience — set / clear the schedule cron on a recipe. */
export async function scheduleRecipe(
    id: string,
    cron: string | null,
): Promise<DataprepRecipeDoc> {
    return updateRecipe(id, { scheduleCron: cron ?? '' });
}

/* ─── Profiles ──────────────────────────────────────────────────────── */

export async function listProfiles(datasetId?: string): Promise<DataprepProfileDoc[]> {
    await requireUserId();
    const res = await dataprepProfileApi.list(datasetId);
    return res.items ?? [];
}

export async function createProfile(input: {
    datasetId?: string;
    rows?: Row[];
}): Promise<DataprepProfileDoc> {
    await requireUserId();
    return dataprepProfileApi.create(input);
}

export async function computeProfile(rows: Row[]): Promise<ColumnProfile[]> {
    await requireUserId();
    return dataprepProfileApi.compute(rows);
}

/* ─── Runs ──────────────────────────────────────────────────────────── */

export async function listRuns(params?: {
    recipeId?: string;
    page?: number;
    limit?: number;
    status?: 'ok' | 'partial' | 'failed';
}): Promise<DataprepRunListResult> {
    await requireUserId();
    return dataprepRunApi.list(params);
}

export async function getRun(id: string): Promise<DataprepRunDoc | null> {
    await requireUserId();
    try {
        return await dataprepRunApi.getById(id);
    } catch {
        return null;
    }
}

/* ─── CSV / SabFiles ingest ─────────────────────────────────────────── */

/**
 * Persist an arbitrary in-band row-set as a `dataprep_outputs` document
 * so the canvas can reference it as a source dataset. This is the bridge
 * between SabFiles-uploaded CSVs (parsed in the browser) and the recipe
 * source-id field.
 *
 * Multi-tenant by `userId` from the session. This is the one place we
 * touch Mongo directly because there is no `POST /dataprep/datasets`
 * route yet (planned — see DEFERRED in the report).
 */
export async function persistDataset(input: {
    name: string;
    rows: Row[];
}): Promise<{ id: string; name: string; rowsCount: number }> {
    const userId = await requireUserId();
    if (!input.name?.trim()) {
        throw new Error('Dataset name is required.');
    }
    try {
        const { db } = await connectToDatabase();
        const doc = {
            userId: new ObjectId(userId),
            name: input.name.trim(),
            rows: input.rows,
            rowsCount: input.rows.length,
            createdAt: new Date(),
        };
        const inserted = await db.collection('dataprep_outputs').insertOne(doc);
        return {
            id: String(inserted.insertedId),
            name: doc.name,
            rowsCount: doc.rowsCount,
        };
    } catch (e) {
        throw new Error(`Failed to persist dataset: ${getErrorMessage(e)}`);
    }
}

/**
 * List datasets available for use as a source / join target. Sourced
 * directly from `dataprep_outputs` for now; once `bi_datasets` is wired
 * those will be merged in here.
 */
export async function listDatasets(): Promise<
    Array<{ id: string; name: string; rowsCount: number; createdAt: string }>
> {
    const userId = await requireUserId();
    const { db } = await connectToDatabase();
    const rows = await db
        .collection('dataprep_outputs')
        .find({ userId: new ObjectId(userId) }, { projection: { rows: 0 } })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
    return rows.map((r) => ({
        id: String(r._id),
        name: (r.name as string) ?? `Dataset ${String(r._id).slice(-6)}`,
        rowsCount: Number(r.rowsCount ?? 0),
        createdAt:
            r.createdAt instanceof Date
                ? r.createdAt.toISOString()
                : String(r.createdAt ?? ''),
    }));
}

/** Fetch a preview slice of a dataset's rows (capped) for the canvas. */
export async function getDatasetPreview(
    datasetId: string,
    limit = 50,
): Promise<{ id: string; name: string; rows: Row[]; rowsCount: number }> {
    const userId = await requireUserId();
    const { db } = await connectToDatabase();
    if (!ObjectId.isValid(datasetId)) {
        throw new Error('Invalid datasetId.');
    }
    const row = await db.collection('dataprep_outputs').findOne({
        _id: new ObjectId(datasetId),
        userId: new ObjectId(userId),
    });
    if (!row) {
        throw new Error('Dataset not found.');
    }
    const rows: Row[] = Array.isArray(row.rows)
        ? (row.rows as Row[]).slice(0, Math.max(1, Math.min(500, limit)))
        : [];
    return {
        id: String(row._id),
        name: (row.name as string) ?? '',
        rows,
        rowsCount: Number(row.rowsCount ?? rows.length),
    };
}

/**
 * Build a starter `Step` from a one-tap cleansing-suggestion chip emitted
 * by the profiler. Returned as a value so the canvas can prepend it to
 * the recipe's `steps` array.
 */
export async function stepFromSuggestion(
    column: string,
    kind: string,
): Promise<Step> {
    switch (kind) {
        case 'trim':
            return {
                kind: 'derive',
                config: { target: column, expression: `trim({${column}})` },
            };
        case 'lowercase':
            return {
                kind: 'derive',
                config: { target: column, expression: `lower({${column}})` },
            };
        case 'uppercase':
            return {
                kind: 'derive',
                config: { target: column, expression: `upper({${column}})` },
            };
        case 'fill_nulls':
            return {
                kind: 'fillNulls',
                config: { column, fillWith: '' },
            };
        case 'cast_to_number':
            return {
                kind: 'typeCast',
                config: { column, targetType: 'number' },
            };
        case 'standardize_phone':
            return {
                kind: 'derive',
                config: {
                    target: column,
                    expression: `trim({${column}})`,
                    // Full E.164 normalization is a follow-up — see DEFERRED.
                },
            };
        default:
            return {
                kind: 'derive',
                config: { target: column, expression: `{${column}}` },
            };
    }
}
