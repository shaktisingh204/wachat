/**
 * TS client for `/v1/sabcatalyst/projects/*` — top-level SabCatalyst
 * tenancy unit. See `rust/crates/sabcatalyst-projects`.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type ProjectStatus = 'active' | 'paused' | 'deleted';
export type ProjectRuntime = 'nodejs20' | 'python311' | 'deno' | 'bun';

export interface SabcatalystProject {
    _id: string;
    userId: string;
    name: string;
    slug: string;
    description?: string;
    status: ProjectStatus;
    region?: string;
    runtime: ProjectRuntime;
    createdAt: string;
    updatedAt: string;
}

export interface ListProjectsResponse {
    items: SabcatalystProject[];
    nextCursor?: string;
}

export interface CreateProjectInput {
    name: string;
    slug: string;
    description?: string;
    region?: string;
    runtime?: ProjectRuntime;
}

export interface UpdateProjectInput {
    name?: string;
    description?: string;
    status?: ProjectStatus;
    region?: string;
    runtime?: ProjectRuntime;
}

function qs(params: Record<string, string | number | undefined | null>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystProjectsApi = {
    list: (params: { q?: string; limit?: number; cursor?: string } = {}) =>
        rustFetch<ListProjectsResponse>(`/v1/sabcatalyst/projects/${qs(params)}`),
    get: (id: string) => rustFetch<SabcatalystProject>(`/v1/sabcatalyst/projects/${id}`),
    create: (body: CreateProjectInput) =>
        rustFetch<SabcatalystProject>('/v1/sabcatalyst/projects/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    update: (id: string, body: UpdateProjectInput) =>
        rustFetch<SabcatalystProject>(`/v1/sabcatalyst/projects/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    delete: (id: string) =>
        rustFetch<void>(`/v1/sabcatalyst/projects/${id}`, { method: 'DELETE' }),
};
