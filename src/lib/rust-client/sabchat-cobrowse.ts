/**
 * Client for `/v1/sabchat/cobrowse/*` — agent-side co-browse signalling
 * surface owned by the `sabchat-cobrowse` Rust crate. The companion
 * visitor router lives at `/v1/sabchat/cobrowse-public/*` and is keyed by
 * the opaque `visitorToken` rather than a JWT, so this client only wraps
 * the JWT-gated agent endpoints.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatCobrowseStatus = 'pending' | 'active' | 'ended';

export interface SabChatCobrowseSession {
    _id: string;
    tenantId: string;
    conversationId: string;
    contactId: string;
    visitorToken: string;
    agentId?: string;
    status: SabChatCobrowseStatus;
    consentGranted: boolean;
    maskPasswordFields: boolean;
    startedAt?: string;
    endedAt?: string;
    createdAt: string;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatCobrowseApi = {
    request: (conversationId: string, body: { maskPasswordFields?: boolean } = {}) =>
        rustFetch<SabChatCobrowseSession>(`/v1/sabchat/cobrowse/request/${conversationId}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    end: (sessionId: string) =>
        rustFetch<SabChatCobrowseSession>(`/v1/sabchat/cobrowse/${sessionId}/end`, { method: 'POST' }),

    list: (q: { conversationId?: string; status?: SabChatCobrowseStatus } = {}) =>
        rustFetch<{ items: SabChatCobrowseSession[] }>(`/v1/sabchat/cobrowse/${qs(q)}`),
};
