/**
 * Client for `/v1/sabchat/ai/qa/*` — automated quality-assurance grading
 * surface owned by the `sabchat-ai-qa` Rust crate. Covers tenant rubric
 * CRUD, AI auto-grading + manual grading of conversations, the score
 * read surface, and the per-agent leaderboard.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatQaRubricCriterion {
    key: string;
    label: string;
    weight: number;
}

export interface SabChatQaRubric {
    _id: string;
    tenantId: string;
    name: string;
    criteria: SabChatQaRubricCriterion[];
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatQaScoreEntry {
    key: string;
    score: number;
    notes?: string;
}

export interface SabChatQaScore {
    _id: string;
    tenantId: string;
    conversationId: string;
    rubricId: string;
    scores: SabChatQaScoreEntry[];
    total: number;
    max: number;
    coaching?: string;
    gradedBy: 'ai' | 'agent';
    gradedAt: string;
    agentId?: string;
    inboxId?: string;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatAiQaApi = {
    createRubric: (body: { name: string; criteria: SabChatQaRubricCriterion[]; active?: boolean }) =>
        rustFetch<SabChatQaRubric>('/v1/sabchat/ai/qa/rubrics', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listRubrics: (q: { active?: boolean } = {}) =>
        rustFetch<{ items: SabChatQaRubric[] }>(`/v1/sabchat/ai/qa/rubrics${qs(q)}`),

    getRubric: (id: string) => rustFetch<SabChatQaRubric>(`/v1/sabchat/ai/qa/rubrics/${id}`),

    updateRubric: (id: string, body: Partial<Pick<SabChatQaRubric, 'name' | 'criteria' | 'active'>>) =>
        rustFetch<SabChatQaRubric>(`/v1/sabchat/ai/qa/rubrics/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    deleteRubric: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/ai/qa/rubrics/${id}`, { method: 'DELETE' }),

    grade: (conversationId: string, body: { rubricId: string }) =>
        rustFetch<SabChatQaScore>(`/v1/sabchat/ai/qa/grade/${conversationId}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    manualGrade: (conversationId: string, body: { rubricId: string; scores: SabChatQaScoreEntry[]; coaching?: string }) =>
        rustFetch<SabChatQaScore>(`/v1/sabchat/ai/qa/manual/${conversationId}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listScores: (q: { rubricId?: string; agentId?: string; conversationId?: string; gradedBy?: 'ai' | 'agent'; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatQaScore[]; nextCursor?: string }>(`/v1/sabchat/ai/qa/scores${qs(q)}`),

    getScore: (id: string) => rustFetch<SabChatQaScore>(`/v1/sabchat/ai/qa/scores/${id}`),

    leaderboard: (q: { rubricId?: string; from?: string; to?: string; limit?: number } = {}) =>
        rustFetch<{ items: Array<{ agentId: string; mean: number; count: number }> }>(
            `/v1/sabchat/ai/qa/leaderboard${qs(q)}`,
        ),
};
