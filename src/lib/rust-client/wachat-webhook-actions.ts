/**
 * Client for the user-facing Wachat webhook **actions** router on the Rust BFF.
 *
 * Mirrors the routes registered by `wachat-webhook-actions` under
 * `/v1/wachat/webhook-actions/...`:
 *
 *   GET  /logs                   → listLogs
 *   GET  /logs/:id/payload       → getPayload
 *   POST /logs/:id/reprocess     → reprocess
 *   POST /logs/clear             → clearProcessed
 *
 * The handlers themselves are reused from `wachat-webhook-config` — this
 * namespace exists so the four user-facing server actions
 * (`getWebhookLogs`, `getWebhookLogPayload`, `handleReprocessWebhook`,
 * `handleClearProcessedLogs`) have a stable mount path that is namespace-
 * separated from the legacy `/v1/wachat/webhook/admin` admin tooling.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/webhook-actions';

// ---------------------------------------------------------------------------
// DTOs (mirror the Rust side; `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Compact list-row representation for `GET /logs`.
 *
 * Mirrors `wachat_webhook_config::dto::WebhookLogSummary`. Intentionally
 * omits the (potentially large) raw `payload` — clients fetch it on
 * demand via `GET /logs/:id/payload`.
 */
export interface WebhookActionsLogSummary {
    id: string;
    projectId: string;
    field: string;
    /** `"pending" | "processed" | "failed" | "pending_reprocess"`. */
    status: string;
    /** ISO-8601 timestamp (UTC). */
    receivedAt: string;
    error?: string | null;
}

/** Response body for `GET /logs`. */
export interface WebhookActionsListLogsResp {
    logs: WebhookActionsLogSummary[];
    /**
     * Pass back as `cursor` on the next request to fetch the next (older)
     * page. `null`/absent indicates the last page.
     */
    nextCursor?: string | null;
}

/** Query parameters for `GET /logs`. All fields optional. */
export interface WebhookActionsListLogsQuery {
    /** Filter by project (Mongo ObjectId hex). */
    projectId?: string;
    /** Filter by log status. */
    status?: string;
    /** Inclusive lower bound on `receivedAt`, in unix milliseconds. */
    start?: number;
    /** Inclusive upper bound on `receivedAt`, in unix milliseconds. */
    end?: number;
    /** Page size — Rust side clamps to `[1, 100]`, default 50. */
    limit?: number;
    /** Continuation token from previous response's `nextCursor`. */
    cursor?: string;
}

/** Response body for `POST /logs/:id/reprocess`. */
export interface WebhookActionsReprocessResp {
    ok: boolean;
    logId: string;
}

/** Response body for `POST /logs/clear`. */
export interface WebhookActionsClearResp {
    /** Number of `webhook_logs` documents removed by the bulk delete. */
    deleted: number;
}

// ---------------------------------------------------------------------------
// Query helper
// ---------------------------------------------------------------------------

function qs(q: WebhookActionsListLogsQuery): string {
    const params = new URLSearchParams();
    // Server-side query DTO uses camelCase already (`#[serde(rename_all = "camelCase")]`).
    if (q.projectId) params.set('projectId', q.projectId);
    if (q.status) params.set('status', q.status);
    if (typeof q.start === 'number') params.set('start', String(q.start));
    if (typeof q.end === 'number') params.set('end', String(q.end));
    if (typeof q.limit === 'number') params.set('limit', String(q.limit));
    if (q.cursor) params.set('cursor', q.cursor);
    const s = params.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatWebhookActionsApi = {
    listLogs: (q: WebhookActionsListLogsQuery = {}) =>
        rustFetch<WebhookActionsListLogsResp>(`${BASE}/logs${qs(q)}`),

    getPayload: (logId: string) =>
        rustFetch<unknown>(
            `${BASE}/logs/${encodeURIComponent(logId)}/payload`,
        ),

    reprocess: (logId: string) =>
        rustFetch<WebhookActionsReprocessResp>(
            `${BASE}/logs/${encodeURIComponent(logId)}/reprocess`,
            { method: 'POST' },
        ),

    clearProcessed: () =>
        rustFetch<WebhookActionsClearResp>(`${BASE}/logs/clear`, {
            method: 'POST',
        }),
};

export type WachatWebhookActionsApi = typeof wachatWebhookActionsApi;
