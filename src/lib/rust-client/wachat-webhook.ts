/**
 * Client for the wachat-webhook admin endpoints (Rust BFF).
 *
 * Mirrors the routes registered by `wachat-webhook-config` under
 * `/v1/wachat/webhook/admin/...`:
 *   GET  /admin/logs            → list_logs
 *   GET  /admin/logs/{id}/payload → get_payload
 *   POST /admin/logs/{id}/reprocess → reprocess
 *   POST /admin/logs/clear      → clear_processed
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface WebhookLogSummary {
    id: string;
    projectId: string;
    field: string;
    status: string;
    receivedAt: string;
    error?: string | null;
}

export interface ListLogsResp {
    logs: WebhookLogSummary[];
    nextCursor?: string | null;
}

export interface ListLogsQuery {
    projectId?: string;
    status?: string;
    start?: number;
    end?: number;
    limit?: number;
    cursor?: string;
}

const ADMIN_BASE = '/v1/wachat/webhook/admin';

function qs(q: ListLogsQuery): string {
    const params = new URLSearchParams();
    if (q.projectId) params.set('project_id', q.projectId);
    if (q.status) params.set('status', q.status);
    if (typeof q.start === 'number') params.set('start', String(q.start));
    if (typeof q.end === 'number') params.set('end', String(q.end));
    if (typeof q.limit === 'number') params.set('limit', String(q.limit));
    if (q.cursor) params.set('cursor', q.cursor);
    const s = params.toString();
    return s ? `?${s}` : '';
}

export const wachatWebhookApi = {
    listLogs: (q: ListLogsQuery = {}) =>
        rustFetch<ListLogsResp>(`${ADMIN_BASE}/logs${qs(q)}`),

    getPayload: (logId: string) =>
        rustFetch<unknown>(`${ADMIN_BASE}/logs/${encodeURIComponent(logId)}/payload`),

    reprocess: (logId: string) =>
        rustFetch<{ ok: boolean; logId: string }>(
            `${ADMIN_BASE}/logs/${encodeURIComponent(logId)}/reprocess`,
            { method: 'POST' },
        ),

    clearProcessed: () =>
        rustFetch<{ deleted: number }>(`${ADMIN_BASE}/logs/clear`, { method: 'POST' }),
};

export type WachatWebhookApi = typeof wachatWebhookApi;
