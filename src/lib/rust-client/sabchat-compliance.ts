/**
 * Client for `/v1/sabchat/compliance/*` — GDPR / DPDP / CCPA toolkit.
 * Owns DSR (data-subject-request) CRUD + run, retention rules CRUD +
 * sweep, and a one-off PII redactor utility. Owned by the
 * `sabchat-compliance` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatDsrKind = 'export' | 'delete';
export type SabChatDsrStatus = 'pending' | 'running' | 'done' | 'failed';

export interface SabChatDsrRequest {
    _id: string;
    tenantId: string;
    contactId: string;
    kind: SabChatDsrKind;
    status: SabChatDsrStatus;
    payloadId?: string;
    requestedBy?: string;
    error?: string;
    createdAt: string;
    completedAt?: string;
}

export interface SabChatRetentionRule {
    _id: string;
    tenantId: string;
    name: string;
    target: string;
    olderThanDays: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatRetentionSweepReport {
    items: Array<{ ruleId: string; target: string; deleted: number }>;
    totalDeleted: number;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatComplianceApi = {
    createDsr: (body: { contactId: string; kind: SabChatDsrKind }) =>
        rustFetch<SabChatDsrRequest>('/v1/sabchat/compliance/dsr', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listDsr: (q: { contactId?: string; kind?: SabChatDsrKind; status?: SabChatDsrStatus; limit?: number; cursor?: string } = {}) =>
        rustFetch<{ items: SabChatDsrRequest[]; nextCursor?: string }>(`/v1/sabchat/compliance/dsr${qs(q)}`),

    getDsr: (id: string) => rustFetch<SabChatDsrRequest>(`/v1/sabchat/compliance/dsr/${id}`),

    runDsr: (id: string) =>
        rustFetch<SabChatDsrRequest>(`/v1/sabchat/compliance/dsr/${id}/run`, { method: 'POST' }),

    createRetention: (body: { name: string; target: string; olderThanDays: number; active?: boolean }) =>
        rustFetch<SabChatRetentionRule>('/v1/sabchat/compliance/retention', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listRetention: (q: { active?: boolean } = {}) =>
        rustFetch<{ items: SabChatRetentionRule[] }>(`/v1/sabchat/compliance/retention${qs(q)}`),

    updateRetention: (id: string, body: Partial<Pick<SabChatRetentionRule, 'name' | 'target' | 'olderThanDays' | 'active'>>) =>
        rustFetch<SabChatRetentionRule>(`/v1/sabchat/compliance/retention/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    deleteRetention: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/compliance/retention/${id}`, { method: 'DELETE' }),

    sweepRetention: () =>
        rustFetch<SabChatRetentionSweepReport>('/v1/sabchat/compliance/retention/sweep', { method: 'POST' }),

    redactText: (body: { text: string }) =>
        rustFetch<{ redacted: string }>('/v1/sabchat/compliance/redact-text', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};
