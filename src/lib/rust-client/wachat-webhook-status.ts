/**
 * Client for the Rust **broadcast-counter** endpoint.
 *
 * The Node webhook receiver still owns the Meta payload ingress (it has
 * to — Meta calls our Next.js route to deliver the webhook). What this
 * client moves off of Node is the *side effect* the receiver performs on
 * `broadcast_contacts` / `broadcasts` after parsing a delivery status
 * batch. Those writes are the slice the Phase-9 broadcast worker port
 * needs aligned: when the BROADCAST_WORKER feature flag is `'rust'`, the
 * Rust worker increments delivery counters on send-success, and the
 * webhook side has to use the same hierarchy + field names so they don't
 * race each other into corrupt counters.
 *
 * Mirrors the Phase-9 routes registered by `wachat-webhook-status::router`:
 *
 *   POST /v1/wachat/webhook-status/broadcast-statuses → broadcastStatuses
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/webhook-status';

// ---------------------------------------------------------------------------
// Wire shapes (mirror the Rust DTOs — camelCase over the wire because every
// Rust handler uses `serde(rename_all = "camelCase")` on response types).
// ---------------------------------------------------------------------------

/**
 * Single status row going into the broadcast-counter handler.
 *
 * Subset of Meta's `value.statuses[]` payload — the Node receiver
 * forwards these verbatim after parsing. Extra fields on the original
 * payload (`recipient_id`, `errors`, etc.) are accepted by the Rust side
 * and ignored, so callers can pass through more than this if convenient.
 */
export interface WebhookBroadcastStatusInput {
    /** Meta `wamid` — matches the `broadcast_contacts.messageId` field. */
    id: string;
    /** Lowercase Meta status string (`sent` | `delivered` | `read` | `failed`). */
    status: string;
    /**
     * Unix-seconds timestamp string from Meta. Optional in the Rust DTO —
     * we don't currently store it on the broadcast_contacts row, but we
     * accept it for wire-shape parity with the underlying Meta payload.
     */
    timestamp?: string;
}

/** Aggregate write counts returned by the Rust handler. */
export interface WebhookBroadcastStatusOutcome {
    /** Number of `broadcast_contacts.status` rows that matched + applied. */
    contactsUpdated: number;
    /** Cumulative `broadcasts.deliveredCount` increments fanned out. */
    deliveredInc: number;
    /** Cumulative `broadcasts.readCount` increments fanned out. */
    readInc: number;
    /** Input wamids that did not resolve to a `broadcast_contacts` row. Normal — only a subset of webhook statuses are for broadcasts. */
    unmatched: number;
}

/** Success envelope for `POST /broadcast-statuses`. */
export interface WebhookBroadcastStatusesResponse {
    ok: boolean;
    outcome: WebhookBroadcastStatusOutcome;
}

/** Request body for `POST /broadcast-statuses`. */
export interface WebhookBroadcastStatusesBody {
    statuses: WebhookBroadcastStatusInput[];
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const wachatWebhookStatusApi = {
    /**
     * Apply broadcast-counter side effects for a Meta webhook status batch.
     *
     * Idempotent: the Rust side only updates a `broadcast_contacts.status`
     * row when the new status strictly outranks the current one, and only
     * `$inc`s `deliveredCount` / `readCount` on a crossed boundary.
     *
     * Empty `statuses` is a no-op (returns zero counts).
     */
    broadcastStatuses: (body: WebhookBroadcastStatusesBody) =>
        rustFetch<WebhookBroadcastStatusesResponse>(`${BASE}/broadcast-statuses`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

export type WachatWebhookStatusApi = typeof wachatWebhookStatusApi;
