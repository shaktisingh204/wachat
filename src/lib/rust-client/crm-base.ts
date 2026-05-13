/**
 * Generic CRM rust-client factory.
 *
 * Returns a typed `{ list, getById, create, update, delete }` client for any
 * CRM entity that follows the standard `/v1/crm/<entity>` route shape from
 * `docs/ecosystem/CRM_PLAN.md` §2.2.
 *
 * Per-entity TS clients (e.g. `crm-leads.ts`, `crm-deals.ts`) keep their
 * hand-tuned shapes for backwards-compat; this factory is for new entities
 * onboarded after the §A3 foundation lands.
 *
 * Wire-shape tolerance: Rust handlers across the workspace return slightly
 * different envelopes today — `{ items, total, page, limit }`,
 * `{ <entityKey>: [...] }`, flat `T[]`, etc. The list/get/create helpers
 * normalize all of those into a single response shape.
 */
import 'server-only';

import { rustFetch, RustApiError } from './fetcher';

/* ─── Wire types ─────────────────────────────────────────────────────── */

export interface CrmListParams {
    q?: string;
    /** 0-indexed. */
    page?: number;
    /** Defaults to 20, clamped to 100. */
    limit?: number;
    /** Arbitrary filter object — JSON-stringified into ?filter=… */
    filter?: Record<string, unknown>;
}

export interface CrmListResult<T> {
    items: T[];
    page: number;
    limit: number;
    /** Some Rust handlers omit total; left optional. */
    total?: number;
    hasMore: boolean;
}

export interface CrmCreateResult<T> {
    id: string;
    entity: T | null;
}

export interface CrmClient<TEntity, TDraft = Partial<TEntity>> {
    list(params?: CrmListParams): Promise<CrmListResult<TEntity>>;
    getById(id: string): Promise<TEntity | null>;
    create(input: TDraft): Promise<CrmCreateResult<TEntity>>;
    update(id: string, patch: Partial<TDraft>): Promise<TEntity>;
    delete(id: string): Promise<{ deleted: boolean }>;
}

/* ─── Internals ──────────────────────────────────────────────────────── */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function isUseRustCrmDisabled(): boolean {
    return process.env.USE_RUST_CRM === 'false';
}

function guard(): void {
    if (isUseRustCrmDisabled()) {
        throw new Error(
            'USE_RUST_CRM disabled — call the TS server action instead.',
        );
    }
}

function buildListQuery(params?: CrmListParams): string {
    const sp = new URLSearchParams();
    if (params?.q && params.q.trim()) sp.set('q', params.q.trim());
    if (typeof params?.page === 'number' && params.page >= 0) {
        sp.set('page', String(Math.floor(params.page)));
    }
    if (typeof params?.limit === 'number' && params.limit > 0) {
        sp.set('limit', String(Math.min(MAX_LIMIT, Math.floor(params.limit))));
    }
    if (params?.filter && Object.keys(params.filter).length > 0) {
        sp.set('filter', JSON.stringify(params.filter));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/**
 * Coerce any of the observed Rust list envelopes into a `CrmListResult`.
 *
 * Supported shapes:
 *   • `T[]`                                              — flat array
 *   • `{ items: T[], total?, page?, limit?, hasMore? }`  — canonical
 *   • `{ <entityKey>: T[], total?, page?, limit? }`      — legacy crm-deals shape
 */
function normalizeListResponse<T>(raw: unknown, fallbackLimit: number): CrmListResult<T> {
    if (Array.isArray(raw)) {
        return {
            items: raw as T[],
            page: 0,
            limit: fallbackLimit,
            total: raw.length,
            hasMore: false,
        };
    }

    if (raw && typeof raw === 'object') {
        const env = raw as Record<string, unknown>;

        if (Array.isArray(env.items)) {
            const items = env.items as T[];
            const page = typeof env.page === 'number' ? env.page : 0;
            const limit = typeof env.limit === 'number' ? env.limit : fallbackLimit;
            const total = typeof env.total === 'number' ? env.total : undefined;
            const hasMore =
                typeof env.hasMore === 'boolean'
                    ? env.hasMore
                    : typeof total === 'number'
                      ? (page + 1) * limit < total
                      : items.length === limit;
            return { items, page, limit, total, hasMore };
        }

        // Legacy: { deals: [...], total, page, limit } / { invoices: [...] } / …
        for (const value of Object.values(env)) {
            if (Array.isArray(value)) {
                const items = value as T[];
                const page = typeof env.page === 'number' ? env.page : 0;
                const limit = typeof env.limit === 'number' ? env.limit : fallbackLimit;
                const total = typeof env.total === 'number' ? env.total : undefined;
                const hasMore =
                    typeof total === 'number'
                        ? (page + 1) * limit < total
                        : items.length === limit;
                return { items, page, limit, total, hasMore };
            }
        }
    }

    // Empty / unrecognized.
    return { items: [], page: 0, limit: fallbackLimit, total: 0, hasMore: false };
}

function unwrapEntity<T>(raw: unknown): T | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'object') return raw as T;

    const env = raw as Record<string, unknown>;
    // Canonical: { data: T }
    if ('data' in env && env.data && typeof env.data === 'object') {
        return env.data as T;
    }
    // Legacy: { lead: T }, { deal: T }, etc. — single non-array top-level key
    const keys = Object.keys(env);
    if (keys.length === 1) {
        const only = env[keys[0]];
        if (only && typeof only === 'object' && !Array.isArray(only)) {
            return only as T;
        }
    }
    // Flat doc.
    return raw as T;
}

function unwrapCreateResponse<T>(raw: unknown): CrmCreateResult<T> {
    if (!raw || typeof raw !== 'object') {
        return { id: '', entity: null };
    }
    const env = raw as Record<string, unknown>;
    const id =
        (typeof env.id === 'string' && env.id) ||
        (typeof env._id === 'string' && env._id) ||
        Object.entries(env).find(
            ([k, v]) => typeof v === 'string' && /Id$/i.test(k),
        )?.[1] as string | undefined ||
        '';
    return { id: id ?? '', entity: unwrapEntity<T>(raw) };
}

/* ─── Public factory ─────────────────────────────────────────────────── */

/**
 * Build a typed client for any CRM entity that follows the standard
 * `/v1/crm/<entity>` route shape.
 *
 * @example
 *   const account = makeCrmClient<AccountDoc, AccountDraft>('/v1/crm/accounts');
 *   const page = await account.list({ q: 'acme', page: 0, limit: 20 });
 */
export function makeCrmClient<TEntity, TDraft = Partial<TEntity>>(
    entityPath: string,
): CrmClient<TEntity, TDraft> {
    const path = entityPath.endsWith('/')
        ? entityPath.slice(0, -1)
        : entityPath;

    return {
        async list(params?: CrmListParams): Promise<CrmListResult<TEntity>> {
            guard();
            const limit =
                params?.limit && params.limit > 0
                    ? Math.min(MAX_LIMIT, Math.floor(params.limit))
                    : DEFAULT_LIMIT;
            const raw = await rustFetch<unknown>(`${path}${buildListQuery(params)}`);
            return normalizeListResponse<TEntity>(raw, limit);
        },

        async getById(id: string): Promise<TEntity | null> {
            guard();
            if (!id) return null;
            try {
                const raw = await rustFetch<unknown>(`${path}/${encodeURIComponent(id)}`);
                return unwrapEntity<TEntity>(raw);
            } catch (e) {
                if (e instanceof RustApiError && e.status === 404) return null;
                throw e;
            }
        },

        async create(input: TDraft): Promise<CrmCreateResult<TEntity>> {
            guard();
            const raw = await rustFetch<unknown>(path, {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return unwrapCreateResponse<TEntity>(raw);
        },

        async update(id: string, patch: Partial<TDraft>): Promise<TEntity> {
            guard();
            const raw = await rustFetch<unknown>(`${path}/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: JSON.stringify(patch),
            });
            const entity = unwrapEntity<TEntity>(raw);
            if (!entity) {
                throw new Error('Update succeeded but response did not include entity.');
            }
            return entity;
        },

        async delete(id: string): Promise<{ deleted: boolean }> {
            guard();
            try {
                await rustFetch<unknown>(`${path}/${encodeURIComponent(id)}`, {
                    method: 'DELETE',
                });
                return { deleted: true };
            } catch (e) {
                if (e instanceof RustApiError && e.status === 404) {
                    return { deleted: false };
                }
                throw e;
            }
        },
    };
}
