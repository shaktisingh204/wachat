/**
 * SabShow Presence rust-client — wraps `/v1/sabshow/presence`.
 *
 * Polling fallback for the real-time `IShowTransport`. See
 * `src/lib/sabshow/transport.ts` for the wrapping interface.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabshowPresenceDoc {
    _id?: string;
    deckId: string;
    slideId: string;
    userId: string;
    cursor?: { x: number; y: number };
    color: string;
    selectedElementId?: string;
    lastSeenAt: string;
}

export interface SabshowHeartbeatInput {
    deckId: string;
    slideId: string;
    color: string;
    cursorX?: number;
    cursorY?: number;
    selectedElementId?: string;
}

const BASE = '/v1/sabshow/presence';

export const sabshowPresenceApi = {
    async list(deckId: string): Promise<SabshowPresenceDoc[]> {
        const res = await rustFetch<{ items: SabshowPresenceDoc[] }>(
            `${BASE}?deckId=${deckId}`
        );
        return res.items;
    },

    async heartbeat(input: SabshowHeartbeatInput): Promise<{ ok: boolean }> {
        return rustFetch<{ ok: boolean }>(`${BASE}/heartbeat`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    async disconnect(deckId: string): Promise<{ ok: boolean }> {
        return rustFetch<{ ok: boolean }>(`${BASE}?deckId=${deckId}`, {
            method: 'DELETE',
        });
    },
};
