/**
 * Client for the Wachat **broadcast** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/broadcast` by the
 * Phase 6 `wachat-broadcast` crate. Each method is a one-line shim
 * around {@link rustFetch} so the namespace surface stays close to the
 * OpenAPI operation IDs — when codegen replaces this file the call
 * sites won't change.
 *
 *   GET    /admin/list                                    → adminList
 *   GET    /projects/{projectId}/list                     → listForProject
 *   GET    /{broadcastId}                                 → getById
 *   GET    /{broadcastId}/attempts                        → listAttempts
 *   GET    /{broadcastId}/attempts/export                 → exportAttempts
 *   GET    /{broadcastId}/logs                            → listLogs
 *   POST   /start                                         → start
 *   POST   /bulk-start                                    → bulkStart
 *   POST   /api-start                                     → apiStart
 *   POST   /{broadcastId}/requeue                         → requeue
 *   POST   /{broadcastId}/stop                            → stop
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/broadcast';

// ---------------------------------------------------------------------------
// Wire shapes (mirror the Rust DTOs — camelCase over the wire because every
// Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/** Single contact row going into `broadcast_contacts`. */
export interface ContactRecord {
    phone: string;
    name?: string;
    /** Per-row template variables. Open-ended JSON. */
    variables?: Record<string, unknown> | null;
}

/** Pagination query for list endpoints. */
export interface PageQuery {
    page?: number;
    limit?: number;
}

/** Query for `attempts` endpoint. */
export interface AttemptsQuery {
    page?: number;
    limit?: number;
    statusFilter?: string;
}

export interface BroadcastListResponse {
    broadcasts: any[];
    total: number;
}

export interface AttemptsListResponse {
    attempts: any[];
    total: number;
}

export interface MessageResponse {
    message: string;
}

/** `broadcastType` discriminator. */
export type BroadcastKind = 'template' | 'flow';

/** `audienceType` discriminator. */
export type AudienceKind = 'file' | 'tags';

/**
 * Body for `POST /v1/wachat/broadcast/start`.
 *
 * The legacy TS server action took multipart `FormData`. The TS shim
 * parses CSV / XLSX into `contacts` and pre-uploads any header /
 * carousel media into Meta — `components` is expected to already carry
 * the resolved `media id`.
 */
export interface StartBroadcastBody {
    projectId: string;
    phoneNumberId: string;
    broadcastType: BroadcastKind;
    /** Required when `broadcastType === 'template'`. */
    templateId?: string;
    /** Required when `broadcastType === 'flow'`. */
    flowId?: string;
    audienceType: AudienceKind;
    contacts?: ContactRecord[];
    tagIds?: string[];
    fileName: string;
    messagesPerSecond?: number;
    createContacts?: boolean;
    components?: any[];
    globalBodyVars?: Record<string, string> | null;
    flowConfig?: { header?: string; body?: string; footer?: string; cta?: string } | null;
    flowName?: string;
    flowMetaId?: string;
}

/** Body for `POST /v1/wachat/broadcast/bulk-start`. */
export interface BulkBroadcastBody {
    projectIds: string[];
    templateName: string;
    language: string;
    fileName: string;
    contacts: ContactRecord[];
}

/** Body for `POST /v1/wachat/broadcast/api-start`. */
export interface ApiBroadcastBody {
    projectId: string;
    phoneNumberId: string;
    templateId: string;
    contacts: ContactRecord[];
    variableMappings?: any;
}

/** Body for `POST /v1/wachat/broadcast/{broadcastId}/requeue`. */
export interface RequeueBroadcastBody {
    requeueScope?: 'ALL' | 'FAILED';
    templateId?: string;
    headerImageUrl?: string;
}

/** Response from `POST /v1/wachat/broadcast/admin/requeue-stuck`. */
export interface RequeueStuckResponse {
    message: string;
    enqueued: number;
    considered: number;
    errors?: string[];
}

// ---------------------------------------------------------------------------
// Query helpers — keep `?page=…&limit=…` strings off the call sites.
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatBroadcastApi = {
    // ----------- READS -----------

    adminList: (q: PageQuery = {}) =>
        rustFetch<BroadcastListResponse>(
            `${BASE}/admin/list${qs({ page: q.page, limit: q.limit })}`,
        ),

    listForProject: (projectId: string, q: PageQuery = {}) =>
        rustFetch<BroadcastListResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/list${qs({ page: q.page, limit: q.limit })}`,
        ),

    getById: (broadcastId: string) =>
        rustFetch<any>(`${BASE}/${encodeURIComponent(broadcastId)}`),

    listAttempts: (broadcastId: string, q: AttemptsQuery = {}) =>
        rustFetch<AttemptsListResponse>(
            `${BASE}/${encodeURIComponent(broadcastId)}/attempts${qs({
                page: q.page,
                limit: q.limit,
                statusFilter: q.statusFilter,
            })}`,
        ),

    exportAttempts: (broadcastId: string, statusFilter?: string) =>
        rustFetch<any[]>(
            `${BASE}/${encodeURIComponent(broadcastId)}/attempts/export${qs({ statusFilter })}`,
        ),

    listLogs: (broadcastId: string) =>
        rustFetch<any[]>(`${BASE}/${encodeURIComponent(broadcastId)}/logs`),

    // ----------- MUTATIONS -----------

    start: (body: StartBroadcastBody) =>
        rustFetch<MessageResponse>(`${BASE}/start`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    bulkStart: (body: BulkBroadcastBody) =>
        rustFetch<MessageResponse>(`${BASE}/bulk-start`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    apiStart: (body: ApiBroadcastBody) =>
        rustFetch<MessageResponse>(`${BASE}/api-start`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    requeue: (broadcastId: string, body: RequeueBroadcastBody) =>
        rustFetch<MessageResponse>(
            `${BASE}/${encodeURIComponent(broadcastId)}/requeue`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    stop: (broadcastId: string) =>
        rustFetch<MessageResponse>(`${BASE}/${encodeURIComponent(broadcastId)}/stop`, {
            method: 'POST',
        }),

    /**
     * Admin-only sweep that re-enqueues broadcasts stuck in
     * `PENDING_PROCESSING` / `QUEUED`. The Next.js cron route at
     * `/api/cron/send-broadcasts` proxies straight through to this.
     */
    requeueStuck: () =>
        rustFetch<RequeueStuckResponse>(`${BASE}/admin/requeue-stuck`, {
            method: 'POST',
        }),
};

export type WachatBroadcastApi = typeof wachatBroadcastApi;
