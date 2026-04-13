'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from './user.actions';
import { getProjectById } from './project.actions';
import { getErrorMessage } from '@/lib/utils';
import type {
    TelegramApiCredentials,
    TelegramAutoReplyRule,
    TelegramBot,
    TelegramBroadcast,
    TelegramChannel,
    TelegramChat,
    TelegramInvoice,
    TelegramMessage,
    TelegramQuickReply,
    TelegramScheduledPost,
    TelegramSettings,
    TelegramStickerSet,
} from '@/lib/definitions';
import { TelegramBotApi, TelegramApiError } from '@/lib/telegram/bot-api';
import { invalidateTelegramBotCache } from '@/lib/telegram/bot-cache';

type ActionResult<T = {}> = {
    success: boolean;
    error?: string;
    message?: string;
} & Partial<T>;

/* ── helpers ────────────────────────────────────────────────────── */

function buildWebhookUrl(botIdHex: string): string {
    const base =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
        process.env.VERCEL_URL ||
        '';
    const origin = base.startsWith('http') ? base : base ? `https://${base}` : '';
    return `${origin}/api/telegram/webhook/${botIdHex}`;
}

function newWebhookSecret(): string {
    // Telegram requires 1–256 chars in [A-Za-z0-9_-]
    return crypto.randomBytes(32).toString('base64url');
}

function normalize<T>(doc: T): T {
    return JSON.parse(JSON.stringify(doc));
}

async function requireBot(botId: string): Promise<
    | { ok: true; bot: WithId<TelegramBot> }
    | { ok: false; error: string }
> {
    if (!ObjectId.isValid(botId)) return { ok: false, error: 'Invalid bot id.' };
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Not authenticated.' };

    const { db } = await connectToDatabase();
    const bot = await db
        .collection<TelegramBot>('telegram_bots')
        .findOne({ _id: new ObjectId(botId) });
    if (!bot) return { ok: false, error: 'Bot not found.' };

    const project = await getProjectById(bot.projectId.toString());
    if (!project) return { ok: false, error: 'Access denied.' };
    return { ok: true, bot };
}

/* ── bots ──────────────────────────────────────────────────────── */

export async function listTelegramBots(projectId: string): Promise<WithId<TelegramBot>[]> {
    try {
        const project = await getProjectById(projectId);
        if (!project) return [];
        const { db } = await connectToDatabase();
        const bots = await db
            .collection<TelegramBot>('telegram_bots')
            .find({ projectId: project._id })
            .sort({ createdAt: -1 })
            .toArray();
        return normalize(bots);
    } catch (err) {
        console.error('[telegram.listBots]', err);
        return [];
    }
}

export async function getTelegramBot(botId: string): Promise<WithId<TelegramBot> | null> {
    const r = await requireBot(botId);
    if (!r.ok) return null;
    return normalize(r.bot);
}

export async function connectTelegramBot(input: {
    projectId: string;
    token: string;
}): Promise<ActionResult<{ botId: string }>> {
    try {
        const token = input.token.trim();
        if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
            return { success: false, error: 'Token format looks wrong. Expected 123456:AAA-token.' };
        }
        const project = await getProjectById(input.projectId);
        if (!project) return { success: false, error: 'Project not found.' };
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Not authenticated.' };

        // Validate against Telegram
        const me = await TelegramBotApi.getMe(token);
        if (!me.is_bot || !me.username) {
            return { success: false, error: 'Token does not belong to a bot.' };
        }

        const { db } = await connectToDatabase();

        // Prevent duplicate registrations across projects.
        const existing = await db
            .collection<TelegramBot>('telegram_bots')
            .findOne({ botId: me.id });
        if (existing && !existing.projectId.equals(project._id)) {
            return {
                success: false,
                error: 'This bot is already linked to another workspace.',
            };
        }

        const now = new Date();
        const webhookSecret = newWebhookSecret();

        const res = await db.collection<TelegramBot>('telegram_bots').findOneAndUpdate(
            { botId: me.id },
            {
                $setOnInsert: {
                    projectId: project._id,
                    userId: new ObjectId(session.user._id),
                    botId: me.id,
                    createdAt: now,
                },
                $set: {
                    username: me.username,
                    name: [me.first_name, me.last_name].filter(Boolean).join(' ').trim() || me.username,
                    token,
                    webhookSecret,
                    canJoinGroups: me.can_join_groups ?? false,
                    canReadAllGroupMessages: me.can_read_all_group_messages ?? false,
                    supportsInlineQueries: me.supports_inline_queries ?? false,
                    isActive: true,
                    updatedAt: now,
                },
            },
            { upsert: true, returnDocument: 'after' },
        );

        const botDoc = res;
        if (!botDoc) return { success: false, error: 'Failed to persist bot.' };

        const botIdHex = botDoc._id.toString();
        const webhookUrl = buildWebhookUrl(botIdHex);

        if (!webhookUrl.startsWith('https://')) {
            // Save the bot anyway — user can register the webhook later.
            return {
                success: true,
                botId: botIdHex,
                message:
                    'Bot saved, but NEXT_PUBLIC_APP_URL must be an https URL before the webhook can be registered.',
            };
        }

        await TelegramBotApi.setWebhook(token, {
            url: webhookUrl,
            secret_token: webhookSecret,
            allowed_updates: [
                'message',
                'edited_message',
                'channel_post',
                'callback_query',
                'inline_query',
                'my_chat_member',
                'business_connection',
                'business_message',
                'edited_business_message',
            ],
        });

        await db.collection<TelegramBot>('telegram_bots').updateOne(
            { _id: botDoc._id },
            {
                $set: {
                    webhookUrl,
                    webhookRegisteredAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );

        invalidateTelegramBotCache(botIdHex);
        revalidatePath('/dashboard/telegram', 'layout');
        return { success: true, botId: botIdHex, message: `Connected @${me.username}.` };
    } catch (err) {
        if (err instanceof TelegramApiError) {
            return { success: false, error: err.description };
        }
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function disconnectTelegramBot(botId: string): Promise<ActionResult> {
    try {
        const r = await requireBot(botId);
        if (!r.ok) return { success: false, error: r.error };

        try {
            await TelegramBotApi.deleteWebhook(r.bot.token, true);
        } catch {
            /* best effort — if Telegram says the token is invalid we still remove locally */
        }

        const { db } = await connectToDatabase();
        await db.collection<TelegramBot>('telegram_bots').updateOne(
            { _id: r.bot._id },
            { $set: { isActive: false, updatedAt: new Date() } },
        );

        invalidateTelegramBotCache(botId);
        revalidatePath('/dashboard/telegram', 'layout');
        return { success: true, message: 'Bot disconnected.' };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function refreshTelegramWebhookInfo(botId: string): Promise<ActionResult> {
    try {
        const r = await requireBot(botId);
        if (!r.ok) return { success: false, error: r.error };

        const info = await TelegramBotApi.getWebhookInfo(r.bot.token);
        const { db } = await connectToDatabase();
        await db.collection<TelegramBot>('telegram_bots').updateOne(
            { _id: r.bot._id },
            {
                $set: {
                    webhookInfo: {
                        url: info.url,
                        pendingUpdateCount: info.pending_update_count,
                        lastErrorMessage: info.last_error_message,
                        lastErrorDate: info.last_error_date
                            ? new Date(info.last_error_date * 1000)
                            : undefined,
                    },
                    updatedAt: new Date(),
                },
            },
        );
        invalidateTelegramBotCache(botId);
        return { success: true };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function rotateTelegramWebhookSecret(botId: string): Promise<ActionResult> {
    try {
        const r = await requireBot(botId);
        if (!r.ok) return { success: false, error: r.error };
        const secret = newWebhookSecret();
        const url = r.bot.webhookUrl ?? buildWebhookUrl(botId);
        await TelegramBotApi.setWebhook(r.bot.token, {
            url,
            secret_token: secret,
            allowed_updates: [
                'message',
                'edited_message',
                'channel_post',
                'callback_query',
                'inline_query',
                'my_chat_member',
                'business_connection',
                'business_message',
                'edited_business_message',
            ],
        });
        const { db } = await connectToDatabase();
        await db.collection<TelegramBot>('telegram_bots').updateOne(
            { _id: r.bot._id },
            { $set: { webhookSecret: secret, webhookUrl: url, updatedAt: new Date() } },
        );
        invalidateTelegramBotCache(botId);
        return { success: true, message: 'Webhook secret rotated.' };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function setTelegramBotCommands(
    botId: string,
    commands: Array<{ command: string; description: string }>,
): Promise<ActionResult> {
    try {
        const r = await requireBot(botId);
        if (!r.ok) return { success: false, error: r.error };
        await TelegramBotApi.setMyCommands(r.bot.token, { commands });
        const { db } = await connectToDatabase();
        await db.collection<TelegramBot>('telegram_bots').updateOne(
            { _id: r.bot._id },
            { $set: { commands, updatedAt: new Date() } },
        );
        invalidateTelegramBotCache(botId);
        return { success: true, message: 'Commands saved.' };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── chats & messages ──────────────────────────────────────────── */

export async function listTelegramChats(
    botId: string,
    query?: string,
    limit = 50,
): Promise<WithId<TelegramChat>[]> {
    const r = await requireBot(botId);
    if (!r.ok) return [];
    const { db } = await connectToDatabase();
    const filter: Filter<TelegramChat> = { botId: r.bot._id };
    if (query) {
        filter.$or = [
            { username: { $regex: query, $options: 'i' } },
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { title: { $regex: query, $options: 'i' } },
            { chatId: query },
        ];
    }
    const chats = await db
        .collection<TelegramChat>('telegram_chats')
        .find(filter)
        .sort({ lastMessageAt: -1 })
        .limit(Math.min(Math.max(limit, 1), 500))
        .toArray();
    return normalize(chats);
}

export async function listTelegramMessages(
    botId: string,
    chatId: string,
    limit = 100,
): Promise<WithId<TelegramMessage>[]> {
    const r = await requireBot(botId);
    if (!r.ok) return [];
    const { db } = await connectToDatabase();
    const msgs = await db
        .collection<TelegramMessage>('telegram_messages')
        .find({ botId: r.bot._id, chatId })
        .sort({ messageId: -1 })
        .limit(Math.min(Math.max(limit, 1), 500))
        .toArray();
    return normalize(msgs.reverse());
}

export async function markTelegramChatRead(
    botId: string,
    chatId: string,
): Promise<ActionResult> {
    const r = await requireBot(botId);
    if (!r.ok) return { success: false, error: r.error };
    const { db } = await connectToDatabase();
    await db.collection<TelegramChat>('telegram_chats').updateOne(
        { botId: r.bot._id, chatId },
        { $set: { unreadCount: 0, updatedAt: new Date() } },
    );
    return { success: true };
}

export async function sendTelegramTextMessage(input: {
    botId: string;
    chatId: string;
    text: string;
    replyToMessageId?: number;
    businessConnectionId?: string;
    parseMode?: 'HTML' | 'MarkdownV2';
}): Promise<ActionResult<{ messageId: number }>> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };

        const sent = await TelegramBotApi.sendMessage(r.bot.token, {
            chat_id: input.chatId,
            text: input.text,
            parse_mode: input.parseMode,
            reply_to_message_id: input.replyToMessageId,
            business_connection_id: input.businessConnectionId,
        });

        const { db } = await connectToDatabase();
        const now = new Date();
        await db.collection<TelegramMessage>('telegram_messages').insertOne({
            botId: r.bot._id,
            projectId: r.bot.projectId,
            chatId: input.chatId,
            messageId: sent.message_id,
            direction: 'outbound',
            type: 'text',
            text: input.text,
            businessConnectionId: input.businessConnectionId,
            replyToMessageId: input.replyToMessageId,
            status: 'sent',
            createdAt: now,
        } as any);

        await db.collection<TelegramChat>('telegram_chats').updateOne(
            { botId: r.bot._id, chatId: input.chatId },
            {
                $set: {
                    lastMessageId: sent.message_id,
                    lastMessageAt: now,
                    lastMessagePreview: input.text.slice(0, 140),
                    updatedAt: now,
                },
            },
        );

        return { success: true, messageId: sent.message_id };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── broadcasts ────────────────────────────────────────────────── */

export async function createTelegramBroadcast(input: {
    botId: string;
    name: string;
    audience: TelegramBroadcast['audience'];
    message: TelegramBroadcast['message'];
    scheduledAt?: Date;
}): Promise<ActionResult<{ broadcastId: string }>> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Not authenticated.' };

        const { db } = await connectToDatabase();
        const now = new Date();
        const ins = await db.collection<TelegramBroadcast>('telegram_broadcasts').insertOne({
            botId: r.bot._id,
            projectId: r.bot.projectId,
            userId: new ObjectId(session.user._id),
            name: input.name,
            audience: input.audience,
            message: input.message,
            status: input.scheduledAt ? 'QUEUED' : 'DRAFT',
            stats: { total: 0, sent: 0, failed: 0 },
            scheduledAt: input.scheduledAt,
            createdAt: now,
            updatedAt: now,
        } as any);

        revalidatePath('/dashboard/telegram/broadcasts');
        return { success: true, broadcastId: ins.insertedId.toString() };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function sendTelegramBroadcastNow(broadcastId: string): Promise<ActionResult> {
    try {
        if (!ObjectId.isValid(broadcastId)) {
            return { success: false, error: 'Invalid broadcast id.' };
        }
        const { db } = await connectToDatabase();
        const broadcast = await db
            .collection<TelegramBroadcast>('telegram_broadcasts')
            .findOne({ _id: new ObjectId(broadcastId) });
        if (!broadcast) return { success: false, error: 'Broadcast not found.' };

        const r = await requireBot(broadcast.botId.toString());
        if (!r.ok) return { success: false, error: r.error };

        // Gather audience
        let chats: Pick<WithId<TelegramChat>, 'chatId'>[] = [];
        if (broadcast.audience.kind === 'channel' && broadcast.audience.channelChatId) {
            chats = [{ _id: new ObjectId(), chatId: broadcast.audience.channelChatId } as any];
        } else {
            const filter: Filter<TelegramChat> = {
                botId: r.bot._id,
                isOptedOut: { $ne: true },
                type: 'private',
            };
            if (broadcast.audience.kind === 'tag' && broadcast.audience.tag) {
                filter.tags = broadcast.audience.tag;
            }
            chats = await db
                .collection<TelegramChat>('telegram_chats')
                .find(filter, { projection: { chatId: 1 } })
                .toArray();
        }

        await db.collection<TelegramBroadcast>('telegram_broadcasts').updateOne(
            { _id: broadcast._id },
            {
                $set: {
                    status: 'SENDING',
                    startedAt: new Date(),
                    'stats.total': chats.length,
                    updatedAt: new Date(),
                },
            },
        );

        // Throttled send (~25 msg/s to stay well under the 30 msg/s global cap).
        let sent = 0;
        let failed = 0;
        const batchSize = 25;
        for (let i = 0; i < chats.length; i += batchSize) {
            const batch = chats.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map((c) => sendBroadcastToChat(r.bot!, c.chatId, broadcast.message)),
            );
            for (const res of results) {
                if (res.status === 'fulfilled') sent += 1;
                else failed += 1;
            }
            if (i + batchSize < chats.length) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        await db.collection<TelegramBroadcast>('telegram_broadcasts').updateOne(
            { _id: broadcast._id },
            {
                $set: {
                    status: failed === chats.length && chats.length > 0 ? 'FAILED' : 'COMPLETED',
                    finishedAt: new Date(),
                    'stats.sent': sent,
                    'stats.failed': failed,
                    updatedAt: new Date(),
                },
            },
        );

        revalidatePath('/dashboard/telegram/broadcasts');
        return { success: true, message: `Sent ${sent}, failed ${failed}.` };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

async function sendBroadcastToChat(
    bot: WithId<TelegramBot>,
    chatId: string,
    message: TelegramBroadcast['message'],
): Promise<void> {
    const reply_markup = message.buttons?.length
        ? {
              inline_keyboard: [
                  message.buttons.map((b) =>
                      b.url
                          ? { text: b.text, url: b.url }
                          : { text: b.text, callback_data: b.callbackData ?? b.text },
                  ),
              ],
          }
        : undefined;

    if (message.type === 'text' && message.text) {
        await TelegramBotApi.sendMessage(bot.token, {
            chat_id: chatId,
            text: message.text,
            parse_mode: message.parseMode,
            disable_notification: message.disableNotification,
            reply_markup,
        });
    } else if (message.type === 'photo' && message.mediaUrl) {
        await TelegramBotApi.sendPhoto(bot.token, {
            chat_id: chatId,
            photo: message.mediaUrl,
            caption: message.caption,
            parse_mode: message.parseMode,
            reply_markup,
        });
    } else if (message.type === 'video' && message.mediaUrl) {
        await TelegramBotApi.sendVideo(bot.token, {
            chat_id: chatId,
            video: message.mediaUrl,
            caption: message.caption,
            parse_mode: message.parseMode,
            reply_markup,
        });
    } else if (message.type === 'document' && message.mediaUrl) {
        await TelegramBotApi.sendDocument(bot.token, {
            chat_id: chatId,
            document: message.mediaUrl,
            caption: message.caption,
            parse_mode: message.parseMode,
        });
    } else {
        throw new Error('Invalid broadcast message payload.');
    }
}

export async function listTelegramBroadcasts(
    botId: string,
): Promise<WithId<TelegramBroadcast>[]> {
    const r = await requireBot(botId);
    if (!r.ok) return [];
    const { db } = await connectToDatabase();
    const rows = await db
        .collection<TelegramBroadcast>('telegram_broadcasts')
        .find({ botId: r.bot._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
    return normalize(rows);
}

/* ── bot profile & menu button ─────────────────────────────────── */

export async function updateTelegramBotProfile(input: {
    botId: string;
    name?: string;
    description?: string;
    shortDescription?: string;
    miniAppUrl?: string;
    paymentProviderToken?: string;
}): Promise<ActionResult> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };

        if (typeof input.name === 'string' && input.name !== r.bot.name) {
            await TelegramBotApi.setMyName(r.bot.token, { name: input.name.slice(0, 64) });
        }
        if (typeof input.description === 'string') {
            await TelegramBotApi.setMyDescription(r.bot.token, {
                description: input.description.slice(0, 512),
            });
        }
        if (typeof input.shortDescription === 'string') {
            await TelegramBotApi.setMyShortDescription(r.bot.token, {
                short_description: input.shortDescription.slice(0, 120),
            });
        }

        const { db } = await connectToDatabase();
        const set: Partial<TelegramBot> & { updatedAt: Date } = { updatedAt: new Date() };
        if (input.name !== undefined) set.name = input.name;
        if (input.description !== undefined) set.description = input.description;
        if (input.shortDescription !== undefined) set.shortDescription = input.shortDescription;
        if (input.miniAppUrl !== undefined) set.miniAppUrl = input.miniAppUrl;
        if (input.paymentProviderToken !== undefined)
            set.paymentProviderToken = input.paymentProviderToken;

        await db.collection<TelegramBot>('telegram_bots').updateOne(
            { _id: r.bot._id },
            { $set: set },
        );
        invalidateTelegramBotCache(input.botId);
        revalidatePath('/dashboard/telegram', 'layout');
        return { success: true, message: 'Profile updated.' };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function setTelegramMenuButton(input: {
    botId: string;
    menuButton:
        | { type: 'default' }
        | { type: 'commands' }
        | { type: 'web_app'; text: string; url: string };
}): Promise<ActionResult> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };

        const menu = input.menuButton;
        const tgPayload =
            menu.type === 'web_app'
                ? { type: 'web_app' as const, text: menu.text, web_app: { url: menu.url } }
                : { type: menu.type };

        await TelegramBotApi.setChatMenuButton(r.bot.token, { menu_button: tgPayload });

        const { db } = await connectToDatabase();
        await db.collection<TelegramBot>('telegram_bots').updateOne(
            { _id: r.bot._id },
            { $set: { menuButton: menu, updatedAt: new Date() } },
        );
        invalidateTelegramBotCache(input.botId);
        return { success: true, message: 'Menu button updated.' };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function getTelegramBotCommands(botId: string): Promise<
    Array<{ command: string; description: string }>
> {
    const r = await requireBot(botId);
    if (!r.ok) return [];
    try {
        const cmds = await TelegramBotApi.getMyCommands(r.bot.token);
        return cmds;
    } catch {
        return r.bot.commands ?? [];
    }
}

/* ── contacts (chats used as CRM records) ─────────────────────── */

export async function tagTelegramChat(input: {
    botId: string;
    chatId: string;
    tags: string[];
    mode?: 'add' | 'remove' | 'set';
}): Promise<ActionResult> {
    const r = await requireBot(input.botId);
    if (!r.ok) return { success: false, error: r.error };
    const tags = input.tags
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 50);
    const { db } = await connectToDatabase();
    const filter = { botId: r.bot._id, chatId: input.chatId };
    const now = new Date();
    if (input.mode === 'remove') {
        await db.collection<TelegramChat>('telegram_chats').updateOne(filter, {
            $pull: { tags: { $in: tags } } as any,
            $set: { updatedAt: now },
        });
    } else if (input.mode === 'add' || !input.mode) {
        await db.collection<TelegramChat>('telegram_chats').updateOne(filter, {
            $addToSet: { tags: { $each: tags } } as any,
            $set: { updatedAt: now },
        });
    } else {
        await db.collection<TelegramChat>('telegram_chats').updateOne(filter, {
            $set: { tags, updatedAt: now },
        });
    }
    revalidatePath('/dashboard/telegram/contacts');
    return { success: true };
}

export async function optOutTelegramChat(input: {
    botId: string;
    chatId: string;
    isOptedOut: boolean;
}): Promise<ActionResult> {
    const r = await requireBot(input.botId);
    if (!r.ok) return { success: false, error: r.error };
    const { db } = await connectToDatabase();
    await db.collection<TelegramChat>('telegram_chats').updateOne(
        { botId: r.bot._id, chatId: input.chatId },
        { $set: { isOptedOut: input.isOptedOut, updatedAt: new Date() } },
    );
    revalidatePath('/dashboard/telegram/contacts');
    return { success: true };
}

export async function listTelegramTags(botId: string): Promise<Array<{ tag: string; count: number }>> {
    const r = await requireBot(botId);
    if (!r.ok) return [];
    const { db } = await connectToDatabase();
    const rows = await db
        .collection<TelegramChat>('telegram_chats')
        .aggregate<{ _id: string; count: number }>([
            { $match: { botId: r.bot._id, tags: { $exists: true, $ne: [] } } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 100 },
        ])
        .toArray();
    return rows.map((r) => ({ tag: r._id, count: r.count }));
}

export async function exportTelegramChatsCsv(botId: string): Promise<
    ActionResult<{ csv: string; filename: string }>
> {
    const r = await requireBot(botId);
    if (!r.ok) return { success: false, error: r.error };
    const { db } = await connectToDatabase();
    const rows = await db
        .collection<TelegramChat>('telegram_chats')
        .find({ botId: r.bot._id })
        .sort({ createdAt: -1 })
        .limit(10000)
        .toArray();
    const header = [
        'chat_id',
        'type',
        'username',
        'first_name',
        'last_name',
        'language',
        'last_message_at',
        'unread',
        'tags',
        'opted_out',
    ];
    const escape = (v: any) => {
        if (v === undefined || v === null) return '';
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const c of rows) {
        lines.push(
            [
                c.chatId,
                c.type,
                c.username,
                c.firstName,
                c.lastName,
                c.languageCode,
                c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : '',
                c.unreadCount ?? 0,
                (c.tags ?? []).join('|'),
                c.isOptedOut ? 'yes' : 'no',
            ]
                .map(escape)
                .join(','),
        );
    }
    return {
        success: true,
        csv: lines.join('\n'),
        filename: `telegram-contacts-${r.bot.username}-${Date.now()}.csv`,
    };
}

export async function deleteTelegramMessage(input: {
    botId: string;
    chatId: string;
    messageId: number;
}): Promise<ActionResult> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        await TelegramBotApi.deleteMessage(r.bot.token, input.chatId, input.messageId);
        const { db } = await connectToDatabase();
        await db.collection<TelegramMessage>('telegram_messages').deleteOne({
            botId: r.bot._id,
            chatId: input.chatId,
            messageId: input.messageId,
        });
        return { success: true };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function editTelegramMessage(input: {
    botId: string;
    chatId: string;
    messageId: number;
    text: string;
    parseMode?: 'HTML' | 'MarkdownV2';
}): Promise<ActionResult> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        await TelegramBotApi.editMessageText(r.bot.token, {
            chat_id: input.chatId,
            message_id: input.messageId,
            text: input.text,
            parse_mode: input.parseMode,
        });
        const { db } = await connectToDatabase();
        await db.collection<TelegramMessage>('telegram_messages').updateOne(
            { botId: r.bot._id, chatId: input.chatId, messageId: input.messageId },
            { $set: { text: input.text } },
        );
        return { success: true };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function forwardTelegramMessage(input: {
    botId: string;
    fromChatId: string;
    toChatId: string;
    messageId: number;
}): Promise<ActionResult<{ messageId: number }>> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        const sent = await TelegramBotApi.forwardMessage(r.bot.token, {
            chat_id: input.toChatId,
            from_chat_id: input.fromChatId,
            message_id: input.messageId,
        });
        return { success: true, messageId: sent.message_id };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function sendTelegramTypingAction(input: {
    botId: string;
    chatId: string;
    action?: 'typing' | 'upload_photo' | 'upload_video' | 'upload_document';
}): Promise<ActionResult> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        await TelegramBotApi.sendChatAction(r.bot.token, {
            chat_id: input.chatId,
            action: input.action ?? 'typing',
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── auto-reply rules ──────────────────────────────────────────── */

export async function listTelegramAutoReplyRules(
    botId: string,
): Promise<WithId<TelegramAutoReplyRule>[]> {
    const r = await requireBot(botId);
    if (!r.ok) return [];
    const { db } = await connectToDatabase();
    const rows = await db
        .collection<TelegramAutoReplyRule>('telegram_auto_replies')
        .find({ botId: r.bot._id })
        .sort({ priority: 1, createdAt: 1 })
        .toArray();
    return normalize(rows);
}

export async function upsertTelegramAutoReplyRule(input: {
    botId: string;
    ruleId?: string;
    name: string;
    trigger: TelegramAutoReplyRule['trigger'];
    pattern?: string;
    caseSensitive?: boolean;
    matchMode?: TelegramAutoReplyRule['matchMode'];
    response: TelegramAutoReplyRule['response'];
    flowId?: string;
    insideBusinessHoursOnly?: boolean;
    isActive?: boolean;
    priority?: number;
}): Promise<ActionResult<{ ruleId: string }>> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        const { db } = await connectToDatabase();
        const now = new Date();
        const base: Partial<TelegramAutoReplyRule> = {
            botId: r.bot._id,
            projectId: r.bot.projectId,
            name: input.name,
            trigger: input.trigger,
            pattern: input.pattern,
            caseSensitive: input.caseSensitive ?? false,
            matchMode: input.matchMode ?? 'contains',
            response: input.response,
            flowId: input.flowId && ObjectId.isValid(input.flowId) ? new ObjectId(input.flowId) : undefined,
            insideBusinessHoursOnly: input.insideBusinessHoursOnly ?? false,
            isActive: input.isActive ?? true,
            priority: input.priority ?? 100,
            updatedAt: now,
        };

        let ruleId: string;
        if (input.ruleId && ObjectId.isValid(input.ruleId)) {
            const res = await db.collection<TelegramAutoReplyRule>('telegram_auto_replies').updateOne(
                { _id: new ObjectId(input.ruleId), botId: r.bot._id },
                { $set: base },
            );
            if (res.matchedCount === 0) return { success: false, error: 'Rule not found.' };
            ruleId = input.ruleId;
        } else {
            const ins = await db.collection<TelegramAutoReplyRule>('telegram_auto_replies').insertOne({
                ...base,
                hits: 0,
                createdAt: now,
            } as any);
            ruleId = ins.insertedId.toString();
        }
        revalidatePath('/dashboard/telegram/auto-reply');
        return { success: true, ruleId };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function deleteTelegramAutoReplyRule(input: {
    botId: string;
    ruleId: string;
}): Promise<ActionResult> {
    const r = await requireBot(input.botId);
    if (!r.ok) return { success: false, error: r.error };
    if (!ObjectId.isValid(input.ruleId)) return { success: false, error: 'Invalid rule id.' };
    const { db } = await connectToDatabase();
    await db.collection<TelegramAutoReplyRule>('telegram_auto_replies').deleteOne({
        _id: new ObjectId(input.ruleId),
        botId: r.bot._id,
    });
    revalidatePath('/dashboard/telegram/auto-reply');
    return { success: true };
}

export async function toggleTelegramAutoReplyRule(input: {
    botId: string;
    ruleId: string;
    isActive: boolean;
}): Promise<ActionResult> {
    const r = await requireBot(input.botId);
    if (!r.ok) return { success: false, error: r.error };
    if (!ObjectId.isValid(input.ruleId)) return { success: false, error: 'Invalid rule id.' };
    const { db } = await connectToDatabase();
    await db.collection<TelegramAutoReplyRule>('telegram_auto_replies').updateOne(
        { _id: new ObjectId(input.ruleId), botId: r.bot._id },
        { $set: { isActive: input.isActive, updatedAt: new Date() } },
    );
    return { success: true };
}

/* ── channels ──────────────────────────────────────────────────── */

export async function listTelegramChannels(botId: string): Promise<WithId<TelegramChannel>[]> {
    const r = await requireBot(botId);
    if (!r.ok) return [];
    const { db } = await connectToDatabase();
    const rows = await db
        .collection<TelegramChannel>('telegram_channels')
        .find({ botId: r.bot._id })
        .sort({ createdAt: -1 })
        .toArray();
    return normalize(rows);
}

export async function linkTelegramChannel(input: {
    botId: string;
    chatId: string;
}): Promise<ActionResult<{ channelId: string }>> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };

        const info = await TelegramBotApi.getChat(r.bot.token, input.chatId);
        if (info.type !== 'channel' && info.type !== 'supergroup') {
            return { success: false, error: 'That chat is not a channel.' };
        }
        let memberCount: number | undefined;
        try {
            memberCount = await TelegramBotApi.getChatMemberCount(r.bot.token, input.chatId);
        } catch { /* ignore */ }

        const { db } = await connectToDatabase();
        const now = new Date();
        const res = await db.collection<TelegramChannel>('telegram_channels').findOneAndUpdate(
            { botId: r.bot._id, chatId: String(info.id) },
            {
                $setOnInsert: {
                    botId: r.bot._id,
                    projectId: r.bot.projectId,
                    chatId: String(info.id),
                    createdAt: now,
                },
                $set: {
                    title: info.title ?? info.username ?? String(info.id),
                    username: info.username,
                    description: info.description,
                    memberCount,
                    canPost: true,
                    lastSyncedAt: now,
                    updatedAt: now,
                },
            },
            { upsert: true, returnDocument: 'after' },
        );
        if (!res) return { success: false, error: 'Failed to link channel.' };
        revalidatePath('/dashboard/telegram/channels');
        return { success: true, channelId: res._id.toString() };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function unlinkTelegramChannel(input: {
    botId: string;
    channelId: string;
}): Promise<ActionResult> {
    const r = await requireBot(input.botId);
    if (!r.ok) return { success: false, error: r.error };
    if (!ObjectId.isValid(input.channelId)) return { success: false, error: 'Invalid channel id.' };
    const { db } = await connectToDatabase();
    await db.collection<TelegramChannel>('telegram_channels').deleteOne({
        _id: new ObjectId(input.channelId),
        botId: r.bot._id,
    });
    revalidatePath('/dashboard/telegram/channels');
    return { success: true };
}

export async function scheduleTelegramChannelPost(input: {
    botId: string;
    channelId: string;
    message: TelegramBroadcast['message'];
    scheduledAt: Date;
}): Promise<ActionResult<{ postId: string }>> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        if (!ObjectId.isValid(input.channelId)) return { success: false, error: 'Invalid channel id.' };
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Not authenticated.' };

        const { db } = await connectToDatabase();
        const now = new Date();
        const ins = await db.collection<TelegramScheduledPost>('telegram_scheduled_posts').insertOne({
            botId: r.bot._id,
            projectId: r.bot.projectId,
            userId: new ObjectId(session.user._id),
            channelId: new ObjectId(input.channelId),
            message: input.message,
            scheduledAt: input.scheduledAt,
            status: 'QUEUED',
            createdAt: now,
            updatedAt: now,
        } as any);
        revalidatePath('/dashboard/telegram/channels');
        return { success: true, postId: ins.insertedId.toString() };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── quick replies (business inbox) ────────────────────────────── */

export async function listTelegramQuickReplies(
    projectId: string,
): Promise<WithId<TelegramQuickReply>[]> {
    const project = await getProjectById(projectId);
    if (!project) return [];
    const { db } = await connectToDatabase();
    const rows = await db
        .collection<TelegramQuickReply>('telegram_quick_replies')
        .find({ projectId: project._id })
        .sort({ shortcut: 1 })
        .toArray();
    return normalize(rows);
}

export async function upsertTelegramQuickReply(input: {
    projectId: string;
    botId: string;
    replyId?: string;
    shortcut: string;
    text: string;
    parseMode?: 'HTML' | 'MarkdownV2';
}): Promise<ActionResult<{ replyId: string }>> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Not authenticated.' };

        const shortcut = input.shortcut.trim();
        if (!shortcut) return { success: false, error: 'Shortcut is required.' };

        const { db } = await connectToDatabase();
        const now = new Date();

        if (input.replyId && ObjectId.isValid(input.replyId)) {
            await db.collection<TelegramQuickReply>('telegram_quick_replies').updateOne(
                { _id: new ObjectId(input.replyId), projectId: r.bot.projectId },
                { $set: { shortcut, text: input.text, parseMode: input.parseMode, updatedAt: now } },
            );
            return { success: true, replyId: input.replyId };
        }
        const ins = await db.collection<TelegramQuickReply>('telegram_quick_replies').insertOne({
            botId: r.bot._id,
            projectId: r.bot.projectId,
            userId: new ObjectId(session.user._id),
            shortcut,
            text: input.text,
            parseMode: input.parseMode,
            createdAt: now,
            updatedAt: now,
        } as any);
        return { success: true, replyId: ins.insertedId.toString() };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function deleteTelegramQuickReply(input: {
    projectId: string;
    replyId: string;
}): Promise<ActionResult> {
    const project = await getProjectById(input.projectId);
    if (!project) return { success: false, error: 'Project not found.' };
    if (!ObjectId.isValid(input.replyId)) return { success: false, error: 'Invalid reply id.' };
    const { db } = await connectToDatabase();
    await db.collection<TelegramQuickReply>('telegram_quick_replies').deleteOne({
        _id: new ObjectId(input.replyId),
        projectId: project._id,
    });
    return { success: true };
}

/* ── workspace settings ────────────────────────────────────────── */

export async function getTelegramSettings(
    projectId: string,
): Promise<WithId<TelegramSettings> | null> {
    const project = await getProjectById(projectId);
    if (!project) return null;
    const { db } = await connectToDatabase();
    const s = await db
        .collection<TelegramSettings>('telegram_settings')
        .findOne({ projectId: project._id });
    return s ? normalize(s) : null;
}

export async function updateTelegramSettings(input: {
    projectId: string;
    defaultBotId?: string | null;
    businessHours?: TelegramSettings['businessHours'];
    agentSignature?: string;
    paymentProviderToken?: string;
    paymentCurrency?: string;
}): Promise<ActionResult> {
    try {
        const project = await getProjectById(input.projectId);
        if (!project) return { success: false, error: 'Project not found.' };

        const { db } = await connectToDatabase();
        const now = new Date();
        const set: Record<string, any> = { updatedAt: now };
        if (input.defaultBotId === null) set.defaultBotId = null;
        else if (input.defaultBotId && ObjectId.isValid(input.defaultBotId))
            set.defaultBotId = new ObjectId(input.defaultBotId);
        if (input.businessHours !== undefined) set.businessHours = input.businessHours;
        if (input.agentSignature !== undefined) set.agentSignature = input.agentSignature;
        if (input.paymentProviderToken !== undefined)
            set.paymentProviderToken = input.paymentProviderToken;
        if (input.paymentCurrency !== undefined) set.paymentCurrency = input.paymentCurrency;

        await db.collection<TelegramSettings>('telegram_settings').updateOne(
            { projectId: project._id },
            {
                $setOnInsert: { projectId: project._id, createdAt: now },
                $set: set,
            },
            { upsert: true },
        );
        revalidatePath('/dashboard/telegram/settings');
        return { success: true, message: 'Settings saved.' };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── payments & invoices ───────────────────────────────────────── */

export async function createTelegramInvoice(input: {
    botId: string;
    chatId?: string;
    title: string;
    description: string;
    currency: string;
    prices: Array<{ label: string; amount: number }>;
    providerToken?: string;
    sendNow?: boolean;
    photoUrl?: string;
}): Promise<ActionResult<{ invoiceId: string; invoiceLink?: string }>> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        if (!input.prices.length) return { success: false, error: 'At least one price is required.' };

        const { db } = await connectToDatabase();
        const now = new Date();
        const ins = await db.collection<TelegramInvoice>('telegram_invoices').insertOne({
            botId: r.bot._id,
            projectId: r.bot.projectId,
            chatId: input.chatId,
            payload: '', // set below
            title: input.title,
            description: input.description,
            currency: input.currency.toUpperCase(),
            totalAmount: input.prices.reduce((n, p) => n + p.amount, 0),
            prices: input.prices,
            status: 'CREATED',
            createdAt: now,
            updatedAt: now,
        } as any);

        const invoiceId = ins.insertedId.toString();
        const payload = `inv_${invoiceId}`;
        const providerToken = input.providerToken ?? r.bot.paymentProviderToken;

        // XTR (Telegram Stars) does NOT need a provider token; anything else does.
        if (input.currency.toUpperCase() !== 'XTR' && !providerToken) {
            return { success: false, error: 'Payment provider token required for this currency.' };
        }

        let invoiceLink: string | undefined;
        let status: TelegramInvoice['status'] = 'CREATED';

        if (input.sendNow && input.chatId) {
            await TelegramBotApi.sendInvoice(r.bot.token, {
                chat_id: input.chatId,
                title: input.title,
                description: input.description,
                payload,
                provider_token: providerToken,
                currency: input.currency.toUpperCase(),
                prices: input.prices,
                photo_url: input.photoUrl,
            });
            status = 'SENT';
        } else {
            try {
                invoiceLink = await TelegramBotApi.createInvoiceLink(r.bot.token, {
                    title: input.title,
                    description: input.description,
                    payload,
                    provider_token: providerToken,
                    currency: input.currency.toUpperCase(),
                    prices: input.prices,
                });
            } catch { /* link optional */ }
        }

        await db.collection<TelegramInvoice>('telegram_invoices').updateOne(
            { _id: ins.insertedId },
            { $set: { payload, invoiceLink, status, updatedAt: new Date() } },
        );
        revalidatePath('/dashboard/telegram/payments');
        return { success: true, invoiceId, invoiceLink };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function listTelegramInvoices(
    botId: string,
): Promise<WithId<TelegramInvoice>[]> {
    const r = await requireBot(botId);
    if (!r.ok) return [];
    const { db } = await connectToDatabase();
    const rows = await db
        .collection<TelegramInvoice>('telegram_invoices')
        .find({ botId: r.bot._id })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
    return normalize(rows);
}

export async function refundTelegramStarPayment(input: {
    botId: string;
    invoiceId: string;
    userId: number;
    chargeId: string;
}): Promise<ActionResult> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        if (!ObjectId.isValid(input.invoiceId)) return { success: false, error: 'Invalid invoice id.' };

        await TelegramBotApi.refundStarPayment(r.bot.token, {
            user_id: input.userId,
            telegram_payment_charge_id: input.chargeId,
        });
        const { db } = await connectToDatabase();
        await db.collection<TelegramInvoice>('telegram_invoices').updateOne(
            { _id: new ObjectId(input.invoiceId), botId: r.bot._id },
            { $set: { status: 'REFUNDED', refundedAt: new Date(), updatedAt: new Date() } },
        );
        return { success: true, message: 'Refund issued.' };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── stickers ──────────────────────────────────────────────────── */

export async function listTelegramStickerSets(
    botId: string,
): Promise<WithId<TelegramStickerSet>[]> {
    const r = await requireBot(botId);
    if (!r.ok) return [];
    const { db } = await connectToDatabase();
    const rows = await db
        .collection<TelegramStickerSet>('telegram_sticker_sets')
        .find({ botId: r.bot._id })
        .sort({ createdAt: -1 })
        .toArray();
    return normalize(rows);
}

export async function createTelegramStickerSet(input: {
    botId: string;
    userId: number;
    name: string;
    title: string;
    stickers: Array<{ sticker: string; emojis: string[] }>;
    stickerType?: 'regular' | 'mask' | 'custom_emoji';
}): Promise<ActionResult<{ setId: string }>> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Not authenticated.' };

        const name = input.name.endsWith(`_by_${r.bot.username}`)
            ? input.name
            : `${input.name}_by_${r.bot.username}`;

        await TelegramBotApi.createNewStickerSet(r.bot.token, {
            user_id: input.userId,
            name,
            title: input.title,
            stickers: input.stickers.map((s) => ({
                sticker: s.sticker,
                emoji_list: s.emojis.slice(0, 20),
            })),
            sticker_type: input.stickerType ?? 'regular',
        });

        const { db } = await connectToDatabase();
        const now = new Date();
        const ins = await db.collection<TelegramStickerSet>('telegram_sticker_sets').insertOne({
            botId: r.bot._id,
            projectId: r.bot.projectId,
            userId: new ObjectId(session.user._id),
            name,
            title: input.title,
            stickerType: input.stickerType ?? 'regular',
            stickerCount: input.stickers.length,
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
        } as any);
        revalidatePath('/dashboard/telegram/stickers');
        return { success: true, setId: ins.insertedId.toString() };
    } catch (err) {
        if (err instanceof TelegramApiError) return { success: false, error: err.description };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function deleteTelegramStickerSet(input: {
    botId: string;
    setId: string;
}): Promise<ActionResult> {
    try {
        const r = await requireBot(input.botId);
        if (!r.ok) return { success: false, error: r.error };
        if (!ObjectId.isValid(input.setId)) return { success: false, error: 'Invalid set id.' };
        const { db } = await connectToDatabase();
        const set = await db
            .collection<TelegramStickerSet>('telegram_sticker_sets')
            .findOne({ _id: new ObjectId(input.setId), botId: r.bot._id });
        if (!set) return { success: false, error: 'Sticker set not found.' };

        try {
            await TelegramBotApi.deleteStickerSet(r.bot.token, set.name);
        } catch { /* may already be gone */ }

        await db.collection<TelegramStickerSet>('telegram_sticker_sets').deleteOne({
            _id: set._id,
        });
        revalidatePath('/dashboard/telegram/stickers');
        return { success: true };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── API credentials (MTProto / custom Bot API server) ─────────── */

export async function getTelegramApiCredentials(
    projectId: string,
): Promise<WithId<TelegramApiCredentials> | null> {
    const project = await getProjectById(projectId);
    if (!project) return null;
    const { db } = await connectToDatabase();
    const row = await db
        .collection<TelegramApiCredentials>('telegram_api_credentials')
        .findOne({ projectId: project._id });
    return row ? normalize(row) : null;
}

export async function saveTelegramApiCredentials(input: {
    projectId: string;
    apiId?: number;
    apiHash?: string;
    botApiServer?: string;
    sessionString?: string;
}): Promise<ActionResult> {
    try {
        const project = await getProjectById(input.projectId);
        if (!project) return { success: false, error: 'Project not found.' };
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Not authenticated.' };

        const { db } = await connectToDatabase();
        const now = new Date();
        const set: Record<string, any> = { updatedAt: now };
        if (input.apiId !== undefined) set.apiId = input.apiId;
        if (input.apiHash !== undefined) set.apiHash = input.apiHash;
        if (input.botApiServer !== undefined) set.botApiServer = input.botApiServer;
        if (input.sessionString !== undefined) set.sessionString = input.sessionString;

        await db.collection<TelegramApiCredentials>('telegram_api_credentials').updateOne(
            { projectId: project._id },
            {
                $setOnInsert: {
                    projectId: project._id,
                    userId: new ObjectId(session.user._id),
                    createdAt: now,
                },
                $set: set,
            },
            { upsert: true },
        );
        revalidatePath('/dashboard/telegram/api-credentials');
        return { success: true, message: 'Credentials saved.' };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── broadcasts: cancel & delete ───────────────────────────────── */

export async function cancelTelegramBroadcast(broadcastId: string): Promise<ActionResult> {
    try {
        if (!ObjectId.isValid(broadcastId)) return { success: false, error: 'Invalid broadcast id.' };
        const { db } = await connectToDatabase();
        const b = await db
            .collection<TelegramBroadcast>('telegram_broadcasts')
            .findOne({ _id: new ObjectId(broadcastId) });
        if (!b) return { success: false, error: 'Broadcast not found.' };
        const r = await requireBot(b.botId.toString());
        if (!r.ok) return { success: false, error: r.error };

        if (b.status === 'SENDING' || b.status === 'COMPLETED') {
            return { success: false, error: `Cannot cancel a ${b.status} broadcast.` };
        }
        await db.collection<TelegramBroadcast>('telegram_broadcasts').updateOne(
            { _id: b._id },
            { $set: { status: 'CANCELLED', updatedAt: new Date() } },
        );
        revalidatePath('/dashboard/telegram/broadcasts');
        return { success: true };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function deleteTelegramBroadcast(broadcastId: string): Promise<ActionResult> {
    try {
        if (!ObjectId.isValid(broadcastId)) return { success: false, error: 'Invalid broadcast id.' };
        const { db } = await connectToDatabase();
        const b = await db
            .collection<TelegramBroadcast>('telegram_broadcasts')
            .findOne({ _id: new ObjectId(broadcastId) });
        if (!b) return { success: false, error: 'Broadcast not found.' };
        const r = await requireBot(b.botId.toString());
        if (!r.ok) return { success: false, error: r.error };

        if (b.status === 'SENDING') {
            return { success: false, error: 'Cannot delete a broadcast while it is sending.' };
        }
        await db.collection<TelegramBroadcast>('telegram_broadcasts').deleteOne({ _id: b._id });
        revalidatePath('/dashboard/telegram/broadcasts');
        return { success: true };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── analytics ─────────────────────────────────────────────────── */

export async function getTelegramAnalytics(input: {
    botId: string;
    /** Number of days back to aggregate (default 30, max 90). */
    days?: number;
}): Promise<{
    totals: { messages: number; inbound: number; outbound: number; chats: number };
    timeseries: Array<{ date: string; inbound: number; outbound: number }>;
    topChats: Array<{ chatId: string; title: string; messages: number }>;
}> {
    const empty = {
        totals: { messages: 0, inbound: 0, outbound: 0, chats: 0 },
        timeseries: [],
        topChats: [],
    };
    const r = await requireBot(input.botId);
    if (!r.ok) return empty;

    const days = Math.min(Math.max(input.days ?? 30, 1), 90);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const { db } = await connectToDatabase();
    const col = db.collection<TelegramMessage>('telegram_messages');

    const [inbound, outbound, chats, seriesRaw, topRaw] = await Promise.all([
        col.countDocuments({ botId: r.bot._id, direction: 'inbound', createdAt: { $gte: since } }),
        col.countDocuments({ botId: r.bot._id, direction: 'outbound', createdAt: { $gte: since } }),
        db
            .collection<TelegramChat>('telegram_chats')
            .countDocuments({ botId: r.bot._id, lastMessageAt: { $gte: since } }),
        col
            .aggregate<{ _id: { date: string; direction: string }; count: number }>([
                { $match: { botId: r.bot._id, createdAt: { $gte: since } } },
                {
                    $group: {
                        _id: {
                            date: {
                                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                            },
                            direction: '$direction',
                        },
                        count: { $sum: 1 },
                    },
                },
            ])
            .toArray(),
        col
            .aggregate<{ _id: string; count: number }>([
                { $match: { botId: r.bot._id, createdAt: { $gte: since } } },
                { $group: { _id: '$chatId', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ])
            .toArray(),
    ]);

    const byDate = new Map<string, { inbound: number; outbound: number }>();
    for (const row of seriesRaw) {
        const d = row._id.date;
        const entry = byDate.get(d) ?? { inbound: 0, outbound: 0 };
        if (row._id.direction === 'inbound') entry.inbound = row.count;
        else entry.outbound = row.count;
        byDate.set(d, entry);
    }
    const timeseries = Array.from(byDate.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const topChats: Array<{ chatId: string; title: string; messages: number }> = [];
    if (topRaw.length) {
        const chatDocs = await db
            .collection<TelegramChat>('telegram_chats')
            .find({ botId: r.bot._id, chatId: { $in: topRaw.map((r) => r._id) } })
            .toArray();
        const titleFor = (chatId: string) => {
            const c = chatDocs.find((d) => d.chatId === chatId);
            if (!c) return chatId;
            return (
                c.title ||
                c.username ||
                [c.firstName, c.lastName].filter(Boolean).join(' ') ||
                chatId
            );
        };
        for (const r2 of topRaw) {
            topChats.push({ chatId: r2._id, title: titleFor(r2._id), messages: r2.count });
        }
    }

    return {
        totals: { messages: inbound + outbound, inbound, outbound, chats },
        timeseries,
        topChats,
    };
}

/* ── counters ──────────────────────────────────────────────────── */

export async function getTelegramOverview(projectId: string): Promise<{
    bots: number;
    activeChats: number;
    broadcasts: number;
}> {
    try {
        const project = await getProjectById(projectId);
        if (!project) return { bots: 0, activeChats: 0, broadcasts: 0 };
        const { db } = await connectToDatabase();
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        const [bots, activeChats, broadcasts] = await Promise.all([
            db.collection('telegram_bots').countDocuments({ projectId: project._id, isActive: true }),
            db
                .collection('telegram_chats')
                .countDocuments({ projectId: project._id, lastMessageAt: { $gte: since } }),
            db
                .collection('telegram_broadcasts')
                .countDocuments({
                    projectId: project._id,
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
                }),
        ]);
        return { bots, activeChats, broadcasts };
    } catch {
        return { bots: 0, activeChats: 0, broadcasts: 0 };
    }
}
