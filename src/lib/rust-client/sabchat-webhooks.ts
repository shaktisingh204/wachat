/**
 * Client for `/v1/sabchat/webhooks/*` — endpoint CRUD + delivery log
 * + retry + DLQ. Mirrors handlers in the `sabchat-webhooks` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatWebhookEndpoint {
    _id: string;
    tenantId: string;
    url: string;
    secret?: string;
    events: string[];
    active: boolean;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatWebhookDelivery {
    _id: string;
    tenantId: string;
    endpointId: string;
    event: string;
    status: 'pending' | 'success' | 'failed' | 'dlq';
    attempt: number;
    httpStatus?: number;
    error?: string;
    payload?: unknown;
    createdAt: string;
    deliveredAt?: string;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatWebhooksApi = {
    createEndpoint: (body: { url: string; events: string[]; description?: string; secret?: string; active?: boolean }) =>
        rustFetch<SabChatWebhookEndpoint>('/v1/sabchat/webhooks/endpoints', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listEndpoints: (q: { active?: boolean } = {}) =>
        rustFetch<{ items: SabChatWebhookEndpoint[] }>(`/v1/sabchat/webhooks/endpoints${qs(q)}`),

    updateEndpoint: (id: string, body: Partial<Pick<SabChatWebhookEndpoint, 'url' | 'events' | 'active' | 'description' | 'secret'>>) =>
        rustFetch<SabChatWebhookEndpoint>(`/v1/sabchat/webhooks/endpoints/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    deleteEndpoint: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/webhooks/endpoints/${id}`, { method: 'DELETE' }),

    testEndpoint: (id: string, body: { event?: string; payload?: unknown } = {}) =>
        rustFetch<{ ok: boolean; httpStatus?: number; error?: string }>(
            `/v1/sabchat/webhooks/endpoints/${id}/test`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    listDeliveries: (q: { endpointId?: string; status?: string; event?: string; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatWebhookDelivery[]; nextCursor?: string }>(
            `/v1/sabchat/webhooks/deliveries${qs(q)}`,
        ),

    retryDelivery: (id: string) =>
        rustFetch<SabChatWebhookDelivery>(`/v1/sabchat/webhooks/deliveries/${id}/retry`, { method: 'POST' }),

    listDlq: (q: { endpointId?: string; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatWebhookDelivery[]; nextCursor?: string }>(`/v1/sabchat/webhooks/dlq${qs(q)}`),
};
