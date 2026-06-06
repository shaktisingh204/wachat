/**
 * Client for the Wachat **setup knowledge-base** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/setup-kb` by the
 * `wachat-setup-kb` crate (backs the `/wachat/setup/docs` page's KB):
 *
 *   GET    /articles               → listArticles  (q / category / sort)
 *   POST   /articles               → createArticle
 *   PUT    /articles/{articleId}   → updateArticle
 *   DELETE /articles/{articleId}   → deleteArticle
 *
 * KB articles are **global** content (collection `wa_setup_kb_articles`, no
 * per-tenant scoping): any authenticated caller reads every article; writes
 * just require auth.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/setup-kb';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Query for `GET /v1/wachat/setup-kb/articles`.
 *
 * - `q` — case-insensitive substring match over `title` + `content`.
 * - `category` — exact match (e.g. `setup` | `troubleshooting` | `best-practices`);
 *   `all` / empty is treated as "no filter" by the Rust handler.
 * - `sort` — `date-desc` (default) | `date-asc` | `title-asc` | `title-desc`.
 */
export interface ListArticlesQuery {
    q?: string;
    category?: string;
    sort?: string;
}

/**
 * Body for `POST /articles` (create) and `PUT /articles/{articleId}` (update).
 * All three fields are required and trimmed/validated by the Rust handler.
 */
export interface ArticleBody {
    /** Article headline. */
    title: string;
    /** Article body / markdown text. */
    content: string;
    /** Bucket (e.g. `setup`, `troubleshooting`, `best-practices`). */
    category: string;
}

/**
 * A KB article as returned by the Rust handlers (a cleaned Mongo document:
 * `_id` rendered as a plain hex string, dates as ISO-8601 strings). Extra
 * fields may be present on stored docs, hence the index signature.
 */
export interface SetupKbArticle {
    _id: string;
    title: string;
    content: string;
    category: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}

/** Response for `GET /v1/wachat/setup-kb/articles`. */
export interface ListArticlesResponse {
    articles: SetupKbArticle[];
}

/** `{ success: true }` envelope returned by PUT / DELETE. */
export interface SetupKbSuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

function buildArticlesQuery(query?: ListArticlesQuery): string {
    if (!query) return '';
    const params = new URLSearchParams();
    if (query.q && query.q.trim()) params.set('q', query.q.trim());
    if (query.category && query.category.trim()) params.set('category', query.category.trim());
    if (query.sort && query.sort.trim()) params.set('sort', query.sort.trim());
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

export const wachatSetupKbApi = {
    listArticles: (query?: ListArticlesQuery) =>
        rustFetch<ListArticlesResponse>(`${BASE}/articles${buildArticlesQuery(query)}`),

    createArticle: (body: ArticleBody) =>
        rustFetch<SetupKbArticle>(`${BASE}/articles`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    updateArticle: (articleId: string, body: ArticleBody) =>
        rustFetch<SetupKbSuccessResponse>(
            `${BASE}/articles/${encodeURIComponent(articleId)}`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),

    deleteArticle: (articleId: string) =>
        rustFetch<SetupKbSuccessResponse>(
            `${BASE}/articles/${encodeURIComponent(articleId)}`,
            { method: 'DELETE' },
        ),
};

export type WachatSetupKbApi = typeof wachatSetupKbApi;
