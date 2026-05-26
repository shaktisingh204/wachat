import 'server-only';

/**
 * SabConnect Reactions client — wraps `/v1/sabconnect/reactions`.
 *
 * `toggle` is idempotent: posting the same (itemId, reactorId, emoji)
 * twice removes the reaction.
 */
import { rustFetch } from './fetcher';

export interface SabConnectReactionDoc {
    _id: string;
    userId?: string;
    itemId: string;
    reactorId: string;
    reactorName?: string;
    emoji: string;
    createdAt?: string;
}

export interface SabConnectReactionListResponse {
    items: SabConnectReactionDoc[];
    countByEmoji: Record<string, number>;
}

export interface SabConnectReactionToggleInput {
    itemId: string;
    reactorId: string;
    reactorName?: string;
    emoji: string;
}

export interface SabConnectReactionToggleResponse {
    added: boolean;
    entity?: SabConnectReactionDoc;
}

export const sabconnectReactionsApi = {
    list: (itemId: string) =>
        rustFetch<SabConnectReactionListResponse>(
            `/v1/sabconnect/reactions?itemId=${encodeURIComponent(itemId)}`,
        ),
    toggle: (input: SabConnectReactionToggleInput) =>
        rustFetch<SabConnectReactionToggleResponse>('/v1/sabconnect/reactions', {
            method: 'POST',
            body: JSON.stringify(input),
        }),
};
