/** TS client for `/v1/sabcatalyst/usage/*` — per-project rollups. */
import 'server-only';
import { rustFetch } from './fetcher';

export type UsagePeriod = 'daily' | 'monthly';

export interface SabcatalystUsageRow {
    _id: string;
    projectId: string;
    userId: string;
    period: UsagePeriod;
    periodKey: string;
    functionInvocations: number;
    functionBillableMs: number;
    datastoreReads: number;
    datastoreWrites: number;
    fileStorageBytes: number;
    bandwidthBytes: number;
    updatedAt: string;
}

export interface UsageRollupResponse { rows: SabcatalystUsageRow[] }

function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystUsageApi = {
    get: (params: { projectId: string; period: UsagePeriod; periodKey?: string }) =>
        rustFetch<UsageRollupResponse>(`/v1/sabcatalyst/usage/${qs(params)}`),
    increment: (body: {
        projectId: string;
        period: UsagePeriod;
        periodKey: string;
        functionInvocations?: number;
        functionBillableMs?: number;
        datastoreReads?: number;
        datastoreWrites?: number;
        fileStorageBytes?: number;
        bandwidthBytes?: number;
    }) =>
        rustFetch<{ ok: true }>('/v1/sabcatalyst/usage/increment', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};
