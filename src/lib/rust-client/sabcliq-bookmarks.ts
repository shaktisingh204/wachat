/**
 * SabCliq Bookmarks — TS client for `/v1/sabcliq/bookmarks`.
 *
 * A bookmark is a per-user "save for later" pointer on a message. Unlike
 * pins (which are channel-wide) bookmarks are private to the calling
 * user.
 *
 * Mirrors `rust/crates/sabcliq-bookmarks/src/dto.rs`.
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';

/* ─── Wire types ───────────────────────────────────────────────────── */

export interface SabcliqBookmark {
    _id?: string;
    userId: string;
    workspaceId?: string;
    channelId: string;
    messageId: string;
    /** Optional one-liner the user attached when saving. */
    note?: string;
    savedAt: string;
}

export interface SabcliqBookmarkCreateBody {
    workspaceId?: string;
    channelId: string;
    messageId: string;
    note?: string;
}

export interface SabcliqBookmarkListParams {
    workspaceId?: string;
    channelId?: string;
    page?: number;
    limit?: number;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const BASE = '/v1/sabcliq/bookmarks';

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

export const sabcliqBookmarksApi = {
    /** Bookmarks for the calling user (server reads `me` from the JWT). */
    async listMine(
        params?: SabcliqBookmarkListParams,
    ): Promise<{ items: SabcliqBookmark[] }> {
        return rustFetch<{ items: SabcliqBookmark[] }>(
            `${BASE}/me${buildQuery(params)}`,
        );
    },

    async add(input: SabcliqBookmarkCreateBody): Promise<SabcliqBookmark> {
        return rustFetch<SabcliqBookmark>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    async removeByMessage(
        messageId: string,
    ): Promise<{ removed: boolean }> {
        try {
            return await rustFetch<{ removed: boolean }>(
                `${BASE}/by-message/${encodeURIComponent(messageId)}`,
                { method: 'DELETE' },
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { removed: false };
            }
            throw e;
        }
    },

    async removeById(id: string): Promise<{ removed: boolean }> {
        try {
            return await rustFetch<{ removed: boolean }>(
                `${BASE}/${encodeURIComponent(id)}`,
                { method: 'DELETE' },
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { removed: false };
            }
            throw e;
        }
    },
};
