import 'server-only';

import { rustFetch } from './fetcher';

export type SabopsMdmCommandKind =
    | 'lock'
    | 'wipe'
    | 'locate'
    | 'install_app'
    | 'reboot'
    | 'sync_settings';

export type SabopsMdmCommandStatus = 'queued' | 'sent' | 'acknowledged' | 'failed';

export interface SabopsMdmCommandDoc {
    _id?: string;
    userId: string;
    endpointId: string;
    kind: SabopsMdmCommandKind;
    status: SabopsMdmCommandStatus;
    payloadJson?: Record<string, unknown> | null;
    issuedBy: string;
    issuedAt: string;
    ackedAt?: string;
}

export interface SabopsMdmCommandIssueInput {
    endpointId: string;
    kind: SabopsMdmCommandKind;
    payloadJson?: Record<string, unknown>;
}

export interface SabopsMdmCommandListParams {
    page?: number;
    limit?: number;
    endpointId?: string;
    status?: SabopsMdmCommandStatus;
    kind?: SabopsMdmCommandKind;
}

export interface SabopsMdmCommandListResult {
    items: SabopsMdmCommandDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

function qs(p: SabopsMdmCommandListParams): string {
    const sp = new URLSearchParams();
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (p.endpointId) sp.set('endpointId', p.endpointId);
    if (p.status) sp.set('status', p.status);
    if (p.kind) sp.set('kind', p.kind);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const mdmCommandsApi = {
    list(params: SabopsMdmCommandListParams = {}): Promise<SabopsMdmCommandListResult> {
        return rustFetch(`/v1/sabops/mdm/commands${qs(params)}`);
    },
    issue(
        input: SabopsMdmCommandIssueInput,
    ): Promise<{ id: string; entity: SabopsMdmCommandDoc }> {
        return rustFetch(`/v1/sabops/mdm/commands`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    acknowledge(id: string): Promise<{ acknowledged: boolean }> {
        return rustFetch(`/v1/sabops/mdm/commands/${id}/ack`, { method: 'POST' });
    },
};
