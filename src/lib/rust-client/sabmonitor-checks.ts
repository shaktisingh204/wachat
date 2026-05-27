import 'server-only';

import { rustFetch } from './fetcher';

/* ─── Wire types — mirror sabmonitor-checks::types::SabmonitorCheck ── */

export type SabmonitorCheckKind =
    | 'http'
    | 'tcp'
    | 'dns'
    | 'ssl'
    | 'ping'
    | 'synthetic_browser'
    | 'api_transaction';

export type SabmonitorCheckLastStatus = 'up' | 'down' | 'warning' | 'unknown';

export interface SabmonitorCheckDoc {
    _id?: string;
    userId: string;
    name: string;
    kind: SabmonitorCheckKind;
    url?: string;
    host?: string;
    port?: number;
    intervalSecs: number;
    regions?: string[];
    headersJson?: string;
    bodyJson?: string;
    expectedStatus?: number;
    expectedBodyContains?: string;
    expectedBodyRegex?: string;
    sslExpiryWarnDays?: number;
    syntheticScriptId?: string;
    apiTransactionId?: string;
    tags?: string[];
    status: 'active' | 'paused';
    lastRunAt?: string;
    lastStatus?: SabmonitorCheckLastStatus;
    createdAt: string;
    updatedAt?: string;
}

export interface SabmonitorCheckCreateInput {
    name: string;
    kind: SabmonitorCheckKind;
    intervalSecs: number;
    url?: string;
    host?: string;
    port?: number;
    regions?: string[];
    headersJson?: string;
    bodyJson?: string;
    expectedStatus?: number;
    expectedBodyContains?: string;
    expectedBodyRegex?: string;
    sslExpiryWarnDays?: number;
    syntheticScriptId?: string;
    apiTransactionId?: string;
    tags?: string[];
    status?: 'active' | 'paused';
}

export type SabmonitorCheckUpdateInput = Partial<SabmonitorCheckCreateInput>;

export interface SabmonitorCheckListParams {
    q?: string;
    page?: number;
    limit?: number;
    status?: 'active' | 'paused' | 'all';
    kind?: SabmonitorCheckKind;
}

export interface SabmonitorCheckListResult {
    items: SabmonitorCheckDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

const BASE = '/v1/sabmonitor/checks';

function qs(p: SabmonitorCheckListParams | undefined): string {
    if (!p) return '';
    const sp = new URLSearchParams();
    if (p.q) sp.set('q', p.q);
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (p.status) sp.set('status', p.status);
    if (p.kind) sp.set('kind', p.kind);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabmonitorCheckApi = {
    async list(params?: SabmonitorCheckListParams): Promise<SabmonitorCheckListResult> {
        return rustFetch<SabmonitorCheckListResult>(`${BASE}${qs(params)}`);
    },
    async getById(id: string): Promise<SabmonitorCheckDoc | null> {
        try {
            return await rustFetch<SabmonitorCheckDoc>(`${BASE}/${id}`);
        } catch {
            return null;
        }
    },
    async create(
        input: SabmonitorCheckCreateInput,
    ): Promise<{ id: string; entity: SabmonitorCheckDoc }> {
        return rustFetch<{ id: string; entity: SabmonitorCheckDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async update(id: string, patch: SabmonitorCheckUpdateInput): Promise<SabmonitorCheckDoc> {
        return rustFetch<SabmonitorCheckDoc>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    async delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
};
