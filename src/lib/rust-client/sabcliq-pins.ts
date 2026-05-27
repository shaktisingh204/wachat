/**
 * SabCliq Pins — TS client for `/v1/sabcliq/pins`.
 *
 * A pin marks a message as highlighted at the channel level so it
 * appears in a "Pinned" strip above the message stream. Pins are
 * shared across all members of a channel (not per-user — that's
 * `sabcliq-bookmarks`).
 *
 * Mirrors `rust/crates/sabcliq-pins/src/dto.rs`.
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';

/* ─── Wire types ───────────────────────────────────────────────────── */

export interface SabcliqPin {
    _id?: string;
    userId: string;
    workspaceId: string;
    channelId: string;
    messageId: string;
    pinnedBy: string;
    pinnedAt: string;
}

export interface SabcliqPinCreateBody {
    workspaceId?: string;
    channelId: string;
    messageId: string;
}

export interface SabcliqPinListParams {
    channelId: string;
    workspaceId?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const BASE = '/v1/sabcliq/pins';

function buildQuery(params?: Record<string, unknown>): string {
    if (!params) return '';
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/* ─── Public API ───────────────────────────────────────────────────── */

export const sabcliqPinsApi = {
    async list(
        params: SabcliqPinListParams,
    ): Promise<{ items: SabcliqPin[] }> {
        return rustFetch<{ items: SabcliqPin[] }>(
            `${BASE}${buildQuery(params)}`,
        );
    },

    async pin(input: SabcliqPinCreateBody): Promise<SabcliqPin> {
        return rustFetch<SabcliqPin>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    /** Unpin by messageId (the natural key — pins are unique per message). */
    async unpinByMessage(
        messageId: string,
    ): Promise<{ unpinned: boolean }> {
        try {
            return await rustFetch<{ unpinned: boolean }>(
                `${BASE}/by-message/${encodeURIComponent(messageId)}`,
                { method: 'DELETE' },
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { unpinned: false };
            }
            throw e;
        }
    },

    async unpinById(pinId: string): Promise<{ unpinned: boolean }> {
        try {
            return await rustFetch<{ unpinned: boolean }>(
                `${BASE}/${encodeURIComponent(pinId)}`,
                { method: 'DELETE' },
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { unpinned: false };
            }
            throw e;
        }
    },
};
