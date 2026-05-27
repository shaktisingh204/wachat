import 'server-only';

import { rustFetch } from './fetcher';

export type SabopsAlertKind =
    | 'stale'
    | 'low_disk'
    | 'low_battery'
    | 'patch_failed'
    | 'unauthorized_software';
export type SabopsAlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SabopsAlertState = 'open' | 'acknowledged' | 'resolved' | 'all';

export interface SabopsAlertDoc {
    _id?: string;
    userId: string;
    endpointId: string;
    kind: SabopsAlertKind;
    severity: SabopsAlertSeverity;
    message: string;
    raisedAt: string;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
    resolvedAt?: string;
}

export interface SabopsAlertCreateInput {
    endpointId: string;
    kind: SabopsAlertKind;
    severity: SabopsAlertSeverity;
    message: string;
}

export interface SabopsAlertListParams {
    page?: number;
    limit?: number;
    endpointId?: string;
    kind?: SabopsAlertKind;
    severity?: SabopsAlertSeverity;
    state?: SabopsAlertState;
}

export interface SabopsAlertListResult {
    items: SabopsAlertDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

function qs(p: SabopsAlertListParams): string {
    const sp = new URLSearchParams();
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (p.endpointId) sp.set('endpointId', p.endpointId);
    if (p.kind) sp.set('kind', p.kind);
    if (p.severity) sp.set('severity', p.severity);
    if (p.state) sp.set('state', p.state);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const alertsApi = {
    list(params: SabopsAlertListParams = {}): Promise<SabopsAlertListResult> {
        return rustFetch(`/v1/sabops/alerts${qs(params)}`);
    },
    create(input: SabopsAlertCreateInput): Promise<{ id: string; entity: SabopsAlertDoc }> {
        return rustFetch(`/v1/sabops/alerts`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    acknowledge(id: string): Promise<{ ok: boolean }> {
        return rustFetch(`/v1/sabops/alerts/${id}/ack`, { method: 'POST' });
    },
    resolve(id: string): Promise<{ ok: boolean }> {
        return rustFetch(`/v1/sabops/alerts/${id}/resolve`, { method: 'POST' });
    },
};
