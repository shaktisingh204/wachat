'use server';

/**
 * Server actions for the `/dashboard/telegram/chat` page.
 *
 * Thin pass-throughs around the chat-doc-scoped surface of the Rust
 * `telegram-chats` crate. Kept separate from `telegram.actions.ts` so
 * the legacy chat helpers used by the broadcast / contacts pages do
 * not balloon, and so the page can import these without dragging the
 * full TS chat-server lib into the bundle.
 */

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

function fail<T extends { error?: string }>(err: unknown, empty: T): T {
    if (err instanceof RustApiError) return { ...empty, error: err.message };
    // eslint-disable-next-line no-console
    console.error('[telegram-chat-page]', err);
    return { ...empty, error: 'Network error.' };
}

// ── chats list / bots list ─────────────────────────────────────────

export async function listChatBots(projectId: string): Promise<TelegramBotRow[]> {
    try {
        const res = await rustClient.telegramBots.list(projectId);
        if (res.error) return [];
        return res.bots ?? [];
    } catch {
        return [];
    }
}

export async function listChats(params: ListChatsParams): Promise<ListChatsResp> {
    try {
        return await rustClient.telegramChats.list(params);
    } catch (err) {
        return fail(err, { chats: [] as ChatRow[] });
    }
}

// ── chat metadata ──────────────────────────────────────────────────

export async function getChat(
    chatDocId: string,
    projectId: string,
    botId?: string,
): Promise<ChatResp> {
    try {
        return await rustClient.telegramChats.getChat(chatDocId, projectId, botId);
    } catch (err) {
        return fail(err, {});
    }
}

export async function refreshChat(
    chatDocId: string,
    projectId: string,
    botId: string,
): Promise<ChatResp> {
    try {
        return await rustClient.telegramChats.refreshChat(chatDocId, projectId, botId);
    } catch (err) {
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
        return fail(err, {});
    }
}

// ── messages ───────────────────────────────────────────────────────

export async function listChatMessages(
    chatDocId: string,
    params: MessagesPageParams,
): Promise<ListMessagesResp> {
    try {
        return await rustClient.telegramChats.listMessagesPage(chatDocId, params);
    } catch (err) {
        return fail(err, { messages: [] as MessageRow[] });
    }
}

export async function sendChatMessage(
    chatDocId: string,
    body: SendMessageBody,
): Promise<SendMessageResp> {
    try {
        return await rustClient.telegramChats.sendMessage(chatDocId, body);
    } catch (err) {
        return fail(err, { success: false });
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
        return fail(err, { success: false });
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
        return fail(err, { success: false });
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
        return fail(err, { success: false });
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
        return fail(err, { success: false });
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
        return fail(err, { success: false });
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
        return fail(err, { success: false });
    }
}

export async function sendChatAction(
    chatDocId: string,
    body: ChatActionBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.chatAction(chatDocId, body);
    } catch (err) {
        return fail(err, { success: false });
    }
}

export async function searchChatMessages(params: SearchParams): Promise<SearchResp> {
    try {
        return await rustClient.telegramChats.search(params);
    } catch (err) {
        return fail(err, { messages: [] as SearchHit[] });
    }
}

export async function markChatRead(
    botIdHex: string,
    telegramChatId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramChats.markRead(botIdHex, telegramChatId);
    } catch (err) {
        return fail(err, { success: false });
    }
}
