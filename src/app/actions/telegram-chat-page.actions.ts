'use server';

/**
 * Server actions for the `/dashboard/telegram/chat` page.
 *
 * Thin pass-throughs around the chat-doc-scoped surface of the Rust
 * `telegram-chats` crate. Kept separate from `telegram.actions.ts` so
 * the legacy chat helpers used by the broadcast / contacts pages do
 * not balloon, and so the page can import these without dragging the
 * full TS chat-server lib into the bundle.
 *
 * Each LIST/READ action is wrapped in {@link withRustFallback} so that
 * when the Rust BFF is not deployed (404) or is failing (5xx), the
 * call falls back to a direct Mongo read against the legacy
 * collections (`telegram_chats`, `telegram_messages`, `telegram_bots`).
 * Mutations cannot be safely faked — they return a graceful
 * "backend not deployed" error envelope instead.
 */

import { ObjectId, type Filter, type WithId } from 'mongodb';

import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    ChatRow,
    ListChatsParams,
    ListChatsResp,
    ListMessagesResp,
    MessageRow,
    SearchHit,
    SearchParams,
    SearchResp,
    SendMessageBody,
    SendMessageResp,
    AckResult,
    ChatActionBody,
    EditMessageBody,
    ForwardBody,
    CopyBody,
    PinBody,
    ChatResp,
    ChatMemberResp,
    MessagesPageParams,
} from '@/lib/rust-client/telegram-chats';
import type { BotRow as TelegramBotRow } from '@/lib/rust-client/telegram-bots';
import { connectToDatabase } from '@/lib/mongodb';
import type { TelegramBot, TelegramChat, TelegramMessage } from '@/lib/definitions';
import { withRustFallback, isRustUnavailable } from '@/lib/telegram/rust-fallback';
import { getSession } from '@/app/actions/user.actions';
import { getProjectById } from '@/app/actions/project.actions';

const RUST_DOWN_ERROR = 'Telegram backend is not deployed yet — message not sent.';

function errMessage(err: unknown): string {
    if (err instanceof RustApiError) return err.message;
    // eslint-disable-next-line no-console
    console.error('[telegram-chat-page]', err);
    return 'Network error.';
}

function fail<T extends object>(err: unknown, empty: T): T & { error: string } {
    return { ...empty, error: errMessage(err) };
}

function mutationFallback(err: unknown): AckResult {
    if (isRustUnavailable(err)) {
        return { success: false, error: RUST_DOWN_ERROR };
    }
    if (err instanceof RustApiError) return { success: false, error: err.message };
    // eslint-disable-next-line no-console
    console.error('[telegram-chat-page mutation]', err);
    return { success: false, error: 'Network error.' };
}

function sendMutationFallback(err: unknown): SendMessageResp {
    if (isRustUnavailable(err)) {
        return { success: false, error: RUST_DOWN_ERROR };
    }
    if (err instanceof RustApiError) return { success: false, error: err.message };
    // eslint-disable-next-line no-console
    console.error('[telegram-chat-page mutation]', err);
    return { success: false, error: 'Network error.' };
}

// ── Mongo → wire-shape mappers ─────────────────────────────────────

function mapBotDoc(doc: WithId<TelegramBot>): TelegramBotRow {
    return {
        _id: doc._id.toString(),
        projectId: doc.projectId.toString(),
        userId: doc.userId.toString(),
        botId: doc.botId,
        username: doc.username,
        name: doc.name,
        isActive: doc.isActive,
        webhookUrl: doc.webhookUrl,
        webhookRegisteredAt: doc.webhookRegisteredAt?.toISOString(),
        canJoinGroups: doc.canJoinGroups,
        canReadAllGroupMessages: doc.canReadAllGroupMessages,
        supportsInlineQueries: doc.supportsInlineQueries,
        status: doc.isActive ? 'active' : 'disconnected',
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}

function mapChatDoc(doc: WithId<TelegramChat>): ChatRow {
    return {
        _id: doc._id.toString(),
        botId: doc.botId.toString(),
        projectId: doc.projectId.toString(),
        chatId: doc.chatId,
        type: doc.type,
        title: doc.title,
        username: doc.username,
        firstName: doc.firstName,
        lastName: doc.lastName,
        lastMessagePreview: doc.lastMessagePreview,
        lastMessageAt: doc.lastMessageAt?.toISOString(),
        unreadCount: doc.unreadCount ?? 0,
        isOptedOut: doc.isOptedOut,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}

function mapMessageDoc(doc: WithId<TelegramMessage>): MessageRow {
    return {
        _id: doc._id.toString(),
        botId: doc.botId.toString(),
        chatId: doc.chatId,
        messageId: doc.messageId,
        direction: doc.direction,
        type: doc.type,
        text: doc.text,
        caption: doc.caption,
        fromUserId: doc.fromUserId,
        fromUsername: doc.fromUsername,
        replyToMessageId: doc.replyToMessageId,
        status: doc.status,
        errorMessage: doc.errorMessage,
        isDeleted: false,
        createdAt: doc.createdAt.toISOString(),
    };
}

// ── chats list / bots list ─────────────────────────────────────────

export async function listChatBots(projectId: string): Promise<TelegramBotRow[]> {
    return withRustFallback(
        async () => {
            try {
                const res = await rustClient.telegramBots.list(projectId);
                if (res.error) return [];
                return res.bots ?? [];
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return [];
            }
        },
        async () => {
            try {
                if (!ObjectId.isValid(projectId)) return [];
                const project = await getProjectById(projectId);
                if (!project) return [];
                const { db } = await connectToDatabase();
                const docs = await db
                    .collection<TelegramBot>('telegram_bots')
                    .find({ projectId: project._id })
                    .sort({ createdAt: -1 })
                    .toArray();
                return docs.map(mapBotDoc);
            } catch {
                return [];
            }
        },
    );
}

export async function listChats(params: ListChatsParams): Promise<ListChatsResp> {
    return withRustFallback<ListChatsResp>(
        async () => {
            try {
                return await rustClient.telegramChats.list(params);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return { chats: [], error: errMessage(err) };
            }
        },
        async (): Promise<ListChatsResp> => {
            try {
                const session = await getSession();
                if (!session?.user) {
                    return { chats: [], error: 'Not authenticated.' };
                }
                if (!params.projectId || !ObjectId.isValid(params.projectId)) {
                    return { chats: [] };
                }
                const project = await getProjectById(params.projectId);
                if (!project) return { chats: [], error: 'Access denied.' };
                const { db } = await connectToDatabase();

                const filter: Filter<TelegramChat> = { projectId: project._id };
                if (params.botId && ObjectId.isValid(params.botId)) {
                    filter.botId = new ObjectId(params.botId);
                }
                if (params.type && params.type !== 'all') {
                    filter.type = params.type;
                }
                if (params.q) {
                    const re = new RegExp(
                        params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                        'i',
                    );
                    filter.$or = [
                        { title: re },
                        { username: re },
                        { firstName: re },
                        { lastName: re },
                        { lastMessagePreview: re },
                    ];
                }

                const pageSize = Math.min(params.pageSize ?? params.limit ?? 50, 200);
                const page = Math.max(params.page ?? 1, 1);
                const skip = (page - 1) * pageSize;

                const col = db.collection<TelegramChat>('telegram_chats');
                const [total, docs] = await Promise.all([
                    col.countDocuments(filter),
                    col
                        .find(filter)
                        .sort({ lastMessageAt: -1, updatedAt: -1 })
                        .skip(skip)
                        .limit(pageSize)
                        .toArray(),
                ]);
                return {
                    chats: docs.map(mapChatDoc),
                    total,
                    page,
                    pageSize,
                    hasMore: skip + docs.length < total,
                };
            } catch (err) {
                return { chats: [], error: errMessage(err) };
            }
        },
    );
}

// ── chat metadata ──────────────────────────────────────────────────

export async function getChat(
    chatDocId: string,
    projectId: string,
    botId?: string,
): Promise<ChatResp> {
    return withRustFallback(
        async () => {
            try {
                return await rustClient.telegramChats.getChat(chatDocId, projectId, botId);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return fail(err, {});
            }
        },
        async () => {
            try {
                if (!ObjectId.isValid(chatDocId)) return { error: 'Invalid chat id.' };
                const session = await getSession();
                if (!session?.user) return { error: 'Not authenticated.' };
                const project = await getProjectById(projectId);
                if (!project) return { error: 'Access denied.' };
                const { db } = await connectToDatabase();
                const doc = await db
                    .collection<TelegramChat>('telegram_chats')
                    .findOne({ _id: new ObjectId(chatDocId), projectId: project._id });
                if (!doc) return {};
                return { chat: mapChatDoc(doc) };
            } catch (err) {
                return fail(err, {});
            }
        },
    );
}

export async function refreshChat(
    chatDocId: string,
    projectId: string,
    botId: string,
): Promise<ChatResp> {
    try {
        return await rustClient.telegramChats.refreshChat(chatDocId, projectId, botId);
    } catch (err) {
        if (isRustUnavailable(err)) {
            return { error: RUST_DOWN_ERROR };
        }
        return fail(err, {});
    }
}

export async function getChatMember(
    chatDocId: string,
    userId: number,
    projectId: string,
    botId: string,
): Promise<ChatMemberResp> {
    try {
        return await rustClient.telegramChats.getChatMember(
            chatDocId,
            userId,
            projectId,
            botId,
        );
    } catch (err) {
        if (isRustUnavailable(err)) {
            return { error: RUST_DOWN_ERROR };
        }
        return fail(err, {});
    }
}

// ── messages ───────────────────────────────────────────────────────

export async function listChatMessages(
    chatDocId: string,
    params: MessagesPageParams,
): Promise<ListMessagesResp> {
    return withRustFallback<ListMessagesResp>(
        async () => {
            try {
                return await rustClient.telegramChats.listMessagesPage(chatDocId, params);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return fail(err, { messages: [] as MessageRow[] });
            }
        },
        async () => {
            try {
                if (!ObjectId.isValid(chatDocId)) return { messages: [] };
                const session = await getSession();
                if (!session?.user) {
                    return { messages: [], error: 'Not authenticated.' };
                }
                const project = await getProjectById(params.projectId);
                if (!project) return { messages: [], error: 'Access denied.' };
                const { db } = await connectToDatabase();

                const chat = await db
                    .collection<TelegramChat>('telegram_chats')
                    .findOne({ _id: new ObjectId(chatDocId), projectId: project._id });
                if (!chat) return { messages: [] };

                const filter: Filter<TelegramMessage> = {
                    botId: chat.botId,
                    chatId: chat.chatId,
                };
                if (params.cursor) {
                    const d = new Date(params.cursor);
                    if (!Number.isNaN(d.getTime())) {
                        filter.createdAt = { $lt: d };
                    }
                }

                const limit = Math.min(params.limit ?? 50, 200);
                const docs = await db
                    .collection<TelegramMessage>('telegram_messages')
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .limit(limit + 1)
                    .toArray();

                const hasMore = docs.length > limit;
                const slice = hasMore ? docs.slice(0, limit) : docs;
                // Return chronological (oldest → newest) — same shape the
                // Rust handler returns so the page can prepend on
                // "load more".
                const ordered = slice.slice().reverse();
                const nextCursor = hasMore
                    ? slice[slice.length - 1]?.createdAt?.toISOString()
                    : undefined;

                return {
                    messages: ordered.map(mapMessageDoc),
                    hasMore,
                    nextCursor,
                };
            } catch (err) {
                return fail(err, { messages: [] as MessageRow[] });
            }
        },
    );
}

export async function sendChatMessage(
    chatDocId: string,
    body: SendMessageBody,
): Promise<SendMessageResp> {
    try {
        return await rustClient.telegramChats.sendMessage(chatDocId, body);
    } catch (err) {
        return sendMutationFallback(err);
    }
}

export async function editChatMessage(
    chatDocId: string,
    messageId: number,
    body: EditMessageBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.editMessage(chatDocId, messageId, body);
    } catch (err) {
        return mutationFallback(err);
    }
}

export async function deleteChatMessage(
    chatDocId: string,
    messageId: number,
    projectId: string,
    botId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.deleteMessage(
            chatDocId,
            messageId,
            projectId,
            botId,
        );
    } catch (err) {
        return mutationFallback(err);
    }
}

export async function forwardChatMessage(
    chatDocId: string,
    messageId: number,
    body: ForwardBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.forwardMessage(chatDocId, messageId, body);
    } catch (err) {
        return mutationFallback(err);
    }
}

export async function copyChatMessage(
    chatDocId: string,
    messageId: number,
    body: CopyBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.copyMessage(chatDocId, messageId, body);
    } catch (err) {
        return mutationFallback(err);
    }
}

export async function pinChatMessage(
    chatDocId: string,
    messageId: number,
    body: PinBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.pinMessage(chatDocId, messageId, body);
    } catch (err) {
        return mutationFallback(err);
    }
}

export async function unpinChatMessage(
    chatDocId: string,
    messageId: number,
    projectId: string,
    botId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.unpinMessage(
            chatDocId,
            messageId,
            projectId,
            botId,
        );
    } catch (err) {
        return mutationFallback(err);
    }
}

export async function sendChatAction(
    chatDocId: string,
    body: ChatActionBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.chatAction(chatDocId, body);
    } catch (err) {
        return mutationFallback(err);
    }
}

export async function searchChatMessages(params: SearchParams): Promise<SearchResp> {
    return withRustFallback<SearchResp>(
        async () => {
            try {
                return await rustClient.telegramChats.search(params);
            } catch (err) {
                if (isRustUnavailable(err)) throw err;
                return fail(err, { messages: [] as SearchHit[] });
            }
        },
        async () => {
            try {
                if (!params.q) return { messages: [] };
                const session = await getSession();
                if (!session?.user) {
                    return { messages: [], error: 'Not authenticated.' };
                }
                const project = await getProjectById(params.projectId);
                if (!project) return { messages: [], error: 'Access denied.' };
                const { db } = await connectToDatabase();

                const filter: Filter<TelegramMessage> = { projectId: project._id };
                if (params.botId && ObjectId.isValid(params.botId)) {
                    filter.botId = new ObjectId(params.botId);
                }
                if (params.chatId) filter.chatId = params.chatId;
                if (params.from || params.to) {
                    const range: { $gte?: Date; $lte?: Date } = {};
                    if (params.from) {
                        const d = new Date(params.from);
                        if (!Number.isNaN(d.getTime())) range.$gte = d;
                    }
                    if (params.to) {
                        const d = new Date(params.to);
                        if (!Number.isNaN(d.getTime())) range.$lte = d;
                    }
                    if (range.$gte || range.$lte) filter.createdAt = range;
                }
                const re = new RegExp(
                    params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                    'i',
                );
                filter.$or = [{ text: re }, { caption: re }];

                if (params.cursor) {
                    const d = new Date(params.cursor);
                    if (!Number.isNaN(d.getTime())) {
                        filter.createdAt = { ...(filter.createdAt as object), $lt: d };
                    }
                }

                const limit = Math.min(params.limit ?? 50, 200);
                const docs = await db
                    .collection<TelegramMessage>('telegram_messages')
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .limit(limit + 1)
                    .toArray();

                const hasMore = docs.length > limit;
                const slice = hasMore ? docs.slice(0, limit) : docs;
                const nextCursor = hasMore
                    ? slice[slice.length - 1]?.createdAt?.toISOString()
                    : undefined;

                return {
                    messages: slice.map((d) => mapMessageDoc(d) as SearchHit),
                    hasMore,
                    nextCursor,
                };
            } catch (err) {
                return fail(err, { messages: [] as SearchHit[] });
            }
        },
    );
}

export async function markChatRead(
    botIdHex: string,
    telegramChatId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.markRead(botIdHex, telegramChatId);
    } catch (err) {
        return mutationFallback(err);
    }
}
