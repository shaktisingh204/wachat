/** TS client for `/v1/sabcatalyst/functions/*`. */
import 'server-only';
import { rustFetch } from './fetcher';

export type FunctionKind = 'http' | 'cron' | 'event' | 'queue';
export type FunctionRuntime = 'nodejs20' | 'python311' | 'deno' | 'bun';
export type FunctionStatus = 'active' | 'paused';

export interface SabcatalystFunction {
    _id: string;
    projectId: string;
    userId: string;
    name: string;
    kind: FunctionKind;
    runtime: FunctionRuntime;
    codeBlobFileId?: string;
    entrypoint: string;
    envVarsJson?: Record<string, unknown>;
    timeoutMs: number;
    memoryMb: number;
    schedule?: string;
    lastDeployedAt?: string;
    status: FunctionStatus;
    createdAt: string;
    updatedAt: string;
}

export interface ListFunctionsResponse { items: SabcatalystFunction[]; nextCursor?: string }

export interface CreateFunctionInput {
    projectId: string;
    name: string;
    kind?: FunctionKind;
    runtime?: FunctionRuntime;
    codeBlobFileId?: string;
    entrypoint: string;
    envVarsJson?: Record<string, unknown>;
    timeoutMs?: number;
    memoryMb?: number;
    schedule?: string;
}

export interface UpdateFunctionInput {
    name?: string;
    codeBlobFileId?: string;
    entrypoint?: string;
    envVarsJson?: Record<string, unknown>;
    timeoutMs?: number;
    memoryMb?: number;
    schedule?: string;
    status?: FunctionStatus;
}

function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystFunctionsApi = {
    list: (params: { projectId: string; kind?: FunctionKind; limit?: number; cursor?: string }) =>
        rustFetch<ListFunctionsResponse>(`/v1/sabcatalyst/functions/${qs(params)}`),
    get: (id: string) => rustFetch<SabcatalystFunction>(`/v1/sabcatalyst/functions/${id}`),
    create: (body: CreateFunctionInput) =>
        rustFetch<SabcatalystFunction>('/v1/sabcatalyst/functions/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    update: (id: string, body: UpdateFunctionInput) =>
        rustFetch<SabcatalystFunction>(`/v1/sabcatalyst/functions/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    markDeployed: (id: string, codeBlobFileId: string) =>
        rustFetch<SabcatalystFunction>(`/v1/sabcatalyst/functions/${id}/deployed`, {
            method: 'POST',
            body: JSON.stringify({ codeBlobFileId }),
        }),
    delete: (id: string) =>
        rustFetch<void>(`/v1/sabcatalyst/functions/${id}`, { method: 'DELETE' }),
};
