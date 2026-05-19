/**
 * Client for the user-scoped URL shortener on the Rust BFF.
 *
 * Mirrors `/v1/url-shortener/*` — backs the legacy `url-shortener.actions.ts`
 * server actions that drive `/dashboard/url-shortener`, plus the public
 * redirect resolver used by the root-level `[shortCode]` page.
 *
 * Server-only — uses the JWT-issuing fetcher for the user-scoped routes.
 * The redirect resolver is special-cased: it's hit from a public page with
 * no session, so it goes through `rustFetch` but the Rust handler does
 * NOT require AuthUser.
 */
import 'server-only';

import { rustFetch, rustPublicFetch, rustAdminFetch } from './fetcher';

const BASE = '/v1/url-shortener';

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------

export interface CreateShortUrlBody {
    originalUrl: string;
    alias?: string | null;
    tagIds?: string[];
    /** ISO-8601. */
    expiresAt?: string | null;
    /** `null`, `"none"`, or a custom-domain `_id` string. */
    domainId?: string | null;
    customSlug?: string;
    clickLimit?: number;
    passwordHash?: string;
    utmParams?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
    splitTargets?: { url: string; weight: number }[];
    activateAt?: string | null;
    pixelIds?: { facebook?: string; google?: string; tiktok?: string };
}

export interface BulkCreateShortUrlsBody {
    items: { originalUrl: string; alias?: string | null }[];
}

export interface DeleteManyBody {
    ids: string[];
}

export interface AddDomainBody {
    hostname: string;
}

export interface TrackClickBody {
    shortCode: string;
    hostname: string | null;
    userAgent?: string | null;
    referrer?: string | null;
    ip?: string | null;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface CreateShortUrlResult {
    message?: string;
    error?: string;
    shortUrlId?: string;
    shortCode?: string;
}

export interface BulkCreateResult {
    message?: string;
    error?: string;
}

export interface ListResult<U = unknown, D = unknown> {
    user?: unknown;
    urls: U[];
    domains: D[];
}

export interface DeleteOneResult {
    success: boolean;
    error?: string;
}

export interface DeleteManyResult {
    success: boolean;
    deleted?: number;
    error?: string;
}

export interface AddDomainResult {
    success: boolean;
    error?: string;
}

export interface VerifyDomainResult {
    success: boolean;
    error?: string;
}

export interface DeleteDomainResult {
    success: boolean;
    error?: string;
}

export interface TrackClickResult {
    originalUrl?: string | null;
    error?: string;
}

export interface UpdateShortUrlBody {
    originalUrl?: string;
    expiresAt?: string | null;
    clickLimit?: number | null;
    tagIds?: string[];
    utmParams?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string } | null;
    splitTargets?: { url: string; weight: number }[] | null;
    pixelIds?: { facebook?: string; google?: string; tiktok?: string } | null;
}

export interface VerifyPasswordBody {
    shortCode: string;
    passwordHash: string;
}

export interface VerifyPasswordResult {
    valid: boolean;
    originalUrl?: string;
    error?: string;
}

export interface AnalyticsTimelineResult {
    data: { date: string; count: number }[];
}

export interface AnalyticsGeoResult {
    data: { country: string; count: number }[];
}

export interface AnalyticsDevicesResult {
    deviceTypes: { type: string; count: number }[];
    browsers: { browser: string; count: number }[];
    os: { os: string; count: number }[];
}

export interface AnalyticsReferrersResult {
    data: { domain: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const urlShortenerApi = {
    list: <U = unknown, D = unknown>() => rustFetch<ListResult<U, D>>(`${BASE}/`),

    getOne: <T = unknown>(id: string) =>
        rustFetch<T | null>(`${BASE}/${encodeURIComponent(id)}`),

    create: (body: CreateShortUrlBody) =>
        rustFetch<CreateShortUrlResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    bulkCreate: (body: BulkCreateShortUrlsBody) =>
        rustFetch<BulkCreateResult>(`${BASE}/bulk`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /**
     * Multipart upload — Rust parses the CSV/XLSX directly via the
     * `csv` + `calamine` crates and inserts in one round-trip. The
     * caller passes a `FormData` whose `urlFile` field is the file.
     */
    bulkUpload: (formData: FormData) =>
        rustFetch<BulkCreateResult>(`${BASE}/bulk-upload`, {
            method: 'POST',
            body: formData as any,
        }),

    /** Multipart entrypoints — TS Server Actions forward FormData verbatim. */
    fromFormCreate: (formData: FormData) =>
        rustFetch<CreateShortUrlResult>(`${BASE}/from-form/create`, {
            method: 'POST',
            body: formData as any,
        }),

    fromFormAddDomain: (formData: FormData) =>
        rustFetch<AddDomainResult>(`${BASE}/from-form/add-domain`, {
            method: 'POST',
            body: formData as any,
        }),

    deleteOne: (id: string) =>
        rustFetch<DeleteOneResult>(
            `${BASE}/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),

    deleteMany: (body: DeleteManyBody) =>
        rustFetch<DeleteManyResult>(`${BASE}/delete-many`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listDomains: <T = unknown>() => rustFetch<T[]>(`${BASE}/domains`),

    addDomain: (body: AddDomainBody) =>
        rustFetch<AddDomainResult>(`${BASE}/domains`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    verifyDomain: (domainId: string) =>
        rustFetch<VerifyDomainResult>(
            `${BASE}/domains/${encodeURIComponent(domainId)}/verify`,
            { method: 'POST' },
        ),

    countForUser: () =>
        rustFetch<{ count: number }>(`${BASE}/count`),

    /** Admin-only: total number of short URLs across all users. */
    countGlobal: () =>
        rustAdminFetch<{ count: number }>(`${BASE}/admin/count-global`, {
            method: 'POST',
        }),

    deleteDomain: (domainId: string) =>
        rustFetch<DeleteDomainResult>(
            `${BASE}/domains/${encodeURIComponent(domainId)}`,
            { method: 'DELETE' },
        ),

    /**
     * Public redirect resolver — reached from `/[shortCode]/page.tsx` which
     * is a public page with no session cookie. Uses `rustPublicFetch`
     * because `rustFetch` would throw 401 without a session. The Rust
     * handler does not require AuthUser.
     */
    resolveRedirect: (body: TrackClickBody) =>
        rustPublicFetch<TrackClickResult>(`${BASE}/resolve`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    updateOne: (id: string, body: UpdateShortUrlBody) =>
        rustFetch<{ success: boolean; error?: string }>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    verifyPassword: (body: VerifyPasswordBody) =>
        rustPublicFetch<VerifyPasswordResult>(`${BASE}/verify-password`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    getAnalyticsTimeline: (id: string, days = 30) =>
        rustFetch<AnalyticsTimelineResult>(`${BASE}/${encodeURIComponent(id)}/analytics/timeline?days=${days}`),

    getAnalyticsGeo: (id: string) =>
        rustFetch<AnalyticsGeoResult>(`${BASE}/${encodeURIComponent(id)}/analytics/geo`),

    getAnalyticsDevices: (id: string) =>
        rustFetch<AnalyticsDevicesResult>(`${BASE}/${encodeURIComponent(id)}/analytics/devices`),

    getAnalyticsReferrers: (id: string) =>
        rustFetch<AnalyticsReferrersResult>(`${BASE}/${encodeURIComponent(id)}/analytics/referrers`),
};

export type UrlShortenerApi = typeof urlShortenerApi;
