import 'server-only';

import type { Db, WithId } from 'mongodb';
import { ObjectId } from 'mongodb';
import type {
    TelegramBot,
    TelegramChat,
    TelegramInvoice,
    TelegramMessage,
} from '@/lib/definitions';
import { runTelegramAutoReply } from './auto-reply';
import { TelegramBotApi } from './bot-api';

/**
 * Process a single Telegram Update payload — https://core.telegram.org/bots/api#update
 *
 * Upserts the chat doc, persists the message, and bumps the bot's
 * unread counter. Keeps side effects narrow — broadcast/auto-reply
 * wiring lives above this layer.
 */

type UpdateKind =
    | 'message'
    | 'edited_message'
    | 'channel_post'
    | 'edited_channel_post'
    | 'business_message'
    | 'edited_business_message'
    | 'callback_query'
    | 'inline_query'
    | 'my_chat_member'
    | 'chat_member'
    | 'business_connection'
    | 'unknown';

function kindOf(update: any): UpdateKind {
    if (update?.business_message) return 'business_message';
    if (update?.edited_business_message) return 'edited_business_message';
    if (update?.message) return 'message';
    if (update?.edited_message) return 'edited_message';
    if (update?.channel_post) return 'channel_post';
    if (update?.edited_channel_post) return 'edited_channel_post';
    if (update?.callback_query) return 'callback_query';
    if (update?.inline_query) return 'inline_query';
    if (update?.my_chat_member) return 'my_chat_member';
    if (update?.chat_member) return 'chat_member';
    if (update?.business_connection) return 'business_connection';
    return 'unknown';
}

function classifyMessage(msg: any): TelegramMessage['type'] {
    if (msg?.photo) return 'photo';
    if (msg?.video) return 'video';
    if (msg?.audio) return 'audio';
    if (msg?.voice) return 'voice';
    if (msg?.document) return 'document';
    if (msg?.sticker) return 'sticker';
    if (msg?.animation) return 'animation';
    if (msg?.location || msg?.venue) return 'location';
    if (msg?.contact) return 'contact';
    if (msg?.poll) return 'poll';
    if (msg?.invoice || msg?.successful_payment) return 'invoice';
    if (msg?.new_chat_members || msg?.left_chat_member || msg?.pinned_message) return 'service';
    if (typeof msg?.text === 'string') return 'text';
    return 'other';
}

function chatTypeOf(type: string): TelegramChat['type'] {
    if (type === 'private' || type === 'group' || type === 'supergroup' || type === 'channel') {
        return type;
    }
    return 'private';
}

export async function processTelegramUpdate(
    db: Db,
    bot: WithId<TelegramBot>,
    update: any,
): Promise<void> {
    const kind = kindOf(update);

    // Pick the message envelope (if any)
    const message =
        update.business_message ||
        update.edited_business_message ||
        update.message ||
        update.edited_message ||
        update.channel_post ||
        update.edited_channel_post ||
        null;

    // Payments: answer pre_checkout synchronously, record successful_payment on the invoice.
    if (update.pre_checkout_query) {
        const q = update.pre_checkout_query;
        try {
            await TelegramBotApi.answerPreCheckoutQuery(bot.token, {
                pre_checkout_query_id: q.id,
                ok: true,
            });
        } catch { /* answerPreCheckoutQuery is best-effort */ }
        return;
    }

    if (kind === 'business_connection') {
        // Persist the connection on the bot doc so outbound traffic can use it.
        const conn = update.business_connection;
        if (conn?.id) {
            await db.collection('telegram_bots').updateOne(
                { _id: bot._id },
                {
                    $set: {
                        [`businessConnections.${conn.id}`]: {
                            id: conn.id,
                            userChatId: conn.user_chat_id,
                            canReply: conn.can_reply,
                            isEnabled: conn.is_enabled,
                            updatedAt: new Date(),
                        },
                        updatedAt: new Date(),
                    },
                },
            );
        }
        return;
    }

    if (!message) {
        // callback_query / inline_query / member changes — persist raw for audit.
        return;
    }

    const now = new Date();
    const chatId = String(message.chat?.id ?? '');
    if (!chatId) return;

    const chatFilter = { botId: bot._id, chatId };
    const chatUpdate: Record<string, any> = {
        $setOnInsert: {
            botId: bot._id,
            projectId: bot.projectId,
            chatId,
            unreadCount: 0,
            createdAt: now,
        },
        $set: {
            type: chatTypeOf(message.chat?.type),
            title: message.chat?.title,
            username: message.chat?.username,
            firstName: message.chat?.first_name ?? message.from?.first_name,
            lastName: message.chat?.last_name ?? message.from?.last_name,
            languageCode: message.from?.language_code,
            isBot: message.from?.is_bot ?? false,
            isBusiness: Boolean(update.business_message || update.edited_business_message),
            businessConnectionId: message.business_connection_id,
            lastMessageId: message.message_id,
            lastMessageAt: now,
            lastMessagePreview:
                (typeof message.text === 'string' && message.text.slice(0, 140)) ||
                (typeof message.caption === 'string' && message.caption.slice(0, 140)) ||
                `[${classifyMessage(message)}]`,
            updatedAt: now,
        },
        $inc: { unreadCount: 1 },
    };

    const existingChat = await db
        .collection<TelegramChat>('telegram_chats')
        .findOne(chatFilter, { projection: { _id: 1 } });
    const isFirstMessage = !existingChat;

    await db.collection<TelegramChat>('telegram_chats').updateOne(chatFilter, chatUpdate, {
        upsert: true,
    });

    const messageDoc: Omit<TelegramMessage, '_id'> = {
        botId: bot._id,
        projectId: bot.projectId,
        chatId,
        messageId: message.message_id,
        direction: 'inbound',
        type: classifyMessage(message),
        text: typeof message.text === 'string' ? message.text : undefined,
        caption: typeof message.caption === 'string' ? message.caption : undefined,
        raw: message,
        fromUserId: message.from?.id ? String(message.from.id) : undefined,
        fromUsername: message.from?.username,
        replyToMessageId: message.reply_to_message?.message_id,
        businessConnectionId: message.business_connection_id,
        status: 'delivered',
        createdAt: new Date((message.date ?? Math.floor(Date.now() / 1000)) * 1000),
    };

    await db.collection<TelegramMessage>('telegram_messages').insertOne(messageDoc as any);

    // Successful payment: mark the matching invoice as PAID.
    if (message.successful_payment) {
        const sp = message.successful_payment;
        const payload: string | undefined = sp.invoice_payload;
        const invoiceHexId = payload?.startsWith('inv_') ? payload.slice(4) : undefined;
        if (invoiceHexId && ObjectId.isValid(invoiceHexId)) {
            await db.collection<TelegramInvoice>('telegram_invoices').updateOne(
                { _id: new ObjectId(invoiceHexId), botId: bot._id },
                {
                    $set: {
                        status: 'PAID',
                        telegramPaymentChargeId: sp.telegram_payment_charge_id,
                        providerPaymentChargeId: sp.provider_payment_charge_id,
                        paidAt: new Date(),
                        updatedAt: new Date(),
                    },
                },
            );
        }
    }

    // Auto-reply: only fires on genuinely new inbound messages in private/group chats.
    if (
        (kind === 'message' || kind === 'business_message') &&
        messageDoc.direction === 'inbound' &&
        message.chat?.type !== 'channel'
    ) {
        try {
            await runTelegramAutoReply(db, bot, chatId, message, isFirstMessage);
        } catch (err) {
            console.error('[telegram.autoReply]', err);
        }
    }
}
