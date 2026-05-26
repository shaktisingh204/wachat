/**
 * Client for `/v1/sabchat/dispositions/*` — tenant-defined close-reason
 * catalogue + apply endpoint + per-code stats. Owned by the
 * `sabchat-dispositions` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatDisposition {
    _id: string;
    tenantId: string;
    code: string;
    label: string;
    parentCode?: string;
    color?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatDispositionStat {
    code: string;
    label: string;
    count: number;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatDispositionsApi = {
    create: (body: { code: string; label: string; parentCode?: string; color?: string }) =>
        rustFetch<SabChatDisposition>('/v1/sabchat/dispositions/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: (q: { active?: boolean; parentCode?: string } = {}) =>
        rustFetch<{ items: SabChatDisposition[] }>(`/v1/sabchat/dispositions/${qs(q)}`),

    get: (id: string) => rustFetch<SabChatDisposition>(`/v1/sabchat/dispositions/${id}`),

    update: (id: string, body: Partial<Pick<SabChatDisposition, 'label' | 'parentCode' | 'color' | 'active'>>) =>
        rustFetch<SabChatDisposition>(`/v1/sabchat/dispositions/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/dispositions/${id}`, { method: 'DELETE' }),

    apply: (conversationId: string, body: { code: string; note?: string; alsoResolve?: boolean }) =>
        rustFetch<{ ok: boolean; conversationId: string }>(
            `/v1/sabchat/dispositions/apply/${conversationId}`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    stats: (q: { from?: string; to?: string } = {}) =>
        rustFetch<{ items: SabChatDispositionStat[] }>(`/v1/sabchat/dispositions/stats${qs(q)}`),
};
