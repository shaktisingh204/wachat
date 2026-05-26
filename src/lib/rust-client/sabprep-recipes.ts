import 'server-only';

/**
 * DataPrep recipe client — wraps `/v1/dataprep/recipes` on the Rust BFF.
 *
 * Mirrors `rust/crates/dataprep-recipes/src/dto.rs` + `types.rs`.
 */

import { rustFetch } from './fetcher';
import type { Row, Step, StepRunSummary } from './dataprep-steps';

export interface DataprepRecipeDoc {
    _id?: string;
    userId: string;
    name: string;
    description?: string;
    sourceDatasetId?: string;
    sourceColumns?: string[];
    steps?: Step[];
    outputDatasetId?: string;
    lastRunId?: string;
    scheduleCron?: string;
    createdAt: string;
    updatedAt?: string;
    status?: string;
}

export interface DataprepRecipeCreateInput {
    name: string;
    description?: string;
    sourceDatasetId?: string;
    sourceColumns?: string[];
    steps?: Step[];
    scheduleCron?: string;
}

export type DataprepRecipeUpdateInput = Partial<DataprepRecipeCreateInput> & {
    status?: 'active' | 'archived';
};

export interface DataprepRecipeListResult {
    items: DataprepRecipeDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface DataprepRecipePreviewInput {
    rows: Row[];
    steps: Step[];
    limit?: number;
}

export interface DataprepRecipePreviewResult {
    rows: Row[];
    summaries: StepRunSummary[];
    totalErrors: number;
    rowsTotal: number;
}

export interface DataprepRecipeRunInput {
    rows?: Row[];
    persistOutput?: boolean;
}

export interface DataprepRecipeRunResult {
    runId: string;
    outputDatasetId?: string;
    rowsIn: number;
    rowsOut: number;
    status: string;
    summaries: StepRunSummary[];
}

const BASE = '/v1/dataprep/recipes';

export const dataprepRecipeApi = {
    async list(params?: {
        q?: string;
        page?: number;
        limit?: number;
        status?: 'active' | 'archived' | 'all';
    }): Promise<DataprepRecipeListResult> {
        const sp = new URLSearchParams();
        if (params?.q) sp.set('q', params.q);
        if (typeof params?.page === 'number') sp.set('page', String(params.page));
        if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
        if (params?.status) sp.set('status', params.status);
        const qs = sp.toString();
        return rustFetch<DataprepRecipeListResult>(`${BASE}${qs ? `?${qs}` : ''}`);
    },

    getById(id: string): Promise<DataprepRecipeDoc> {
        return rustFetch<DataprepRecipeDoc>(`${BASE}/${encodeURIComponent(id)}`);
    },

    create(input: DataprepRecipeCreateInput): Promise<{ id: string; entity: DataprepRecipeDoc }> {
        return rustFetch(`${BASE}`, { method: 'POST', body: JSON.stringify(input) });
    },

    update(id: string, patch: DataprepRecipeUpdateInput): Promise<DataprepRecipeDoc> {
        return rustFetch<DataprepRecipeDoc>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },

    delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    preview(input: DataprepRecipePreviewInput): Promise<DataprepRecipePreviewResult> {
        return rustFetch<DataprepRecipePreviewResult>(`${BASE}/preview`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    run(
        id: string,
        input: DataprepRecipeRunInput = {},
    ): Promise<DataprepRecipeRunResult> {
        return rustFetch<DataprepRecipeRunResult>(
            `${BASE}/${encodeURIComponent(id)}/run`,
            { method: 'POST', body: JSON.stringify(input) },
        );
    },
};
