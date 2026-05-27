/**
 * SabCliq Channels — TS client for `/v1/sabcliq/channels`.
 *
 * Mirrors `rust/crates/sabcliq-channels/src/dto.rs` + `types.rs`.
 * Channels are scoped to a workspace and carry an explicit
 * `memberUserIds` array; all gating for messages/threads/etc.
 * flows through that list.
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';
import type {
    SabcliqCreateResult,
    SabcliqListResult,
} from './sabcliq-workspaces';

/* ─── Wire types ───────────────────────────────────────────────────── */

export type SabcliqChannelKind = 'public' | 'private' | 'direct';

export interface SabcliqChannel {
    _id?: string;
    userId: string;
    workspaceId: string;
    name: string;
    kind: SabcliqChannelKind;
    description?: string;
    topic?: string;
    memberUserIds: string[];
    archived: boolean;
    pinned: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface SabcliqChannelDraft {
    workspaceId: string;
    name: string;
    kind?: SabcliqChannelKind;
    description?: string;
    topic?: string;
    memberUserIds?: string[];
    pinned?: boolean;
}

export interface SabcliqChannelPatch {
    name?: string;
    description?: string;
    topic?: string;
    memberUserIds?: string[];
    archived?: boolean;
    pinned?: boolean;
}

export interface SabcliqChannelListParams {
    q?: string;
    page?: number;
    limit?: number;
    workspaceId?: string;
    kind?: SabcliqChannelKind;
    archived?: boolean;
    memberUserId?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const BASE = '/v1/sabcliq/channels';

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

export const sabcliqChannelsApi = {
    async list(
        params?: SabcliqChannelListParams,
    ): Promise<SabcliqListResult<SabcliqChannel>> {
        return rustFetch<SabcliqListResult<SabcliqChannel>>(
            `${BASE}${buildQuery(params)}`,
        );
    },

    async getById(id: string): Promise<SabcliqChannel | null> {
        if (!id) return null;
        try {
            return await rustFetch<SabcliqChannel>(
                `${BASE}/${encodeURIComponent(id)}`,
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },

    async create(
        input: SabcliqChannelDraft,
    ): Promise<SabcliqCreateResult<SabcliqChannel>> {
        return rustFetch<SabcliqCreateResult<SabcliqChannel>>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    async update(
        id: string,
        patch: SabcliqChannelPatch,
    ): Promise<SabcliqChannel> {
        return rustFetch<SabcliqChannel>(
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

    async addMember(channelId: string, userId: string): Promise<SabcliqChannel> {
        return rustFetch<SabcliqChannel>(
            `${BASE}/${encodeURIComponent(channelId)}/members`,
            { method: 'POST', body: JSON.stringify({ userId }) },
        );
    },

    async removeMember(
        channelId: string,
        userId: string,
    ): Promise<SabcliqChannel> {
        return rustFetch<SabcliqChannel>(
            `${BASE}/${encodeURIComponent(channelId)}/members/${encodeURIComponent(userId)}`,
            { method: 'DELETE' },
        );
    },
};
