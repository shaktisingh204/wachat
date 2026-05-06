/**
 * Client for the Telegram Bots router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/telegram/bots` by the
 * `telegram-bots` Rust crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ success, error?, message?, … }`
 * envelope shape the legacy TS server actions in
 * `src/app/actions/telegram.actions.ts` returned, so the calling
 * page/component code does not need to change beyond the import.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/bots';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    botId?: string;
}

export interface WebhookInfoView {
    url?: string;
    pendingUpdateCount?: number;
    lastErrorMessage?: string;
    lastErrorDate?: string;
}

export interface BotRow {
    _id: string;
    projectId: string;
    userId: string;
    /** Telegram numeric bot id (the digits before the `:` in the token). */
    botId: number;
    username: string;
    name: string;
    isActive: boolean;
    webhookUrl?: string;
    webhookRegisteredAt?: string;
    webhookInfo?: WebhookInfoView;
    canJoinGroups?: boolean;
    canReadAllGroupMessages?: boolean;
    supportsInlineQueries?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ListBotsResp {
    bots: BotRow[];
    error?: string;
}

export interface GetBotResp {
    bot?: BotRow;
    error?: string;
}

export interface ConnectBotBody {
    projectId: string;
    token: string;
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const telegramBotsApi = {
    /** `GET /v1/telegram/bots?projectId=…` — listTelegramBots */
    list: (projectId: string) =>
        rustFetch<ListBotsResp>(`${BASE}/?projectId=${encodeURIComponent(projectId)}`),

    /** `GET /v1/telegram/bots/{botId}` — getTelegramBot */
    get: (botId: string) =>
        rustFetch<GetBotResp>(`${BASE}/${encodeURIComponent(botId)}`),

    /** `POST /v1/telegram/bots` — connectTelegramBot */
    connect: (body: ConnectBotBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `DELETE /v1/telegram/bots/{botId}` — disconnectTelegramBot */
    disconnect: (botId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}`, {
            method: 'DELETE',
        }),

    /** `POST /v1/telegram/bots/{botId}/webhook/refresh` — refreshTelegramWebhookInfo */
    refreshWebhookInfo: (botId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/webhook/refresh`, {
            method: 'POST',
        }),

    /** `POST /v1/telegram/bots/{botId}/webhook/rotate` — rotateTelegramWebhookSecret */
    rotateWebhookSecret: (botId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/webhook/rotate`, {
            method: 'POST',
        }),
};

export type TelegramBotsApi = typeof telegramBotsApi;
