/**
 * SabCliq Workspaces — TS client for `/v1/sabcliq/workspaces`.
 *
 * Mirrors `rust/crates/sabcliq-workspaces/src/dto.rs` + `types.rs`.
 * Workspaces are the top-level tenant grouping; every channel /
 * message / huddle lives under exactly one workspace.
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';

/* ─── Wire types (mirror Rust DTOs — camelCase) ────────────────────── */

export interface SabcliqWorkspace {
    _id?: string;
    userId: string;
    name: string;
    icon?: string;
    /** `"active"` | `"archived"` */
    status: string;
    description?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabcliqWorkspaceDraft {
    name: string;
    icon?: string;
    description?: string;
    status?: string;
}

export interface SabcliqWorkspacePatch {
    name?: string;
    icon?: string;
    description?: string;
    status?: string;
}

export interface SabcliqListParams {
    q?: string;
    page?: number;
    limit?: number;
    status?: 'active' | 'archived' | 'all';
}

export interface SabcliqListResult<T> {
    items: T[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface SabcliqCreateResult<T> {
    id: string;
    entity: T;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const BASE = '/v1/sabcliq/workspaces';

function buildQuery(params?: Record<string, unknown>): string {
    if (!params) return '';
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/* ─── Public API ───────────────────────────────────────────────────── */

export const sabcliqWorkspacesApi = {
    async list(
        params?: SabcliqListParams,
    ): Promise<SabcliqListResult<SabcliqWorkspace>> {
        return rustFetch<SabcliqListResult<SabcliqWorkspace>>(
            `${BASE}${buildQuery(params)}`,
        );
    },

    async getById(id: string): Promise<SabcliqWorkspace | null> {
        if (!id) return null;
        try {
            return await rustFetch<SabcliqWorkspace>(
                `${BASE}/${encodeURIComponent(id)}`,
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },

    async create(
        input: SabcliqWorkspaceDraft,
    ): Promise<SabcliqCreateResult<SabcliqWorkspace>> {
        return rustFetch<SabcliqCreateResult<SabcliqWorkspace>>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    async update(
        id: string,
        patch: SabcliqWorkspacePatch,
    ): Promise<SabcliqWorkspace> {
        return rustFetch<SabcliqWorkspace>(
            `${BASE}/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        );
    },

    async delete(id: string): Promise<{ deleted: boolean }> {
        try {
            return await rustFetch<{ deleted: boolean }>(
                `${BASE}/${encodeURIComponent(id)}`,
                { method: 'DELETE' },
            );
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { deleted: false };
            }
            throw e;
        }
    },
};
