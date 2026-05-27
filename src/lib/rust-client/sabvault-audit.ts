import 'server-only';

/**
 * SabVault audit-log client — wraps `/v1/sabvault/audit`.
 */

import { rustFetch } from './fetcher';

export type SabvaultAuditAction =
    | 'view'
    | 'copy'
    | 'reveal'
    | 'edit'
    | 'share'
    | 'revoke'
    | 'create'
    | 'delete'
    | 'unlock_fail'
    | 'unlock_ok';

export interface SabvaultAuditEntry {
    _id?: string;
    userId: string;
    secretId?: string;
    actorUserId: string;
    action: SabvaultAuditAction;
    ip?: string;
    userAgent?: string;
    meta?: Record<string, unknown>;
    ts: string;
}

export interface SabvaultAuditListParams {
    page?: number;
    limit?: number;
    secretId?: string;
    actorUserId?: string;
    action?: SabvaultAuditAction;
    from?: string;
    to?: string;
}

export interface SabvaultAuditListResult {
    items: SabvaultAuditEntry[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface SabvaultLogAccessInput {
    secretId?: string;
    action: SabvaultAuditAction;
    ip?: string;
    userAgent?: string;
    meta?: Record<string, unknown>;
}

const BASE = '/v1/sabvault/audit';

function qs(p?: SabvaultAuditListParams): string {
    const sp = new URLSearchParams();
    if (typeof p?.page === 'number') sp.set('page', String(Math.floor(p.page)));
    if (typeof p?.limit === 'number') sp.set('limit', String(Math.min(100, Math.floor(p.limit))));
    if (p?.secretId) sp.set('secretId', p.secretId);
    if (p?.actorUserId) sp.set('actorUserId', p.actorUserId);
    if (p?.action) sp.set('action', p.action);
    if (p?.from) sp.set('from', p.from);
    if (p?.to) sp.set('to', p.to);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabvaultAuditApi = {
    async list(params?: SabvaultAuditListParams): Promise<SabvaultAuditListResult> {
        return await rustFetch(`${BASE}${qs(params)}`);
    },
    async log(input: SabvaultLogAccessInput): Promise<{ id: string }> {
        return await rustFetch(`${BASE}`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
};
