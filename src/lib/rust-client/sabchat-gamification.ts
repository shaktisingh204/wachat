/**
 * Client for `/v1/sabchat/gamification/*` — badge catalogue, manual
 * award, leaderboard, per-agent badges & stats, and admin recompute.
 * Owned by the `sabchat-gamification` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatBadge {
    _id: string;
    tenantId: string;
    code: string;
    label: string;
    description?: string;
    iconUrl?: string;
    points: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatAgentBadge {
    _id: string;
    tenantId: string;
    agentId: string;
    badgeCode: string;
    awardedAt: string;
    reason?: string;
}

export interface SabChatLeaderboardRow {
    agentId: string;
    points: number;
    resolvedCount: number;
    csatMean?: number;
    badges: number;
}

export interface SabChatAgentStats {
    agentId: string;
    period: string;
    resolvedCount: number;
    firstResponseMeanS?: number;
    csatMean?: number;
    points: number;
    badges: SabChatAgentBadge[];
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatGamificationApi = {
    createBadge: (body: { code: string; label: string; description?: string; iconUrl?: string; points?: number }) =>
        rustFetch<SabChatBadge>('/v1/sabchat/gamification/badges', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listBadges: (q: { active?: boolean } = {}) =>
        rustFetch<{ items: SabChatBadge[] }>(`/v1/sabchat/gamification/badges${qs(q)}`),

    updateBadge: (id: string, body: Partial<Pick<SabChatBadge, 'label' | 'description' | 'iconUrl' | 'points' | 'active'>>) =>
        rustFetch<SabChatBadge>(`/v1/sabchat/gamification/badges/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    deleteBadge: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/gamification/badges/${id}`, { method: 'DELETE' }),

    award: (body: { agentId: string; badgeCode: string; reason?: string }) =>
        rustFetch<SabChatAgentBadge>('/v1/sabchat/gamification/award', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    leaderboard: (q: { period?: string; limit?: number; since?: string } = {}) =>
        rustFetch<{ items: SabChatLeaderboardRow[] }>(`/v1/sabchat/gamification/leaderboard${qs(q)}`),

    agentBadges: (agentId: string) =>
        rustFetch<{ items: SabChatAgentBadge[] }>(`/v1/sabchat/gamification/agents/${agentId}/badges`),

    agentStats: (agentId: string, q: { period?: string } = {}) =>
        rustFetch<SabChatAgentStats>(`/v1/sabchat/gamification/agents/${agentId}/stats${qs(q)}`),

    recompute: (body: { period?: string } = {}) =>
        rustFetch<{ updated: number }>('/v1/sabchat/gamification/recompute', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};
