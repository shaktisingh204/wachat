import 'server-only';

/**
 * DataPrep profile client — wraps `/v1/dataprep/profiles` on the Rust BFF.
 *
 * Mirrors `rust/crates/dataprep-profiles/src/types.rs`.
 */

import { rustFetch } from './fetcher';
import type { JsonValue, Row } from './dataprep-steps';

export interface TopValue {
    value: JsonValue;
    count: number;
}

export interface CleansingSuggestion {
    /** Stable id — `trim`, `lowercase`, `fill_nulls`, `cast_to_number`, … */
    kind: string;
    label: string;
    reason: string;
}

export interface ColumnProfile {
    name: string;
    type: 'string' | 'number' | 'bool' | 'null' | 'mixed';
    nullCount: number;
    distinctCount: number;
    min?: number;
    max?: number;
    mean?: number;
    topValues?: TopValue[];
    suggestedCleansing?: CleansingSuggestion[];
}

export interface DataprepProfileDoc {
    _id?: string;
    userId: string;
    datasetId?: string;
    rowsTotal: number;
    perColumn: ColumnProfile[];
    createdAt: string;
}

const BASE = '/v1/dataprep/profiles';

export const dataprepProfileApi = {
    list(datasetId?: string): Promise<{ items: DataprepProfileDoc[] }> {
        const qs = datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : '';
        return rustFetch(`${BASE}${qs}`);
    },

    getById(id: string): Promise<DataprepProfileDoc> {
        return rustFetch(`${BASE}/${encodeURIComponent(id)}`);
    },

    /** Compute + persist a profile against a stored dataset or in-band rows. */
    create(input: { datasetId?: string; rows?: Row[] }): Promise<DataprepProfileDoc> {
        return rustFetch(`${BASE}`, { method: 'POST', body: JSON.stringify(input) });
    },

    /** Ad-hoc — compute without persisting. */
    compute(rows: Row[]): Promise<ColumnProfile[]> {
        return rustFetch(`${BASE}/compute`, {
            method: 'POST',
            body: JSON.stringify({ rows }),
        });
    },

    delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
};
