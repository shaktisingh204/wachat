/**
 * Client for the Telegram Chats router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/telegram/chats` by the
 * `telegram-chats` Rust crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ success, error?, … }`
 * envelope shape the legacy TS server actions in
 * `src/app/actions/telegram.actions.ts` returned.
 *
 * Server-only. (Except for `streamUrl()` which only returns a string
 * the client can hand to `EventSource`.)
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
    memberCount?: number;
    pinnedMessageId?: number;
    photoUrl?: string;
    permissions?: Record<string, unknown>;
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
    mediaKind?: 'photo' | 'video' | 'document' | 'audio' | 'voice' | string;
    mediaFileId?: string;
    mediaUrl?: string;
    sabFileId?: string;
    fromUserId?: string;
    fromUsername?: string;
    fromName?: string;
    replyToMessageId?: number;
    replyToText?: string;
    status: 'queued' | 'sent' | 'delivered' | 'failed';
    errorMessage?: string;
    isDeleted: boolean;
    editedAt?: string;
    readAt?: string;
    sentAt?: string;
    createdAt: string;
}

export interface ListChatsParams {
    projectId?: string;
    botId?: string;
    q?: string;
    type?: 'private' | 'group' | 'supergroup' | 'channel' | 'all';
    page?: number;
    pageSize?: number;
    limit?: number;
}

export interface ListChatsResp {
    chats: ChatRow[];
    total?: number;
    hasMore?: boolean;
    page?: number;
    pageSize?: number;
    error?: string;
}

export interface ListMessagesResp {
    messages: MessageRow[];
    hasMore?: boolean;
    nextCursor?: string;
    error?: string;
}

export interface SendTextBody {
    text: string;
    replyToMessageId?: number;
    businessConnectionId?: string;
    parseMode?: 'HTML' | 'MarkdownV2';
}

export interface SendMessageBody {
    projectId: string;
    botId: string;
    text?: string;
    mediaKind?: 'photo' | 'video' | 'document' | 'audio' | 'voice';
    sabFileId?: string;
    sabFileUrl?: string;
    sabFileName?: string;
    sabFileMime?: string;
    caption?: string;
    replyToMessageId?: number;
    parseMode?: 'HTML' | 'MarkdownV2';
    disableNotification?: boolean;
    disableWebPagePreview?: boolean;
}

export interface SendMessageResp {
    success: boolean;
    error?: string;
    messageId?: number;
    row?: MessageRow;
}

export interface EditMessageBody {
    projectId: string;
    botId: string;
    text?: string;
    caption?: string;
    parseMode?: 'HTML' | 'MarkdownV2';
}

export interface ForwardBody {
    projectId: string;
    botId: string;
    toChatId: string;
    disableNotification?: boolean;
}

export interface CopyBody {
    projectId: string;
    botId: string;
    toChatId: string;
    caption?: string;
    parseMode?: 'HTML' | 'MarkdownV2';
}

export interface PinBody {
    projectId: string;
    botId: string;
    disableNotification?: boolean;
}

export interface ChatActionBody {
    projectId: string;
    botId: string;
    action:
        | 'typing'
        | 'upload_photo'
        | 'record_video'
        | 'upload_video'
        | 'record_voice'
        | 'upload_voice'
        | 'upload_document'
        | 'choose_sticker'
        | 'find_location'
        | 'record_video_note'
        | 'upload_video_note';
}

export interface ChatResp {
    chat?: ChatRow;
    error?: string;
}

export interface ChatMemberResp {
    member?: Record<string, unknown>;
    error?: string;
}

export interface SearchHit extends MessageRow {
    chatTitle?: string;
    chatType?: string;
}

export interface SearchResp {
    messages: SearchHit[];
    hasMore?: boolean;
    nextCursor?: string;
    error?: string;
}

export interface SearchParams {
    projectId: string;
    q: string;
    botId?: string;
    chatId?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
}

export interface MessagesPageParams {
    projectId: string;
    cursor?: string;
    limit?: number;
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

export const telegramChatsApi = {
    // ── chats list ──────────────────────────────────────────────────
    /**
     * `GET /v1/telegram/chats?…`
     *
     * Backward compatible: when called as `list(botId, q, limit)` it
     * targets the legacy bot-scoped surface; pass a single `ListChatsParams`
     * object to get pagination + type filter + projectId scope.
     */
    list: (
        a: string | ListChatsParams,
        q?: string,
        limit?: number,
    ): Promise<ListChatsResp> => {
        if (typeof a === 'string') {
            const qs = buildQuery({ botId: a, q, limit });
            return rustFetch<ListChatsResp>(`${BASE}/${qs}`);
        }
        const qs = buildQuery({
            projectId: a.projectId,
            botId: a.botId,
            q: a.q,
            type: a.type && a.type !== 'all' ? a.type : undefined,
            page: a.page,
            pageSize: a.pageSize,
            limit: a.limit,
        });
        return rustFetch<ListChatsResp>(`${BASE}/${qs}`);
    },

    // ── legacy messages (kept for the existing `listTelegramMessages` action)
    messages: (botId: string, chatId: string, limit?: number): Promise<ListMessagesResp> => {
        const qs = buildQuery({ limit });
        return rustFetch<ListMessagesResp>(
            `${BASE}/${encodeURIComponent(botId)}/${encodeURIComponent(chatId)}/messages${qs}`,
        );
    },
    sendText: (botId: string, chatId: string, body: SendTextBody): Promise<AckResult> =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(botId)}/${encodeURIComponent(chatId)}/messages`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
    markRead: (botId: string, chatId: string): Promise<AckResult> =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(botId)}/${encodeURIComponent(chatId)}/read`,
            { method: 'POST' },
        ),

    // ── chat-doc-scoped surface ─────────────────────────────────────
    getChat: (chatDocId: string, projectId: string, botId?: string): Promise<ChatResp> =>
        rustFetch<ChatResp>(
            `${BASE}/c/${encodeURIComponent(chatDocId)}${buildQuery({ projectId, botId })}`,
        ),

    refreshChat: (chatDocId: string, projectId: string, botId: string): Promise<ChatResp> =>
        rustFetch<ChatResp>(`${BASE}/c/${encodeURIComponent(chatDocId)}/refresh`, {
            method: 'POST',
            body: JSON.stringify({ projectId, botId }),
        }),

    getChatMember: (
        chatDocId: string,
        userId: number,
        projectId: string,
        botId: string,
    ): Promise<ChatMemberResp> =>
        rustFetch<ChatMemberResp>(
            `${BASE}/c/${encodeURIComponent(chatDocId)}/member/${userId}${buildQuery({ projectId, botId })}`,
        ),

    listMessagesPage: (
        chatDocId: string,
        params: MessagesPageParams,
    ): Promise<ListMessagesResp> => {
        const qs = buildQuery({
            projectId: params.projectId,
            cursor: params.cursor,
            limit: params.limit,
        });
        return rustFetch<ListMessagesResp>(
            `${BASE}/c/${encodeURIComponent(chatDocId)}/messages${qs}`,
        );
    },

    sendMessage: (
        chatDocId: string,
        body: SendMessageBody,
    ): Promise<SendMessageResp> =>
        rustFetch<SendMessageResp>(`${BASE}/c/${encodeURIComponent(chatDocId)}/messages`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    editMessage: (
        chatDocId: string,
        messageId: number,
        body: EditMessageBody,
    ): Promise<AckResult> =>
        rustFetch<AckResult>(
            `${BASE}/c/${encodeURIComponent(chatDocId)}/messages/${messageId}`,
            { method: 'PATCH', body: JSON.stringify(body) },
        ),

    deleteMessage: (
        chatDocId: string,
        messageId: number,
        projectId: string,
        botId: string,
    ): Promise<AckResult> =>
        rustFetch<AckResult>(
            `${BASE}/c/${encodeURIComponent(chatDocId)}/messages/${messageId}${buildQuery({ projectId, botId })}`,
            { method: 'DELETE' },
        ),

    forwardMessage: (
        chatDocId: string,
        messageId: number,
        body: ForwardBody,
    ): Promise<AckResult> =>
        rustFetch<AckResult>(
            `${BASE}/c/${encodeURIComponent(chatDocId)}/messages/${messageId}/forward`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    copyMessage: (
        chatDocId: string,
        messageId: number,
        body: CopyBody,
    ): Promise<AckResult> =>
        rustFetch<AckResult>(
            `${BASE}/c/${encodeURIComponent(chatDocId)}/messages/${messageId}/copy`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    pinMessage: (chatDocId: string, messageId: number, body: PinBody): Promise<AckResult> =>
        rustFetch<AckResult>(
            `${BASE}/c/${encodeURIComponent(chatDocId)}/messages/${messageId}/pin`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    unpinMessage: (
        chatDocId: string,
        messageId: number,
        projectId: string,
        botId: string,
    ): Promise<AckResult> =>
        rustFetch<AckResult>(
            `${BASE}/c/${encodeURIComponent(chatDocId)}/messages/${messageId}/pin${buildQuery({ projectId, botId })}`,
            { method: 'DELETE' },
        ),

    chatAction: (chatDocId: string, body: ChatActionBody): Promise<AckResult> =>
        rustFetch<AckResult>(`${BASE}/c/${encodeURIComponent(chatDocId)}/action`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    search: (params: SearchParams): Promise<SearchResp> =>
        rustFetch<SearchResp>(`${BASE}/search${buildQuery({ ...params })}`),

    /**
     * Returns the relative SSE path the browser can subscribe to. The
     * page passes this through a Next.js route handler (or directly to
     * the Rust BFF if `NEXT_PUBLIC_RUST_API_URL` is set) — `EventSource`
     * cannot send `Authorization` headers, so callers should consume
     * this via a server-side proxy that forwards the bearer token.
     */
    streamPath: (chatDocId: string, projectId: string, botId: string): string =>
        `${BASE}/c/${encodeURIComponent(chatDocId)}/stream${buildQuery({ projectId, botId })}`,
};

export type TelegramChatsApi = typeof telegramChatsApi;
