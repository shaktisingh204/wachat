import 'server-only';

import { rustFetch } from './fetcher';
import type { SabopsOs } from './sabops-endpoints';
import type { SabopsPatchSeverity } from './sabops-patches';

export type SabopsPolicyAction = 'auto_install' | 'notify' | 'defer';

export interface SabopsPolicyTargetSelector {
    os?: SabopsOs;
    tags?: string[];
    endpointIds?: string[];
}

export interface SabopsPolicySchedule {
    kind: 'cron' | 'maintenance_window';
    config: Record<string, unknown>;
}

export interface SabopsPatchPolicyDoc {
    _id?: string;
    userId: string;
    name: string;
    targetSelector: SabopsPolicyTargetSelector;
    schedule: SabopsPolicySchedule;
    action: SabopsPolicyAction;
    severityFilter?: SabopsPatchSeverity;
    enabled: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface SabopsPatchPolicyCreateInput {
    name: string;
    targetSelector: SabopsPolicyTargetSelector;
    schedule: SabopsPolicySchedule;
    action: SabopsPolicyAction;
    severityFilter?: SabopsPatchSeverity;
    enabled?: boolean;
}

export type SabopsPatchPolicyUpdateInput = Partial<SabopsPatchPolicyCreateInput>;

export interface SabopsPolicyListParams {
    q?: string;
    page?: number;
    limit?: number;
    enabled?: boolean;
}

export interface SabopsPolicyListResult {
    items: SabopsPatchPolicyDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

function qs(p: SabopsPolicyListParams): string {
    const sp = new URLSearchParams();
    if (p.q) sp.set('q', p.q);
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (typeof p.enabled === 'boolean') sp.set('enabled', String(p.enabled));
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const patchPoliciesApi = {
    list(params: SabopsPolicyListParams = {}): Promise<SabopsPolicyListResult> {
        return rustFetch(`/v1/sabops/patch-policies${qs(params)}`);
    },
    create(
        input: SabopsPatchPolicyCreateInput,
    ): Promise<{ id: string; entity: SabopsPatchPolicyDoc }> {
        return rustFetch(`/v1/sabops/patch-policies`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    update(id: string, patch: SabopsPatchPolicyUpdateInput): Promise<SabopsPatchPolicyDoc> {
        return rustFetch(`/v1/sabops/patch-policies/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch(`/v1/sabops/patch-policies/${id}`, { method: 'DELETE' });
    },
    apply(id: string): Promise<{ matchedEndpoints: number; policyId: string }> {
        return rustFetch(`/v1/sabops/patch-policies/${id}/apply`, { method: 'POST' });
    },
};
