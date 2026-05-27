/**
 * SabCliq Presence — TS client for `/v1/sabcliq/presence`.
 *
 * Tracks online/away/dnd state per user, plus an optional custom
 * status emoji + text. Real-time fan-out is the transport's job; this
 * client handles read-and-write through the REST surface.
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';

/* ─── Wire types ───────────────────────────────────────────────────── */

export type SabcliqPresenceStatus =
    | 'online'
    | 'away'
    | 'dnd'
    | 'offline';

export interface SabcliqPresence {
    _id?: string;
    userId: string;
    workspaceId?: string;
    status: SabcliqPresenceStatus;
    statusEmoji?: string;
    statusText?: string;
    /** RFC3339 timestamp when the user was last seen active. */
    lastActiveAt?: string;
    /** When set, status auto-clears after this timestamp. */
    expiresAt?: string;
    updatedAt?: string;
}

export interface SabcliqPresenceUpdate {
    status: SabcliqPresenceStatus;
    statusEmoji?: string;
    statusText?: string;
    expiresAt?: string;
    workspaceId?: string;
}

export interface SabcliqPresenceListParams {
    /** Comma-joined list of userIds. Either this or workspaceId is required. */
    userIds?: string[];
    workspaceId?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const BASE = '/v1/sabcliq/presence';

function buildQuery(params?: SabcliqPresenceListParams): string {
    if (!params) return '';
    const sp = new URLSearchParams();
    if (params.userIds && params.userIds.length > 0) {
        sp.set('userIds', params.userIds.join(','));
    }
    if (params.workspaceId) sp.set('workspaceId', params.workspaceId);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/* ─── Public API ───────────────────────────────────────────────────── */

export const sabcliqPresenceApi = {
    /** Batch-fetch presence for many users at once. */
    async list(
        params: SabcliqPresenceListParams,
    ): Promise<{ items: SabcliqPresence[] }> {
        return rustFetch<{ items: SabcliqPresence[] }>(
            `${BASE}${buildQuery(params)}`,
        );
    },

    async getById(userId: string): Promise<SabcliqPresence | null> {
        try {
            return await rustFetch<SabcliqPresence>(
                `${BASE}/${encodeURIComponent(userId)}`,
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },

    /** Set the caller's own presence. */
    async set(input: SabcliqPresenceUpdate): Promise<SabcliqPresence> {
        return rustFetch<SabcliqPresence>(`${BASE}/me`, {
            method: 'PUT',
            body: JSON.stringify(input),
        });
    },

    /** Heartbeat — bumps `lastActiveAt` without changing status. */
    async heartbeat(): Promise<{ ok: boolean }> {
        return rustFetch<{ ok: boolean }>(`${BASE}/me/heartbeat`, {
            method: 'POST',
        });
    },
};
