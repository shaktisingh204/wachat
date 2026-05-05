/**
 * Project-domain client for the Rust BFF.
 *
 * Replaces the Mongo work in `getProjects()` / `getProjectById()`. The
 * returned shapes mirror what those server actions used to return so
 * existing call sites (layouts, switchers, page loaders) keep working
 * without changes.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type RustProjectListResponse = {
    projects: any[];
};

export type RustProjectResponse = {
    project: any | null;
};

export type RustProjectKind = 'whatsapp' | 'facebook';

export const projectsApi = {
    /**
     * `GET /v1/projects` — projects the caller owns or is an agent on.
     * Filter parity with `getProjects(query, type)`.
     */
    list: (params?: { query?: string; type?: RustProjectKind }) => {
        const search = new URLSearchParams();
        if (params?.query) search.set('query', params.query);
        if (params?.type) search.set('type', params.type);
        const qs = search.toString();
        return rustFetch<RustProjectListResponse>(
            qs ? `/v1/projects?${qs}` : '/v1/projects',
        );
    },

    /**
     * `GET /v1/projects/:id` — single project with `plan` joined and an
     * owner-or-agent access check. Returns `null` if not found / not
     * accessible (the Rust handler returns 404; we swallow it here to
     * match the legacy nullable return type).
     */
    byId: (id: string) => rustFetch<RustProjectResponse>(`/v1/projects/${id}`),
};

export type ProjectsApi = typeof projectsApi;
