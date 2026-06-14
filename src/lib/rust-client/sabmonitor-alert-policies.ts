import 'server-only';

import { rustFetch } from './fetcher';

export type SabmonitorAlertChannelKind = 'email' | 'sms' | 'webhook' | 'slack';

export interface SabmonitorAlertChannel {
    kind: SabmonitorAlertChannelKind;
    config: Record<string, unknown>;
}

export interface SabmonitorAlertConditions {
    downCount?: number;
    slowMs?: number;
    sslExpiringDays?: number;
}

export interface SabmonitorAlertPolicyDoc {
    _id?: string;
    userId: string;
    name: string;
    checkIds?: string[];
    tagSelector?: string;
    conditions: SabmonitorAlertConditions;
    channels: SabmonitorAlertChannel[];
    escalateAfterMin?: number;
    escalateTo?: SabmonitorAlertChannel[];
    status: 'active' | 'paused';
    createdAt: string;
    updatedAt?: string;
}

export interface SabmonitorAlertPolicyCreateInput {
    name: string;
    checkIds?: string[];
    tagSelector?: string;
    conditions?: SabmonitorAlertConditions;
    channels?: SabmonitorAlertChannel[];
    escalateAfterMin?: number;
    escalateTo?: SabmonitorAlertChannel[];
    status?: 'active' | 'paused';
}

const BASE = '/v1/sabmonitor/alert-policies';

export const sabmonitorAlertPolicyApi = {
    async list(params?: { page?: number; limit?: number }) {
        const sp = new URLSearchParams();
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorAlertPolicyDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async getById(id: string) {
        try {
            return await rustFetch<SabmonitorAlertPolicyDoc>(`${BASE}/${id}`);
        } catch {
            return null;
        }
    },
    async create(input: SabmonitorAlertPolicyCreateInput) {
        return rustFetch<{ id: string; entity: SabmonitorAlertPolicyDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async update(id: string, patch: Partial<SabmonitorAlertPolicyCreateInput>) {
        return rustFetch<SabmonitorAlertPolicyDoc>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    async delete(id: string) {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
};
