/**
 * Client for `/v1/sabchat/events/*` — the event log + replay surface
 * owned by the `sabchat-events` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatEvent {
    _id: string;
    tenantId: string;
    kind: string;
    occurredAt: string;
    actorId?: string;
    conversationId?: string;
    contactId?: string;
    inboxId?: string;
    payload?: Record<string, unknown>;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatEventsApi = {
    list: (
        q: {
            kind?: string;
            conversationId?: string;
            contactId?: string;
            inboxId?: string;
            actorId?: string;
            since?: string;
            until?: string;
            limit?: number;
            cursor?: string;
        } = {},
    ) =>
        rustFetch<{ events: SabChatEvent[]; nextCursor?: string }>(`/v1/sabchat/events/${qs(q)}`),

    get: (id: string) => rustFetch<SabChatEvent>(`/v1/sabchat/events/${id}`),

    replay: (id: string) =>
        rustFetch<{ ok: boolean; rebroadcast: boolean; event: SabChatEvent }>(
            `/v1/sabchat/events/replay/${id}`,
            { method: 'POST' },
        ),
};
