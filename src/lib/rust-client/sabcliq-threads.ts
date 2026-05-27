/**
 * SabCliq Threads — TS client for `/v1/sabcliq/threads`.
 *
 * A thread is rooted at a parent message in a channel; the replies are
 * regular `sabcliq_messages` documents with `parentMessageId` set.
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';
import type { SabcliqMessage } from './sabcliq-messages';
import type {
    SabcliqCreateResult,
    SabcliqListResult,
} from './sabcliq-workspaces';

/* ─── Wire types ───────────────────────────────────────────────────── */

export interface SabcliqThread {
    _id?: string;
    userId: string;
    workspaceId: string;
    channelId: string;
    parentMessageId: string;
    replyCount: number;
    lastReplyAt?: string;
    participantUserIds: string[];
    /** Users with thread-reply notifications muted. */
    mutedUserIds: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface SabcliqThreadReplyDraft {
    workspaceId: string;
    channelId: string;
    parentMessageId: string;
    body: string;
    attachments?: SabcliqMessage['attachments'];
    mentions?: SabcliqMessage['mentions'];
}

export interface SabcliqThreadListParams {
    workspaceId?: string;
    channelId?: string;
    page?: number;
    limit?: number;
    /** Only threads that include this user as a participant. */
    participantUserId?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const BASE = '/v1/sabcliq/threads';

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

export const sabcliqThreadsApi = {
    async list(
        params?: SabcliqThreadListParams,
    ): Promise<SabcliqListResult<SabcliqThread>> {
        return rustFetch<SabcliqListResult<SabcliqThread>>(
            `${BASE}${buildQuery(params)}`,
        );
    },

    async getById(id: string): Promise<SabcliqThread | null> {
        if (!id) return null;
        try {
            return await rustFetch<SabcliqThread>(
                `${BASE}/${encodeURIComponent(id)}`,
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },

    async getByParentMessageId(
        messageId: string,
    ): Promise<SabcliqThread | null> {
        try {
            return await rustFetch<SabcliqThread>(
                `${BASE}/by-message/${encodeURIComponent(messageId)}`,
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },

    /** Convenience: list replies (root messages excluded). */
    async listReplies(
        parentMessageId: string,
    ): Promise<SabcliqListResult<SabcliqMessage>> {
        return rustFetch<SabcliqListResult<SabcliqMessage>>(
            `${BASE}/${encodeURIComponent(parentMessageId)}/replies`,
        );
    },

    async reply(
        input: SabcliqThreadReplyDraft,
    ): Promise<SabcliqCreateResult<SabcliqMessage>> {
        return rustFetch<SabcliqCreateResult<SabcliqMessage>>(
            `${BASE}/${encodeURIComponent(input.parentMessageId)}/replies`,
            { method: 'POST', body: JSON.stringify(input) },
        );
    },

    async muteThread(
        threadId: string,
    ): Promise<{ muted: boolean }> {
        return rustFetch<{ muted: boolean }>(
            `${BASE}/${encodeURIComponent(threadId)}/mute`,
            { method: 'POST' },
        );
    },

    async unmuteThread(
        threadId: string,
    ): Promise<{ muted: boolean }> {
        return rustFetch<{ muted: boolean }>(
            `${BASE}/${encodeURIComponent(threadId)}/mute`,
            { method: 'DELETE' },
        );
    },
};
