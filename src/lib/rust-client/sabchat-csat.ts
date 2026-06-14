/**
 * Client for `/v1/sabchat/csat/*` — CSAT / NPS / CES survey CRUD,
 * agent-triggered send, response read surface, and per-survey stats.
 * Owned by the `sabchat-csat` Rust crate. The public visitor-side
 * `/respond` endpoint at `/v1/sabchat/csat-public/respond` is keyed by
 * the widget `visitorToken` and is not exposed here.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatSurveyKind = 'csat' | 'nps' | 'ces';

export interface SabChatSurveyBranch {
    scoreMin: number;
    scoreMax: number;
    followUpQuestion: string;
}

export interface SabChatSurvey {
    _id: string;
    tenantId: string;
    name: string;
    kind: SabChatSurveyKind;
    question: string;
    scaleMin?: number;
    scaleMax?: number;
    followUpQuestion?: string;
    /** Skip-logic: a different follow-up question per score range. */
    branches?: SabChatSurveyBranch[];
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatSurveyResponse {
    _id: string;
    tenantId: string;
    surveyId: string;
    conversationId: string;
    contactId: string;
    score: number;
    comment?: string;
    submittedAt: string;
}

export interface SabChatSurveyStats {
    surveyId: string;
    total: number;
    mean: number;
    distribution: Record<string, number>;
    nps?: { promoters: number; passives: number; detractors: number; score: number };
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatCsatApi = {
    createSurvey: (body: Partial<Omit<SabChatSurvey, '_id' | 'tenantId' | 'createdAt' | 'updatedAt'>> & { name: string; kind: SabChatSurveyKind; question: string }) =>
        rustFetch<SabChatSurvey>('/v1/sabchat/csat/surveys', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listSurveys: (q: { kind?: SabChatSurveyKind; active?: boolean } = {}) =>
        rustFetch<{ items: SabChatSurvey[] }>(`/v1/sabchat/csat/surveys${qs(q)}`),

    getSurvey: (id: string) => rustFetch<SabChatSurvey>(`/v1/sabchat/csat/surveys/${id}`),

    updateSurvey: (id: string, body: Partial<Omit<SabChatSurvey, '_id' | 'tenantId' | 'createdAt' | 'updatedAt'>>) =>
        rustFetch<SabChatSurvey>(`/v1/sabchat/csat/surveys/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    deleteSurvey: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/csat/surveys/${id}`, { method: 'DELETE' }),

    send: (conversationId: string, body: { surveyId: string }) =>
        rustFetch<{ ok: boolean; messageId: string }>(`/v1/sabchat/csat/send/${conversationId}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listResponses: (q: { surveyId?: string; conversationId?: string; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatSurveyResponse[]; nextCursor?: string }>(
            `/v1/sabchat/csat/responses${qs(q)}`,
        ),

    stats: (q: { surveyId: string; from?: string; to?: string }) =>
        rustFetch<SabChatSurveyStats>(`/v1/sabchat/csat/stats${qs(q)}`),
};
