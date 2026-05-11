/**
 * Client for the `telegram-webhooks` Rust crate.
 *
 * Mirrors the routes registered under `/v1/telegram/webhooks`. Each method
 * is a thin wrapper around {@link rustFetch} and returns the same
 * `{ success, error?, message?, … }` envelope shape the Rust handlers
 * return.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/webhooks';

// ---------------------------------------------------------------------------
//  Wire shapes
// ---------------------------------------------------------------------------

export interface WebhookAckResult {
    success: boolean;
    error?: string;
    message?: string;
    subscriptionId?: string;
    deliveryId?: string;
    dlqId?: string;
}

export interface WebhookSubscriptionRow {
    _id: string;
    projectId: string;
    botId: string;
    botUsername?: string;
    url: string;
    secretToken?: string;
    allowedUpdates: string[];
    maxConnections: number;
    dropPendingUpdates: boolean;
    ipAddress?: string;
    lastSetAt?: string;
    lastTelegramErrorMessage?: string;
    pendingUpdateCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface ListSubscriptionsResp {
    subscriptions: WebhookSubscriptionRow[];
    error?: string;
}

export interface TelegramWebhookInfo {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
    last_error_date?: number;
    max_connections?: number;
    ip_address?: string;
    allowed_updates?: string[];
    has_custom_certificate?: boolean;
}

export interface GetSubscriptionResp {
    subscription?: WebhookSubscriptionRow;
    webhookInfo?: TelegramWebhookInfo;
    error?: string;
}

export interface PutSubscriptionBody {
    projectId: string;
    url: string;
    secretToken?: string;
    allowedUpdates?: string[];
    maxConnections?: number;
    dropPendingUpdates?: boolean;
    ipAddress?: string;
}

export interface DeleteSubscriptionBody {
    projectId: string;
    dropPendingUpdates?: boolean;
}

export interface TestSubscriptionResp {
    success: boolean;
    error?: string;
    webhookInfo?: TelegramWebhookInfo;
}

// -- Deliveries -------------------------------------------------------------

export type DeliveryStatus = 'received' | 'processed' | 'failed';

export interface WebhookDeliveryRow {
    _id: string;
    projectId: string;
    botId: string;
    receivedAt: string;
    updateId: number;
    eventType: string;
    chatId?: string;
    fromUserId?: string;
    status: DeliveryStatus;
    processingDurationMs?: number;
    errorMessage?: string;
    payload?: unknown;
    replayedFrom?: string;
}

export interface ListDeliveriesQuery {
    projectId: string;
    botId?: string;
    eventType?: string;
    status?: DeliveryStatus | 'all';
    search?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
}

export interface ListDeliveriesResp {
    deliveries: WebhookDeliveryRow[];
    nextCursor: string | null;
    error?: string;
}

export interface GetDeliveryResp {
    delivery?: WebhookDeliveryRow;
    error?: string;
}

export interface LogDeliveryBody {
    projectId: string;
    botId: string;
    updateId: number;
    eventType: string;
    chatId?: string;
    fromUserId?: string;
    payload: unknown;
    status?: DeliveryStatus;
    processingDurationMs?: number;
    errorMessage?: string;
}

export interface DeleteDeliveriesResp {
    success: boolean;
    deleted: number;
    error?: string;
}

// -- DLQ --------------------------------------------------------------------

export type DlqStatus = 'pending' | 'retrying' | 'failed_permanent' | 'resolved';

export interface WebhookDlqRow {
    _id: string;
    projectId: string;
    botId: string;
    originalDeliveryId: string;
    attempts: number;
    lastError?: string;
    lastAttemptAt: string;
    status: DlqStatus;
    payload?: unknown;
}

export interface ListDlqQuery {
    projectId: string;
    botId?: string;
    status?: DlqStatus | 'all';
    cursor?: string;
    limit?: number;
}

export interface ListDlqResp {
    items: WebhookDlqRow[];
    nextCursor: string | null;
    error?: string;
}

export interface EnqueueDlqBody {
    projectId: string;
    botId: string;
    originalDeliveryId: string;
    errorMessage?: string;
    payload: unknown;
}

// -- Analytics --------------------------------------------------------------

export interface AnalyticsByDayPoint {
    date: string;
    received: number;
    processed: number;
    failed: number;
}

export interface AnalyticsByEventTypePoint {
    eventType: string;
    count: number;
}

export interface AnalyticsResp {
    totalReceived: number;
    totalProcessed: number;
    totalFailed: number;
    dlqCount: number;
    avgProcessingMs: number;
    byEventType: AnalyticsByEventTypePoint[];
    byDay: AnalyticsByDayPoint[];
    error?: string;
}

export interface AnalyticsQuery {
    projectId: string;
    from?: string;
    to?: string;
    botId?: string;
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const telegramWebhooksApi = {
    // -- Subscriptions ----------------------------------------------------
    listSubscriptions: (projectId: string, botId?: string) =>
        rustFetch<ListSubscriptionsResp>(
            `${BASE}/subscriptions${qs({ projectId, botId })}`,
        ),

    getSubscription: (botId: string, projectId: string) =>
        rustFetch<GetSubscriptionResp>(
            `${BASE}/subscriptions/${encodeURIComponent(botId)}${qs({ projectId })}`,
        ),

    putSubscription: (botId: string, body: PutSubscriptionBody) =>
        rustFetch<WebhookAckResult>(
            `${BASE}/subscriptions/${encodeURIComponent(botId)}`,
            { method: 'PUT', body: JSON.stringify(body) },
        ),

    deleteSubscription: (botId: string, body: DeleteSubscriptionBody) =>
        rustFetch<WebhookAckResult>(
            `${BASE}/subscriptions/${encodeURIComponent(botId)}`,
            { method: 'DELETE', body: JSON.stringify(body) },
        ),

    testSubscription: (botId: string, projectId: string) =>
        rustFetch<TestSubscriptionResp>(
            `${BASE}/subscriptions/${encodeURIComponent(botId)}/test`,
            { method: 'POST', body: JSON.stringify({ projectId }) },
        ),

    rotateSecret: (botId: string, projectId: string) =>
        rustFetch<WebhookAckResult>(
            `${BASE}/subscriptions/${encodeURIComponent(botId)}/rotate-secret`,
            { method: 'POST', body: JSON.stringify({ projectId }) },
        ),

    // -- Deliveries -------------------------------------------------------
    listDeliveries: (q: ListDeliveriesQuery) =>
        rustFetch<ListDeliveriesResp>(
            `${BASE}/deliveries${qs(q as unknown as Record<string, string | number | undefined>)}`,
        ),

    getDelivery: (id: string, projectId: string) =>
        rustFetch<GetDeliveryResp>(
            `${BASE}/deliveries/${encodeURIComponent(id)}${qs({ projectId })}`,
        ),

    replayDelivery: (id: string, projectId: string) =>
        rustFetch<WebhookAckResult>(
            `${BASE}/deliveries/${encodeURIComponent(id)}/replay`,
            { method: 'POST', body: JSON.stringify({ projectId }) },
        ),

    logDelivery: (body: LogDeliveryBody) =>
        rustFetch<WebhookAckResult>(`${BASE}/deliveries/log`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteDeliveries: (projectId: string, before?: string) =>
        rustFetch<DeleteDeliveriesResp>(
            `${BASE}/deliveries${qs({ projectId, before })}`,
            { method: 'DELETE' },
        ),

    // -- DLQ --------------------------------------------------------------
    listDlq: (q: ListDlqQuery) =>
        rustFetch<ListDlqResp>(
            `${BASE}/dlq${qs(q as unknown as Record<string, string | number | undefined>)}`,
        ),

    enqueueDlq: (body: EnqueueDlqBody) =>
        rustFetch<WebhookAckResult>(`${BASE}/dlq/enqueue`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    retryDlq: (id: string, projectId: string) =>
        rustFetch<WebhookAckResult>(`${BASE}/dlq/${encodeURIComponent(id)}/retry`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        }),

    resolveDlq: (id: string, projectId: string) =>
        rustFetch<WebhookAckResult>(
            `${BASE}/dlq/${encodeURIComponent(id)}/resolve`,
            { method: 'POST', body: JSON.stringify({ projectId }) },
        ),

    deleteDlq: (id: string, projectId: string) =>
        rustFetch<WebhookAckResult>(
            `${BASE}/dlq/${encodeURIComponent(id)}${qs({ projectId })}`,
            { method: 'DELETE' },
        ),

    // -- Analytics --------------------------------------------------------
    analytics: (q: AnalyticsQuery) =>
        rustFetch<AnalyticsResp>(
            `${BASE}/analytics${qs(q as unknown as Record<string, string | number | undefined>)}`,
        ),
};

export type TelegramWebhooksApi = typeof telegramWebhooksApi;

/**
 * Full Bot API `allowed_updates` list — used by the dashboard
 * multi-select. Keep in sync with the upstream Telegram Bot API docs.
 */
export { TELEGRAM_ALLOWED_UPDATES } from './telegram-webhooks-shared';
