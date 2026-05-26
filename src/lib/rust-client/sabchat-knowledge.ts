/**
 * Client for the SabKnow knowledge-base Rust crate (`sabchat-knowledge`).
 *
 * Mirrors the routes mounted under `/v1/sabchat/kb`:
 *   /portals          → portal CRUD (one knowledge portal per brand)
 *   /categories       → category CRUD (nested via parentId, sorted by sortOrder)
 *   /articles         → article CRUD + publish/archive lifecycle
 *
 * Server-only — the JWT-issuing fetcher must never reach the browser bundle.
 */
import 'server-only';

import { rustFetch } from './fetcher';

// ---------------------------------------------------------------------------
// Wire types — mirror the Rust DTOs (every Rust handler is camelCase).
// ---------------------------------------------------------------------------

export interface KbPortalTheme {
    color?: string;
}

export interface KbPortal {
    _id: string;
    tenantId: string;
    name: string;
    slug: string;
    defaultLanguage: string;
    theme?: KbPortalTheme;
    customDomain?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface KbCategory {
    _id: string;
    tenantId: string;
    portalId: string;
    name: string;
    slug: string;
    parentId?: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export type KbArticleStatus = 'draft' | 'published' | 'archived';

export interface KbArticle {
    _id: string;
    tenantId: string;
    portalId: string;
    categoryId?: string;
    title: string;
    slug: string;
    body: string;
    tags: string[];
    language: string;
    status: KbArticleStatus;
    authorId?: string;
    publishedAt?: string;
    viewCount: number;
    helpfulCount: number;
    notHelpfulCount: number;
    createdAt: string;
    updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Portals
// ---------------------------------------------------------------------------

export const sabchatKbPortalsApi = {
    list: () => rustFetch<{ items: KbPortal[] }>('/v1/sabchat/kb/portals'),

    create: (
        body: Pick<KbPortal, 'name' | 'slug' | 'defaultLanguage'> & {
            theme?: KbPortalTheme;
            customDomain?: string;
        },
    ) =>
        rustFetch<KbPortal>('/v1/sabchat/kb/portals', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    get: (id: string) => rustFetch<KbPortal>(`/v1/sabchat/kb/portals/${id}`),

    update: (id: string, body: Partial<KbPortal>) =>
        rustFetch<KbPortal>(`/v1/sabchat/kb/portals/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/kb/portals/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const sabchatKbCategoriesApi = {
    list: (q: { portalId?: string; parentId?: string } = {}) =>
        rustFetch<{ items: KbCategory[] }>(`/v1/sabchat/kb/categories${qs(q)}`),

    create: (
        body: Pick<KbCategory, 'portalId' | 'name' | 'slug'> & {
            parentId?: string;
            sortOrder?: number;
        },
    ) =>
        rustFetch<KbCategory>('/v1/sabchat/kb/categories', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    get: (id: string) => rustFetch<KbCategory>(`/v1/sabchat/kb/categories/${id}`),

    update: (id: string, body: Partial<KbCategory>) =>
        rustFetch<KbCategory>(`/v1/sabchat/kb/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/kb/categories/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export interface ListArticlesQuery {
    portalId?: string;
    categoryId?: string;
    status?: KbArticleStatus;
    q?: string;
    language?: string;
    limit?: number;
    cursor?: string;
}

export const sabchatKbArticlesApi = {
    list: (q: ListArticlesQuery = {}) =>
        rustFetch<{ items: KbArticle[]; nextCursor?: string }>(
            `/v1/sabchat/kb/articles${qs(q)}`,
        ),

    create: (
        body: Pick<KbArticle, 'portalId' | 'title' | 'slug' | 'body' | 'language'> & {
            categoryId?: string;
            tags?: string[];
            status?: KbArticleStatus;
            authorId?: string;
        },
    ) =>
        rustFetch<KbArticle>('/v1/sabchat/kb/articles', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    get: (id: string) => rustFetch<KbArticle>(`/v1/sabchat/kb/articles/${id}`),

    update: (
        id: string,
        body: Partial<
            Pick<
                KbArticle,
                'title' | 'slug' | 'body' | 'tags' | 'language' | 'categoryId' | 'status'
            >
        >,
    ) =>
        rustFetch<KbArticle>(`/v1/sabchat/kb/articles/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/kb/articles/${id}`, { method: 'DELETE' }),

    publish: (id: string) =>
        rustFetch<KbArticle>(`/v1/sabchat/kb/articles/${id}/publish`, { method: 'POST' }),

    archive: (id: string) =>
        rustFetch<KbArticle>(`/v1/sabchat/kb/articles/${id}/archive`, { method: 'POST' }),
};

// ---------------------------------------------------------------------------
// Aggregate namespace
// ---------------------------------------------------------------------------

export const sabchatKbApi = {
    portals: sabchatKbPortalsApi,
    categories: sabchatKbCategoriesApi,
    articles: sabchatKbArticlesApi,
};

export type SabchatKbApi = typeof sabchatKbApi;
