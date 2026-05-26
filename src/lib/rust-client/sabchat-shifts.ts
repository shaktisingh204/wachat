/**
 * Client for `/v1/sabchat/shifts/*` — HRM-aware shift presence rules
 * + sync + preview owned by the `sabchat-shifts` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatShiftRule {
    _id: string;
    tenantId: string;
    name: string;
    teamId?: string;
    inboxId?: string;
    timezone?: string;
    presentStatus?: string;
    absentStatus?: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatShiftSyncReport {
    scanned: number;
    updated: number;
    skipped: number;
    errors: number;
    details?: Array<{ agentId: string; status: string; reason?: string }>;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatShiftsApi = {
    createRule: (body: Partial<Omit<SabChatShiftRule, '_id' | 'tenantId' | 'createdAt' | 'updatedAt'>> & { name: string }) =>
        rustFetch<SabChatShiftRule>('/v1/sabchat/shifts/rules', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listRules: () => rustFetch<{ items: SabChatShiftRule[] }>('/v1/sabchat/shifts/rules'),

    getRule: (id: string) => rustFetch<SabChatShiftRule>(`/v1/sabchat/shifts/rules/${id}`),

    updateRule: (id: string, body: Partial<Omit<SabChatShiftRule, '_id' | 'tenantId' | 'createdAt' | 'updatedAt'>>) =>
        rustFetch<SabChatShiftRule>(`/v1/sabchat/shifts/rules/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    deleteRule: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/shifts/rules/${id}`, { method: 'DELETE' }),

    sync: (body: { ruleId?: string; dryRun?: boolean } = {}) =>
        rustFetch<SabChatShiftSyncReport>('/v1/sabchat/shifts/sync', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    preview: (q: { agentId: string; ruleId?: string }) =>
        rustFetch<{ agentId: string; resolvedStatus: string; reason?: string }>(
            `/v1/sabchat/shifts/preview${qs(q)}`,
        ),
};
