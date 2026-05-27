/**
 * SabCliq Messages — TS client for `/v1/sabcliq/messages`.
 *
 * Messages live inside a channel; thread replies use `parentMessageId`
 * (see `sabcliq-threads.ts`). Attachments are SabFiles.
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';
import type {
    SabcliqCreateResult,
    SabcliqListResult,
} from './sabcliq-workspaces';

/* ─── Wire types ───────────────────────────────────────────────────── */

export interface SabcliqAttachment {
    sabfileId: string;
    url: string;
    name: string;
    mime?: string;
    size?: number;
}

export interface SabcliqReactionSummary {
    emoji: string;
    count: number;
    userIds: string[];
}

export interface SabcliqMessageMention {
    userId: string;
    /** Either a userId (`@alice`) or `channel` / `here` */
    kind: 'user' | 'channel' | 'here';
}

export interface SabcliqMessage {
    _id?: string;
    userId: string;
    workspaceId: string;
    channelId: string;
    /** When set, this message is a thread reply. */
    parentMessageId?: string;
    authorUserId: string;
    /** Plain or markdown body. */
    body: string;
    attachments: SabcliqAttachment[];
    mentions: SabcliqMessageMention[];
    /** Aggregated reactions — recomputed by the reactions crate. */
    reactions: SabcliqReactionSummary[];
    edited: boolean;
    pinned: boolean;
    /** Hidden from the channel list — moved to the trash. */
    deleted: boolean;
    threadReplyCount: number;
    threadLastReplyAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabcliqMessageDraft {
    workspaceId: string;
    channelId: string;
    body: string;
    parentMessageId?: string;
    attachments?: SabcliqAttachment[];
    mentions?: SabcliqMessageMention[];
}

export interface SabcliqMessagePatch {
    body?: string;
    attachments?: SabcliqAttachment[];
    mentions?: SabcliqMessageMention[];
}

export interface SabcliqMessageListParams {
    channelId: string;
    workspaceId?: string;
    /** Cursor-style — return messages strictly older than this id. */
    beforeId?: string;
    /** Return messages strictly newer than this id (polling). */
    afterId?: string;
    limit?: number;
    /** When `true`, include thread replies (defaults to root-only). */
    includeReplies?: boolean;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const BASE = '/v1/sabcliq/messages';

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

export const sabcliqMessagesApi = {
    async list(
        params: SabcliqMessageListParams,
    ): Promise<SabcliqListResult<SabcliqMessage>> {
        return rustFetch<SabcliqListResult<SabcliqMessage>>(
            `${BASE}${buildQuery(params)}`,
        );
    },

    async getById(id: string): Promise<SabcliqMessage | null> {
        if (!id) return null;
        try {
            return await rustFetch<SabcliqMessage>(
                `${BASE}/${encodeURIComponent(id)}`,
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },

    async create(
        input: SabcliqMessageDraft,
    ): Promise<SabcliqCreateResult<SabcliqMessage>> {
        return rustFetch<SabcliqCreateResult<SabcliqMessage>>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    async update(
        id: string,
        patch: SabcliqMessagePatch,
    ): Promise<SabcliqMessage> {
        return rustFetch<SabcliqMessage>(
            `${BASE}/${encodeURIComponent(id)}`,
            { method: 'PATCH', body: JSON.stringify(patch) },
        );
    },

    async delete(id: string): Promise<{ deleted: boolean }> {
        try {
            return await rustFetch<{ deleted: boolean }>(
                `${BASE}/${encodeURIComponent(id)}`,
                { method: 'DELETE' },
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { deleted: false };
            }
            throw e;
        }
    },
};
