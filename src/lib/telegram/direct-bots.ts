import 'server-only';

import crypto from 'node:crypto';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import type { TelegramBot } from '@/lib/definitions';
import { TelegramBotApi, TelegramApiError } from './bot-api';
import { invalidateTelegramBotCache } from './bot-cache';
import { getProjectById } from '@/app/actions/project.actions';
import { getSession } from '@/app/actions/user.actions';

/**
 * TS-direct fallback for the Telegram bot lifecycle (list / connect /
 * disconnect). The canonical implementation lives in the Rust BFF
 * (`rust/crates/telegram-bots`), but until that binary is deployed —
 * or whenever it returns 404 / 5xx — these functions keep the UI
 * usable by writing straight to Mongo and talking to Telegram directly.
 *
 * Behaviour mirrors the Rust handler (`handlers::connect_bot`):
 *   1. Validate token shape.
 *   2. Call getMe and verify it really is a bot.
 *   3. Upsert in `telegram_bots`, fenced on numeric `botId` so the
 *      same bot can't be linked to two workspaces.
 *   4. Mint a fresh webhook secret and register the webhook with
 *      Telegram, persisting the URL.
 *
 * Validation regexes intentionally mirror the Rust ones so payloads
 * accepted by one path are accepted by the other.
 */

const TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;
const ALLOWED_UPDATES: string[] = [
    'message',
    'edited_message',
    'channel_post',
    'edited_channel_post',
    'business_connection',
    'business_message',
    'edited_business_message',
    'deleted_business_messages',
    'callback_query',
    'inline_query',
    'my_chat_member',
    'chat_member',
    'pre_checkout_query',
];

function buildWebhookUrl(botIdHex: string): string | null {
    const raw =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
        process.env.VERCEL_URL ||
        '';
    if (!raw) return null;
    const origin = raw.startsWith('http') ? raw : `https://${raw}`;
    if (!origin.startsWith('https://')) return null;
    return `${origin}/api/telegram/webhook/${botIdHex}`;
}

function newWebhookSecret(): string {
    return crypto.randomBytes(32).toString('base64url');
}

export type DirectBotRow = {
    _id: string;
    projectId: string;
    userId: string;
    botId: number;
    username: string;
    name: string;
    isActive: boolean;
    webhookUrl?: string;
    webhookRegisteredAt?: string;
    status: 'active' | 'disconnected' | 'error';
    createdAt: string;
    updatedAt: string;
};

function rowFromDoc(doc: WithId<TelegramBot> & Record<string, any>): DirectBotRow {
    return {
        _id: doc._id.toString(),
        projectId: (doc.projectId as ObjectId).toString(),
        userId: (doc.userId as ObjectId).toString(),
        botId: Number(doc.botId ?? 0),
        username: String(doc.username ?? ''),
        name: String(doc.name ?? doc.username ?? ''),
        isActive: Boolean(doc.isActive),
        webhookUrl: doc.webhookUrl,
        webhookRegisteredAt:
            doc.webhookRegisteredAt instanceof Date
                ? doc.webhookRegisteredAt.toISOString()
                : doc.webhookRegisteredAt,
        status: doc.isActive ? 'active' : 'disconnected',
        createdAt:
            doc.createdAt instanceof Date
                ? doc.createdAt.toISOString()
                : String(doc.createdAt ?? new Date().toISOString()),
        updatedAt:
            doc.updatedAt instanceof Date
                ? doc.updatedAt.toISOString()
                : String(doc.updatedAt ?? new Date().toISOString()),
    };
}

export async function listTelegramBotsDirect(projectId: string): Promise<DirectBotRow[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const project = await getProjectById(projectId);
    if (!project) return [];
    const { db } = await connectToDatabase();
    const docs = await db
        .collection<TelegramBot>('telegram_bots')
        .find({ projectId: new ObjectId(projectId) })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
    return docs.map((d) => rowFromDoc(d as any));
}

export type ConnectDirectResult = {
    success: boolean;
    error?: string;
    message?: string;
    botId?: string;
};

export async function connectTelegramBotDirect(input: {
    projectId: string;
    token: string;
}): Promise<ConnectDirectResult> {
    const token = input.token.trim();
    if (!TOKEN_RE.test(token)) {
        return {
            success: false,
            error: 'Token format looks wrong. Expected 123456:AAA-token from @BotFather.',
        };
    }
    if (!ObjectId.isValid(input.projectId)) {
        return { success: false, error: 'Invalid project id.' };
    }

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Not authenticated.' };

    const project = await getProjectById(input.projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    let me: Awaited<ReturnType<typeof TelegramBotApi.getMe>>;
    try {
        me = await TelegramBotApi.getMe(token);
    } catch (err) {
        if (err instanceof TelegramApiError) {
            return { success: false, error: err.description };
        }
        return { success: false, error: 'Could not reach Telegram with that token.' };
    }
    if (!me.is_bot) {
        return { success: false, error: 'Token does not belong to a bot.' };
    }
    const username = me.username && me.username.length > 0 ? me.username : null;
    if (!username) {
        return { success: false, error: 'Token does not belong to a bot.' };
    }

    const { db } = await connectToDatabase();
    const bots = db.collection<TelegramBot>('telegram_bots');

    // Cross-project guard: same numeric bot can't live in two workspaces.
    const cross = await bots.findOne({ botId: me.id } as any);
    if (cross && (cross as any).projectId?.toString?.() !== input.projectId) {
        return {
            success: false,
            error: 'This bot is already linked to another workspace.',
        };
    }

    const now = new Date();
    const webhookSecret = newWebhookSecret();
    const displayName =
        [me.first_name, me.last_name].filter(Boolean).join(' ') || username;

    const updated = await bots.findOneAndUpdate(
        { botId: me.id } as any,
        {
            $setOnInsert: {
                projectId: new ObjectId(input.projectId),
                userId: new ObjectId(session.user._id),
                botId: me.id,
                createdAt: now,
            },
            $set: {
                username,
                name: displayName,
                token,
                webhookSecret,
                canJoinGroups: me.can_join_groups ?? false,
                canReadAllGroupMessages: me.can_read_all_group_messages ?? false,
                supportsInlineQueries: me.supports_inline_queries ?? false,
                isActive: true,
                updatedAt: now,
            },
        } as any,
        { upsert: true, returnDocument: 'after' },
    );
    if (!updated) {
        return { success: false, error: 'Failed to persist bot.' };
    }
    const botOid = updated._id;
    const botIdHex = botOid.toString();

    const webhookUrl = buildWebhookUrl(botIdHex);
    if (!webhookUrl) {
        invalidateTelegramBotCache(botIdHex);
        return {
            success: true,
            botId: botIdHex,
            message:
                'Bot saved, but NEXT_PUBLIC_APP_URL must be an https URL before the webhook can be registered.',
        };
    }

    try {
        await TelegramBotApi.setWebhook(token, {
            url: webhookUrl,
            secret_token: webhookSecret,
            allowed_updates: ALLOWED_UPDATES,
        });
    } catch (err) {
        invalidateTelegramBotCache(botIdHex);
        if (err instanceof TelegramApiError) {
            return { success: false, error: err.description };
        }
        return { success: false, error: 'Failed to register webhook with Telegram.' };
    }

    await bots.updateOne(
        { _id: botOid },
        {
            $set: {
                webhookUrl,
                webhookRegisteredAt: now,
                updatedAt: now,
            },
        },
    );

    invalidateTelegramBotCache(botIdHex);
    return {
        success: true,
        botId: botIdHex,
        message: `Connected @${username}.`,
    };
}

export async function disconnectTelegramBotDirect(botId: string): Promise<{
    success: boolean;
    error?: string;
    message?: string;
}> {
    if (!ObjectId.isValid(botId)) {
        return { success: false, error: 'Invalid bot id.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Not authenticated.' };

    const { db } = await connectToDatabase();
    const bot = await db
        .collection<TelegramBot>('telegram_bots')
        .findOne({ _id: new ObjectId(botId) });
    if (!bot) return { success: false, error: 'Bot not found.' };

    const project = await getProjectById((bot as any).projectId.toString());
    if (!project) return { success: false, error: 'Access denied.' };

    // Best-effort: tell Telegram to stop sending updates here. If the
    // token is stale or the API errors, we still mark the bot disabled
    // locally so the inbox stops pulling from it.
    try {
        await TelegramBotApi.deleteWebhook((bot as any).token, true);
    } catch {
        /* ignore — the local mark is what matters */
    }

    await db
        .collection<TelegramBot>('telegram_bots')
        .updateOne(
            { _id: bot._id },
            {
                $set: {
                    isActive: false,
                    webhookUrl: undefined,
                    updatedAt: new Date(),
                },
                $unset: { webhookRegisteredAt: '' as any },
            } as any,
        );

    invalidateTelegramBotCache(botId);
    return { success: true, message: 'Bot disconnected.' };
}
