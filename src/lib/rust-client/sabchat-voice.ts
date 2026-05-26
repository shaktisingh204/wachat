/**
 * Client for `/v1/sabchat/voice/*` — WebRTC voice/video call signalling
 * owned by the `sabchat-voice` Rust crate. The actual media is served by a
 * third-party provider (LiveKit / Daily.co); SabNode only owns the room id,
 * lifecycle states, and the per-call access-token re-issue endpoint.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatCallKind = 'audio' | 'video';
export type SabChatCallStatus = 'ringing' | 'answered' | 'ended' | 'failed' | 'missed';

export interface SabChatCall {
    _id: string;
    tenantId: string;
    conversationId: string;
    contactId: string;
    inboxId: string;
    kind: SabChatCallKind;
    status: SabChatCallStatus;
    initiatorId?: string;
    answeredById?: string;
    roomId: string;
    provider: string;
    startedAt: string;
    answeredAt?: string;
    endedAt?: string;
    durationS?: number;
    failureReason?: string;
}

export interface SabChatCallToken {
    callId: string;
    roomId: string;
    provider: string;
    token: string;
    expiresAt?: string;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatVoiceApi = {
    start: (body: { conversationId: string; kind: SabChatCallKind }) =>
        rustFetch<SabChatCall>('/v1/sabchat/voice/calls', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: (q: { conversationId?: string; status?: SabChatCallStatus; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatCall[]; nextCursor?: string }>(`/v1/sabchat/voice/calls${qs(q)}`),

    get: (id: string) => rustFetch<SabChatCall>(`/v1/sabchat/voice/calls/${id}`),

    answer: (id: string) =>
        rustFetch<SabChatCall>(`/v1/sabchat/voice/calls/${id}/answer`, { method: 'POST' }),

    end: (id: string) =>
        rustFetch<SabChatCall>(`/v1/sabchat/voice/calls/${id}/end`, { method: 'POST' }),

    fail: (id: string, body: { reason?: string } = {}) =>
        rustFetch<SabChatCall>(`/v1/sabchat/voice/calls/${id}/fail`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    token: (q: { callId: string }) =>
        rustFetch<SabChatCallToken>(`/v1/sabchat/voice/token${qs(q)}`),
};
