import 'server-only';

/**
 * SabVault breach-alert client — wraps `/v1/sabvault/breach-alerts`.
 *
 * The actual breach lookup (HIBP k-anonymity range API) runs CLIENT-SIDE
 * — the cleartext credential never crosses any wire. The client posts only
 * the resulting verdict.
 */

import { rustFetch, RustApiError } from './fetcher';

export type SabvaultBreachStatus = 'clean' | 'breached' | 'unknown';

export interface SabvaultBreachAlertDoc {
    _id?: string;
    userId: string;
    secretId: string;
    status: SabvaultBreachStatus;
    lastCheckedAt: string;
    source?: string;
    breachSourceUrl?: string;
    breachCount?: number;
    note?: string;
}

export interface SabvaultBreachUpsertInput {
    secretId: string;
    status: SabvaultBreachStatus;
    source?: string;
    breachSourceUrl?: string;
    breachCount?: number;
    note?: string;
}

export interface SabvaultBreachListParams {
    page?: number;
    limit?: number;
    secretId?: string;
    status?: SabvaultBreachStatus;
}

export interface SabvaultBreachListResult {
    items: SabvaultBreachAlertDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

const BASE = '/v1/sabvault/breach-alerts';

function qs(p?: SabvaultBreachListParams): string {
    const sp = new URLSearchParams();
    if (typeof p?.page === 'number') sp.set('page', String(Math.floor(p.page)));
    if (typeof p?.limit === 'number') sp.set('limit', String(Math.min(100, Math.floor(p.limit))));
    if (p?.secretId) sp.set('secretId', p.secretId);
    if (p?.status) sp.set('status', p.status);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabvaultBreachAlertsApi = {
    async list(params?: SabvaultBreachListParams): Promise<SabvaultBreachListResult> {
        return await rustFetch(`${BASE}${qs(params)}`);
    },
    async getForSecret(secretId: string): Promise<SabvaultBreachAlertDoc | null> {
        if (!secretId) return null;
        try {
            return await rustFetch(`${BASE}/${encodeURIComponent(secretId)}`);
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },
    async upsert(input: SabvaultBreachUpsertInput) {
        return await rustFetch<{ id: string; entity: SabvaultBreachAlertDoc }>(`${BASE}`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
};
