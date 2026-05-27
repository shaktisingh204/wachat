/**
 * SabCliq Reactions — TS client for `/v1/sabcliq/reactions`.
 *
 * Reactions are user-emoji pairs scoped to a message. The Rust crate
 * stores one document per (messageId, userId, emoji) tuple and exposes
 * aggregated views via `summaryFor(messageId)`.
 *
 * Mirrors `rust/crates/sabcliq-reactions/src/dto.rs`.
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';

/* ─── Wire types ───────────────────────────────────────────────────── */

export interface SabcliqReaction {
    _id?: string;
    userId: string;
    workspaceId: string;
    channelId: string;
    messageId: string;
    emoji: string;
    createdAt: string;
}

export interface SabcliqReactionSummary {
    emoji: string;
    count: number;
    userIds: string[];
    /** Whether the calling user is in `userIds`. */
    mine: boolean;
}

export interface SabcliqReactionToggleBody {
    workspaceId?: string;
    channelId?: string;
    messageId: string;
    emoji: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const BASE = '/v1/sabcliq/reactions';

/* ─── Public API ───────────────────────────────────────────────────── */

export const sabcliqReactionsApi = {
    /** Aggregated view for a single message. */
    async summaryFor(
        messageId: string,
    ): Promise<{ items: SabcliqReactionSummary[] }> {
        try {
            return await rustFetch<{ items: SabcliqReactionSummary[] }>(
                `${BASE}/summary/${encodeURIComponent(messageId)}`,
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { items: [] };
            }
            throw e;
        }
    },

    /** Adds the (caller, emoji) pair on a message. Idempotent. */
    async add(input: SabcliqReactionToggleBody): Promise<SabcliqReaction> {
        return rustFetch<SabcliqReaction>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    /** Removes the (caller, emoji) pair on a message. */
    async remove(
        input: SabcliqReactionToggleBody,
    ): Promise<{ removed: boolean }> {
        try {
            return await rustFetch<{ removed: boolean }>(BASE, {
                method: 'DELETE',
                body: JSON.stringify(input),
            });
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { removed: false };
            }
            throw e;
        }
    },

    /** Server-side convenience: flip the reaction on/off. */
    async toggle(
        input: SabcliqReactionToggleBody,
    ): Promise<{ added: boolean; removed: boolean }> {
        return rustFetch<{ added: boolean; removed: boolean }>(
            `${BASE}/toggle`,
            { method: 'POST', body: JSON.stringify(input) },
        );
    },
};
