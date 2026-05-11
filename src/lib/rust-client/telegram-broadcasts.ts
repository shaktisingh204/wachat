/**
 * Client for the Telegram Broadcasts router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/telegram/broadcasts` by the
 * `telegram-broadcasts` Rust crate. Each method is a thin wrapper around
 * {@link rustFetch}; the wire envelopes are camelCased so React components
 * can pass them through to UI without renaming.
 *
 * Server-only.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/broadcasts';

// ---------------------------------------------------------------------------
//  Status + audience + message shapes
// ---------------------------------------------------------------------------

export type BroadcastStatus =
    | 'draft'
    | 'scheduled'
    | 'sending'
    | 'completed'
    | 'failed'
    | 'cancelled';

export type BroadcastParseMode = 'Markdown' | 'MarkdownV2' | 'HTML';

export type BroadcastMediaKind = 'photo' | 'video' | 'document' | 'audio';

export interface BroadcastMediaItem {
    type: BroadcastMediaKind;
    /** SabFiles node id. */
    sabFileId: string;
    /** Public URL the worker resolves the file by (mirrors sabfiles). */
    url?: string;
    caption?: string;
    durationSec?: number;
    thumbnailFileId?: string;
}

export interface BroadcastMessage {
    text: string;
    parseMode?: BroadcastParseMode;
    entities?: unknown[];
    disableWebPagePreview?: boolean;
}

export interface BroadcastInlineButton {
    text: string;
    url?: string;
    callbackData?: string;
    webApp?: { url: string };
}

export type BroadcastInlineKeyboard = BroadcastInlineButton[][];

export type BroadcastAudience =
    | { kind: 'all' }
    | { kind: 'segment'; segmentId: string }
    | { kind: 'contactIds'; ids: string[] }
    | {
          kind: 'filter';
          filter: {
              tags?: string[];
              lang?: string;
              lastSeenAfter?: string;
          };
      }
    | { kind: 'channel'; channelChatId: string };

export interface BroadcastCounters {
    queued?: number;
    sent?: number;
    failed?: number;
    skipped?: number;
}

// ---------------------------------------------------------------------------
//  Envelopes
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    broadcastId?: string;
}

export interface BroadcastRow {
    _id: string;
    projectId: string;
    botId: string;
    name: string;
    status: BroadcastStatus;
    audience: BroadcastAudience | Record<string, unknown>;
    message: BroadcastMessage | Record<string, unknown>;
    media: BroadcastMediaItem[] | unknown[];
    inlineKeyboard: BroadcastInlineKeyboard | unknown[];
    counters: BroadcastCounters;
    stats?: { total?: number; sent?: number; failed?: number };
    errorSummary?: { message?: string; code?: string | number } | null;
    scheduledAt?: string;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ListResp {
    broadcasts: BroadcastRow[];
    nextCursor?: string;
    error?: string;
}

export interface GetResp {
    broadcast?: BroadcastRow;
    error?: string;
}

export interface DeliveryRow {
    _id: string;
    chatId: string;
    status: string;
    errorCode?: number;
    errorMessage?: string;
    sentAt?: string;
}

export interface DeliveriesResp {
    deliveries: DeliveryRow[];
    nextCursor?: string;
    error?: string;
}

export interface AnalyticsResp {
    totalBroadcasts: number;
    totalSent: number;
    totalFailed: number;
    successRate: number;
    topErrors: { code: string; count: number }[];
    byDay: { day: string; sent: number; failed: number }[];
    error?: string;
}

// ---------------------------------------------------------------------------
//  Request bodies
// ---------------------------------------------------------------------------

export interface CreateBody {
    projectId: string;
    botId: string;
    name: string;
    audience: BroadcastAudience | Record<string, unknown>;
    message: BroadcastMessage;
    media?: BroadcastMediaItem[];
    inlineKeyboard?: BroadcastInlineKeyboard;
    scheduledAt?: string;
}

export interface UpdateBody {
    projectId: string;
    name?: string;
    botId?: string;
    audience?: BroadcastAudience | Record<string, unknown>;
    message?: BroadcastMessage;
    media?: BroadcastMediaItem[];
    inlineKeyboard?: BroadcastInlineKeyboard;
    scheduledAt?: string;
}

export interface ListQuery {
    projectId: string;
    botId?: string;
    status?: BroadcastStatus;
    search?: string;
    limit?: number;
    cursor?: string;
}

export interface DeliveriesQuery {
    projectId: string;
    cursor?: string;
    limit?: number;
    status?: string;
}

export interface AnalyticsQuery {
    projectId: string;
    from?: string;
    to?: string;
}

// ---------------------------------------------------------------------------
//  URL builders
// ---------------------------------------------------------------------------

function qs(
    params: Record<string, string | number | undefined | null | boolean>,
): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        const value = typeof v === 'number' || typeof v === 'boolean' ? String(v) : v;
        if (value !== '') search.set(k, value);
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

export const telegramBroadcastsApi = {
    /** `GET /` — paginated list with filters. */
    list: (q: ListQuery) => rustFetch<ListResp>(`${BASE}/${qs({ ...q })}`),

    /** `GET /{id}?projectId=…` */
    get: (broadcastId: string, projectId: string) =>
        rustFetch<GetResp>(
            `${BASE}/${encodeURIComponent(broadcastId)}${qs({ projectId })}`,
        ),

    /** `POST /` — create draft. */
    create: (body: CreateBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `PATCH /{id}` — only allowed when draft. */
    update: (broadcastId: string, body: UpdateBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(broadcastId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    /** `DELETE /{id}?projectId=…` */
    delete: (broadcastId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(broadcastId)}${qs({ projectId })}`,
            { method: 'DELETE' },
        ),

    /** `POST /{id}/duplicate` */
    duplicate: (broadcastId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(broadcastId)}/duplicate`,
            {
                method: 'POST',
                body: JSON.stringify({ projectId }),
            },
        ),

    /** `POST /{id}/send-now` */
    sendNow: (broadcastId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(broadcastId)}/send-now`,
            {
                method: 'POST',
                body: JSON.stringify({ projectId }),
            },
        ),

    /** `POST /{id}/schedule` */
    schedule: (broadcastId: string, projectId: string, scheduledAt: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(broadcastId)}/schedule`,
            {
                method: 'POST',
                body: JSON.stringify({ projectId, scheduledAt }),
            },
        ),

    /** `POST /{id}/cancel` */
    cancel: (broadcastId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(broadcastId)}/cancel`,
            {
                method: 'POST',
                body: JSON.stringify({ projectId }),
            },
        ),

    /** `POST /{id}/test` — fires a single preview message to `chatId`. */
    test: (broadcastId: string, projectId: string, chatId: number) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(broadcastId)}/test`,
            {
                method: 'POST',
                body: JSON.stringify({ projectId, chatId }),
            },
        ),

    /** `GET /{id}/deliveries` */
    deliveries: (broadcastId: string, q: DeliveriesQuery) =>
        rustFetch<DeliveriesResp>(
            `${BASE}/${encodeURIComponent(broadcastId)}/deliveries${qs({ ...q })}`,
        ),

    /**
     * Return the CSV download URL for the deliveries log. The caller is
     * expected to expose this via a server action that pipes through the
     * Rust BFF — calling `rustFetch` here would buffer the entire CSV in
     * memory and we want streaming.
     */
    deliveriesCsvPath: (broadcastId: string, projectId: string) =>
        `${BASE}/${encodeURIComponent(broadcastId)}/deliveries.csv${qs({ projectId })}`,

    /** `GET /analytics` */
    analytics: (q: AnalyticsQuery) =>
        rustFetch<AnalyticsResp>(`${BASE}/analytics${qs({ ...q })}`),
};

export type TelegramBroadcastsApi = typeof telegramBroadcastsApi;
