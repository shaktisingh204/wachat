/**
 * SabCliq Huddles — TS client for `/v1/sabcliq/huddles`.
 *
 * A huddle is an ephemeral voice/video session attached to a channel.
 * Real-time transport (WebRTC / SFU) is out of scope; this client only
 * handles the lifecycle metadata that the Rust crate persists.
 *
 * Mirrors `rust/crates/sabcliq-huddles/src/dto.rs` (request/response
 * shapes — once the crate has a populated `dto.rs`, regenerate from it).
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';
import type {
    SabcliqCreateResult,
    SabcliqListResult,
} from './sabcliq-workspaces';

/* ─── Wire types ───────────────────────────────────────────────────── */

export type SabcliqHuddleStatus = 'active' | 'ended';

export interface SabcliqHuddleParticipant {
    userId: string;
    joinedAt: string;
    leftAt?: string;
    /** Client-reported mic state — purely informational. */
    micOn?: boolean;
    /** Client-reported video state. */
    videoOn?: boolean;
}

export interface SabcliqHuddle {
    _id?: string;
    userId: string;
    workspaceId: string;
    channelId: string;
    startedBy: string;
    status: SabcliqHuddleStatus;
    /** Active participant userIds — derived from `participants[]`. */
    participantIds: string[];
    participants: SabcliqHuddleParticipant[];
    /** Opaque token for the real-time transport (WebRTC / LiveKit). */
    transportToken?: string;
    startedAt: string;
    endedAt?: string;
    updatedAt?: string;
}

export interface SabcliqHuddleStartBody {
    workspaceId: string;
    channelId: string;
    /** Optional preset for the transport (e.g. `"audio-only"`). */
    mode?: 'audio' | 'video';
}

export interface SabcliqHuddleJoinBody {
    micOn?: boolean;
    videoOn?: boolean;
}

export interface SabcliqHuddleListParams {
    workspaceId?: string;
    channelId?: string;
    status?: SabcliqHuddleStatus;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const BASE = '/v1/sabcliq/huddles';

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

export const sabcliqHuddlesApi = {
    async list(
        params?: SabcliqHuddleListParams,
    ): Promise<SabcliqListResult<SabcliqHuddle>> {
        return rustFetch<SabcliqListResult<SabcliqHuddle>>(
            `${BASE}${buildQuery(params)}`,
        );
    },

    async getById(id: string): Promise<SabcliqHuddle | null> {
        if (!id) return null;
        try {
            return await rustFetch<SabcliqHuddle>(
                `${BASE}/${encodeURIComponent(id)}`,
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },

    /** Currently-active huddle for a channel, if one exists. */
    async getActiveForChannel(channelId: string): Promise<SabcliqHuddle | null> {
        try {
            return await rustFetch<SabcliqHuddle>(
                `${BASE}/active/${encodeURIComponent(channelId)}`,
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },

    async start(
        input: SabcliqHuddleStartBody,
    ): Promise<SabcliqCreateResult<SabcliqHuddle>> {
        return rustFetch<SabcliqCreateResult<SabcliqHuddle>>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    async join(
        huddleId: string,
        input?: SabcliqHuddleJoinBody,
    ): Promise<SabcliqHuddle> {
        return rustFetch<SabcliqHuddle>(
            `${BASE}/${encodeURIComponent(huddleId)}/join`,
            { method: 'POST', body: JSON.stringify(input ?? {}) },
        );
    },

    async leave(huddleId: string): Promise<{ left: boolean }> {
        return rustFetch<{ left: boolean }>(
            `${BASE}/${encodeURIComponent(huddleId)}/leave`,
            { method: 'POST' },
        );
    },

    async end(huddleId: string): Promise<{ ended: boolean }> {
        return rustFetch<{ ended: boolean }>(
            `${BASE}/${encodeURIComponent(huddleId)}/end`,
            { method: 'POST' },
        );
    },
};
