import 'server-only';

/**
 * DataPrep run client — wraps `/v1/dataprep/runs` on the Rust BFF.
 *
 * Mirrors `rust/crates/dataprep-runs/src/types.rs`. Read-only.
 */

import { rustFetch } from './fetcher';
import type { StepError, StepRunSummary } from './dataprep-steps';

export interface DataprepRunDoc {
    _id?: string;
    userId: string;
    recipeId: string;
    startedAt: string;
    finishedAt: string;
    status: 'ok' | 'partial' | 'failed' | string;
    rowsIn: number;
    rowsOut: number;
    errors?: StepError[];
    summaries?: StepRunSummary[];
    outputDatasetId?: string;
}

export interface DataprepRunListResult {
    items: DataprepRunDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

const BASE = '/v1/dataprep/runs';

export const dataprepRunApi = {
    list(params?: {
        recipeId?: string;
        page?: number;
        limit?: number;
        status?: 'ok' | 'partial' | 'failed';
    }): Promise<DataprepRunListResult> {
        const sp = new URLSearchParams();
        if (params?.recipeId) sp.set('recipeId', params.recipeId);
        if (typeof params?.page === 'number') sp.set('page', String(params.page));
        if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
        if (params?.status) sp.set('status', params.status);
        const qs = sp.toString();
        return rustFetch(`${BASE}${qs ? `?${qs}` : ''}`);
    },

    getById(id: string): Promise<DataprepRunDoc> {
        return rustFetch(`${BASE}/${encodeURIComponent(id)}`);
    },
};
