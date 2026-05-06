/**
 * Client for the Telegram Chats router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/telegram/chats` by the
 * `telegram-chats` Rust crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ success, error?, … }`
 * envelope shape the legacy TS server actions in
 * `src/app/actions/telegram.actions.ts` returned.
 *
 * Server-only.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/chats';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    messageId?: number;
}

export interface ChatRow {
    _id: string;
    botId: string;
    projectId: string;
    chatId: string;
    type: 'private' | 'group' | 'supergroup' | 'channel' | string;
    title?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    lastMessagePreview?: string;
    lastMessageAt?: string;
    unreadCount: number;
    isOptedOut?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface MessageRow {
    _id: string;
    botId: string;
    chatId: string;
    messageId: number;
    direction: 'inbound' | 'outbound';
    type: string;
    text?: string;
    caption?: string;
    fromUserId?: string;
    fromUsername?: string;
    replyToMessageId?: number;
    status: 'queued' | 'sent' | 'delivered' | 'failed';
    errorMessage?: string;
    createdAt: string;
}

export interface ListChatsResp {
    chats: ChatRow[];
    error?: string;
}

export interface ListMessagesResp {
    messages: MessageRow[];
    error?: string;
}

export interface SendTextBody {
    text: string;
    replyToMessageId?: number;
    businessConnectionId?: string;
    parseMode?: 'HTML' | 'MarkdownV2';
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const telegramChatsApi = {
    /** `GET /v1/telegram/chats?botId=…&q=…&limit=…` — listTelegramChats */
    list: (botId: string, q?: string, limit?: number) => {
        const params = new URLSearchParams({ botId });
        if (q) params.set('q', q);
        if (limit) params.set('limit', String(limit));
        return rustFetch<ListChatsResp>(`${BASE}/?${params.toString()}`);
    },

    /** `GET /v1/telegram/chats/{botId}/{chatId}/messages?limit=…` — listTelegramMessages */
    messages: (botId: string, chatId: string, limit?: number) => {
        const qs = limit ? `?limit=${limit}` : '';
        return rustFetch<ListMessagesResp>(
            `${BASE}/${encodeURIComponent(botId)}/${encodeURIComponent(chatId)}/messages${qs}`,
        );
    },

    /** `POST /v1/telegram/chats/{botId}/{chatId}/messages` — sendTelegramTextMessage */
    sendText: (botId: string, chatId: string, body: SendTextBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(botId)}/${encodeURIComponent(chatId)}/messages`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `POST /v1/telegram/chats/{botId}/{chatId}/read` — markTelegramChatRead */
    markRead: (botId: string, chatId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(botId)}/${encodeURIComponent(chatId)}/read`,
            { method: 'POST' },
        ),
};

export type TelegramChatsApi = typeof telegramChatsApi;
