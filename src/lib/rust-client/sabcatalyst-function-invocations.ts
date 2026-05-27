/** TS client for `/v1/sabcatalyst/function-invocations/*`. */
import 'server-only';
import { rustFetch } from './fetcher';

export type InvocationStatus = 'success' | 'error' | 'timeout';

export interface SabcatalystFunctionInvocation {
    _id: string;
    functionId: string;
    projectId: string;
    userId: string;
    ts: string;
    durationMs: number;
    status: InvocationStatus;
    requestSizeBytes: number;
    responseSizeBytes: number;
    errorMessage?: string;
    billableMs: number;
}

export interface ListInvocationsResponse {
    items: SabcatalystFunctionInvocation[];
    nextCursor?: string;
}

export interface RecordInvocationInput {
    functionId: string;
    projectId: string;
    durationMs: number;
    status: InvocationStatus;
    requestSizeBytes: number;
    responseSizeBytes: number;
    errorMessage?: string;
    billableMs: number;
}

function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystInvocationsApi = {
    list: (params: { functionId: string; limit?: number; cursor?: string }) =>
        rustFetch<ListInvocationsResponse>(`/v1/sabcatalyst/function-invocations/${qs(params)}`),
    record: (body: RecordInvocationInput) =>
        rustFetch<SabcatalystFunctionInvocation>('/v1/sabcatalyst/function-invocations/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};
