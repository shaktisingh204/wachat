/**
 * Client for `/v1/sabchat/public/*` — the downstream-consumer surface.
 *
 * The Rust side gates this prefix on an `X-Api-Key` header (looked up via
 * `wachat_public_api::ApiKeyVerifier`) with `sabchat:read` / `sabchat:write`
 * scopes. From inside SabNode we still hit it through the same JWT-bearing
 * `rustFetch`; the public-API gating only matters for *external* callers
 * who hold a tenant-issued API key.
 *
 * For minting / listing the API keys themselves, use the admin keys surface
 * (out of scope here — see `wachatApiKeysAdmin` for the parallel WhatsApp
 * primitive; SabChat reuses the same key registry today).
 */
import 'server-only';

import { rustFetch } from './fetcher';
import type { SabChatContact, SabChatConversation, SabChatMessage, ContentBlock, SocialIdentity } from './sabchat';

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatPublicApi = {
    // ---- contacts ----------------------------------------------------------
    listContacts: (q: { q?: string; tag?: string; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatContact[]; nextCursor?: string }>(`/v1/sabchat/public/contacts${qs(q)}`),

    createContact: (body: {
        name?: string;
        emails?: string[];
        phones?: string[];
        socialIds?: SocialIdentity[];
        attrs?: Record<string, unknown>;
        tags?: string[];
    }) =>
        rustFetch<SabChatContact>('/v1/sabchat/public/contacts', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    getContact: (id: string) => rustFetch<SabChatContact>(`/v1/sabchat/public/contacts/${id}`),

    // ---- conversations -----------------------------------------------------
    listConversations: (q: { inboxId?: string; status?: string; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatConversation[]; nextCursor?: string }>(`/v1/sabchat/public/conversations${qs(q)}`),

    getConversation: (id: string) => rustFetch<SabChatConversation>(`/v1/sabchat/public/conversations/${id}`),

    listMessages: (conversationId: string, q: { beforeId?: string; limit?: number } = {}) =>
        rustFetch<{ items: SabChatMessage[] }>(
            `/v1/sabchat/public/conversations/${conversationId}/messages${qs(q)}`,
        ),

    appendMessage: (conversationId: string, body: { content: ContentBlock; private?: boolean }) =>
        rustFetch<SabChatMessage>(`/v1/sabchat/public/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};
