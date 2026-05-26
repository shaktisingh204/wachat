/**
 * Client for `/v1/sabchat/ai/voc/*` — Voice-of-Customer topic clustering
 * + run history owned by the `sabchat-ai-voc` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatVocRunStatus = 'pending' | 'running' | 'done' | 'failed';

export interface SabChatVocRun {
    _id: string;
    tenantId: string;
    status: SabChatVocRunStatus;
    from?: string;
    to?: string;
    messageCount?: number;
    topicCount?: number;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
}

export interface SabChatVocTopic {
    _id: string;
    tenantId: string;
    runId: string;
    label: string;
    summary?: string;
    keywords: string[];
    messageCount: number;
    sentimentMean?: number;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatAiVocApi = {
    run: (body: { from?: string; to?: string; inboxId?: string } = {}) =>
        rustFetch<SabChatVocRun>('/v1/sabchat/ai/voc/run', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listRuns: (q: { status?: SabChatVocRunStatus; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatVocRun[]; nextCursor?: string }>(`/v1/sabchat/ai/voc/runs${qs(q)}`),

    getRun: (id: string) => rustFetch<SabChatVocRun>(`/v1/sabchat/ai/voc/runs/${id}`),

    listTopics: (q: { runId?: string; limit?: number } = {}) =>
        rustFetch<{ items: SabChatVocTopic[] }>(`/v1/sabchat/ai/voc/topics${qs(q)}`),

    listTopicMessages: (topicId: string, q: { limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: Array<{ messageId: string; conversationId: string; preview: string; createdAt: string }>; nextCursor?: string }>(
            `/v1/sabchat/ai/voc/topics/${topicId}/messages${qs(q)}`,
        ),
};
