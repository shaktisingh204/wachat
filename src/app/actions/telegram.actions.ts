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
import {
    connectTelegramBotDirect,
    disconnectTelegramBotDirect,
    listTelegramBotsDirect,
} from '@/lib/telegram/direct-bots';
import { rustClient, RustApiError } from '@/lib/rust-client';
import type { BotRow as TelegramBotRow } from '@/lib/rust-client/telegram-bots';
import { isRustUnavailable as sharedIsRustUnavailable, withRustFallback } from '@/lib/telegram/rust-fallback';

/**
 * Returns true when a thrown `RustApiError` means "the Rust handler isn't
 * answering". We use this to decide whether to silently fall back to the
 * direct-Mongo implementations in `lib/telegram/direct-bots.ts`. We treat
 * 404 (route not deployed yet) and 5xx (binary up but crashing) as the
 * fall-back-eligible cases. Auth / 4xx other than 404 propagate.
 */
function isRustUnavailable(err: unknown): boolean {
    if (!(err instanceof RustApiError)) return false;
    return err.status === 404 || err.status >= 500 || err.status === 0;
}

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

/* ── projects (Telegram-scoped workspaces) ────────────────────── */

/**
 * Create a brand-new project to host Telegram bots. Distinct from
 * `_createProjectFromWaba` — no Meta credentials are required, just a
 * display name. Telegram-only projects have empty `wabaId` and
 * `accessToken` so the Wachat picker (filtered by `wabaId`) won't list
 * them, but the shared `Project` collection means RBAC / plan / agent
 * plumbing still applies.
 */
export async function addTelegramProject(input: {
    name: string;
}): Promise<ActionResult<{ projectId: string; name: string }>> {
    try {
        const name = input.name?.trim();
        if (!name) return { success: false, error: 'Project name is required.' };
        if (name.length > 120) {
            return { success: false, error: 'Project name is too long (max 120 chars).' };
        }
        const session = await getSession();
        if (!session?.user)
            return { success: false, error: 'Not authenticated.' };

        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const now = new Date();

        // Soft duplicate guard — same owner + same name.
        const existing = await db
            .collection('projects')
            .findOne({ userId, name }, { projection: { _id: 1 } });
        if (existing) {
            return {
                success: false,
                error: 'You already have a project with that name.',
            };
        }

        const ins = await db.collection('projects').insertOne({
            userId,
            name,
            accessToken: '',
            phoneNumbers: [],
            // Discriminator so other modules' pickers (Wachat, CRM,
            // Facebook) skip this workspace, and the Telegram picker
            // shows it even before any bot is connected.
            kind: 'telegram',
            createdAt: now,
        } as any);

        revalidatePath('/dashboard/telegram/projects');
        return {
            success: true,
            projectId: ins.insertedId.toString(),
            name,
            message: 'Project created.',
        };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── bots ──────────────────────────────────────────────────────── */
//
// Bot lifecycle (list / get / connect / disconnect / refresh-webhook /
// rotate-secret) is served by the `telegram-bots` Rust crate. The TS
// actions below are thin pass-throughs that translate the Rust envelope
// into the `ActionResult` / row shape callers already expect.

type TelegramBotListRow = TelegramBotRow;

export async function listTelegramBots(projectId: string): Promise<TelegramBotRow[]> {
    try {
        const res = await rustClient.telegramBots.list(projectId);
        if (res.error) return [];
        return res.bots ?? [];
    } catch (err) {
        if (isRustUnavailable(err)) {
            const rows = await listTelegramBotsDirect(projectId);
            return rows as unknown as TelegramBotRow[];
        }
        if (err instanceof RustApiError) return [];
        console.error('[telegram.listBots]', err);
        return [];
    }
}

/**
 * Reads a single bot from Mongo and shapes it as the `BotRow` the
 * drawer expects. Used when the Rust BFF route isn't deployed yet, so
 * the UI can render bot details from the legacy collection. Tab-specific
 * fields the Rust handler computes (`webhookInfo`, `latencyMs`,
 * `lastSeenAt`, `status`) degrade to empty/derived values.
 */
async function getTelegramBotFromMongo(botId: string): Promise<TelegramBotRow | null> {
    try {
        if (!ObjectId.isValid(botId)) return null;
        const r = await requireBot(botId);
        if (!r.ok) return null;
        const b = r.bot as WithId<TelegramBot> & Record<string, any>;
        return {
            _id: b._id.toString(),
            projectId: (b.projectId as ObjectId).toString(),
            userId: (b.userId as ObjectId).toString(),
            botId: Number(b.botId ?? 0),
            username: String(b.username ?? ''),
            name: String(b.name ?? b.username ?? ''),
            isActive: Boolean(b.isActive),
            webhookUrl: b.webhookUrl,
            webhookRegisteredAt:
                b.webhookRegisteredAt instanceof Date
                    ? b.webhookRegisteredAt.toISOString()
                    : b.webhookRegisteredAt,
            webhookInfo: undefined,
            canJoinGroups: b.canJoinGroups,
            canReadAllGroupMessages: b.canReadAllGroupMessages,
            supportsInlineQueries: b.supportsInlineQueries,
            hasMainWebApp: undefined,
            status: b.isActive ? 'active' : 'disconnected',
            lastSeenAt: undefined,
            latencyMs: undefined,
            createdAt:
                b.createdAt instanceof Date
                    ? b.createdAt.toISOString()
                    : String(b.createdAt ?? new Date().toISOString()),
            updatedAt:
                b.updatedAt instanceof Date
                    ? b.updatedAt.toISOString()
                    : String(b.updatedAt ?? new Date().toISOString()),
        };
    } catch {
        return null;
    }
}

export async function getTelegramBot(botId: string): Promise<TelegramBotRow | null> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBots.get(botId);
                if (res.error || !res.bot) {
                    // No bot in Rust either — try Mongo so newly-attached
                    // legacy bots still render in the drawer.
                    return await getTelegramBotFromMongo(botId);
                }
                return res.bot;
            },
            () => getTelegramBotFromMongo(botId),
        );
    } catch (err) {
        if (err instanceof RustApiError) return null;
        return null;
    }
}

export async function connectTelegramBot(input: {
    projectId: string;
    token: string;
}): Promise<ActionResult<{ botId: string }>> {
    try {
        const res = await rustClient.telegramBots.connect({
            projectId: input.projectId,
            token: input.token,
        });
        if (!res.success) return { success: false, error: res.error };
        if (res.botId) invalidateTelegramBotCache(res.botId);
        revalidatePath('/dashboard/telegram', 'layout');
        return { success: true, botId: res.botId, message: res.message };
    } catch (err) {
        if (isRustUnavailable(err)) {
            const direct = await connectTelegramBotDirect(input);
            if (direct.success) {
                revalidatePath('/dashboard/telegram', 'layout');
            }
            return {
                success: direct.success,
                error: direct.error,
                message: direct.message,
                botId: direct.botId,
            };
        }
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function disconnectTelegramBot(botId: string): Promise<ActionResult> {
    try {
        const res = await rustClient.telegramBots.disconnect(botId);
        if (!res.success) return { success: false, error: res.error };
        invalidateTelegramBotCache(botId);
        revalidatePath('/dashboard/telegram', 'layout');
        return { success: true, message: res.message ?? 'Bot disconnected.' };
    } catch (err) {
        if (isRustUnavailable(err)) {
            const direct = await disconnectTelegramBotDirect(botId);
            if (direct.success) {
                revalidatePath('/dashboard/telegram', 'layout');
            }
            return direct;
        }
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function refreshTelegramWebhookInfo(botId: string): Promise<ActionResult> {
    try {
        const res = await rustClient.telegramBots.refreshWebhookInfo(botId);
        if (!res.success) return { success: false, error: res.error };
        invalidateTelegramBotCache(botId);
        return { success: true, message: res.message };
    } catch (err) {
        if (sharedIsRustUnavailable(err)) {
            return {
                success: false,
                error: 'Telegram backend is not deployed yet — change not saved.',
            };
        }
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function rotateTelegramWebhookSecret(botId: string): Promise<ActionResult> {
    try {
        const res = await rustClient.telegramBots.rotateWebhookSecret(botId);
        if (!res.success) return { success: false, error: res.error };
        invalidateTelegramBotCache(botId);
        return { success: true, message: res.message ?? 'Webhook secret rotated.' };
    } catch (err) {
        if (sharedIsRustUnavailable(err)) {
            return {
                success: false,
                error: 'Telegram backend is not deployed yet — change not saved.',
            };
        }
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function setTelegramBotCommands(
    botId: string,
    commands: Array<{ command: string; description: string }>,
): Promise<ActionResult> {
    const r = await requireBot(botId);
    if (!r.ok) return { success: false, error: r.error };
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBots.setCommands(botId, {
                    projectId: r.bot.projectId.toString(),
                    commands,
                });
                if (!res.success) return { success: false, error: res.error };
                invalidateTelegramBotCache(botId);
                return { success: true, message: res.message ?? 'Commands saved.' };
            },
            // Fallback: push directly to Telegram via Bot API, then mirror
            // the array on the bot doc so the next /getCommands fallback
            // returns the same payload.
            async () => {
                try {
                    await TelegramBotApi.setMyCommands(r.bot.token, { commands });
                } catch (err) {
                    if (err instanceof TelegramApiError) {
                        return { success: false, error: err.description };
                    }
                    throw err;
                }
                const { db } = await connectToDatabase();
                await db
                    .collection<TelegramBot>('telegram_bots')
                    .updateOne(
                        { _id: r.bot._id },
                        { $set: { commands, updatedAt: new Date() } },
                    );
                invalidateTelegramBotCache(botId);
                return { success: true, message: 'Commands saved (local fallback).' };
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── chats & messages ──────────────────────────────────────────── */
//
// Chat inbox (list / list-messages / send / mark-read) is served by the
// `telegram-chats` Rust crate. The TS actions below are thin
// pass-throughs that translate the Rust envelope into the
// `ActionResult` / row shape callers already expect.

import type {
    ChatRow as TelegramChatListRowType,
    MessageRow as TelegramMessageRowType,
} from '@/lib/rust-client/telegram-chats';

export async function listTelegramChats(
    botId: string,
    query?: string,
    limit = 50,
): Promise<TelegramChatListRowType[]> {
    try {
        const res = await rustClient.telegramChats.list(botId, query, limit);
        if (res.error) return [];
        return res.chats ?? [];
    } catch (err) {
        if (err instanceof RustApiError) return [];
        console.error('[telegram.listChats]', err);
        return [];
    }
}

export async function listTelegramMessages(
    botId: string,
    chatId: string,
    limit = 100,
): Promise<TelegramMessageRowType[]> {
    try {
        const res = await rustClient.telegramChats.messages(botId, chatId, limit);
        if (res.error) return [];
        return res.messages ?? [];
    } catch (err) {
        if (err instanceof RustApiError) return [];
        console.error('[telegram.listMessages]', err);
        return [];
    }
}

export async function markTelegramChatRead(
    botId: string,
    chatId: string,
): Promise<ActionResult> {
    try {
        const res = await rustClient.telegramChats.markRead(botId, chatId);
        if (!res.success) return { success: false, error: res.error };
        return { success: true, message: res.message };
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
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
        const res = await rustClient.telegramChats.sendText(input.botId, input.chatId, {
            text: input.text,
            replyToMessageId: input.replyToMessageId,
            businessConnectionId: input.businessConnectionId,
            parseMode: input.parseMode,
        });
        if (!res.success) return { success: false, error: res.error };
        return { success: true, messageId: res.messageId, message: res.message };
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── broadcasts ────────────────────────────────────────────────── */

export async function createTelegramBroadcast(input: {
    projectId: string;
    botId: string;
    name: string;
    audience: TelegramBroadcast['audience'];
    message: TelegramBroadcast['message'];
    scheduledAt?: Date;
}): Promise<ActionResult<{ broadcastId: string }>> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBroadcasts.create({
                    projectId: input.projectId,
                    botId: input.botId,
                    name: input.name,
                    audience: input.audience as any,
                    message: input.message as any,
                    scheduledAt: input.scheduledAt?.toISOString(),
                });
                if (!res.success) return { success: false, error: res.error };
                revalidatePath('/dashboard/telegram/broadcasts');
                return {
                    success: true,
                    broadcastId: res.broadcastId,
                    message: res.message,
                };
            },
            async () => {
                // Direct Mongo insert when Rust is unreachable. The cron
                // route at `/api/telegram/cron` will dispatch it on its
                // next tick (it picks up both `QUEUED` and `scheduled`).
                const r = await requireBot(input.botId);
                if (!r.ok) return { success: false, error: r.error };
                if (r.bot.projectId.toString() !== input.projectId) {
                    return { success: false, error: 'Bot/project mismatch.' };
                }
                const session = await getSession();
                if (!session?.user) return { success: false, error: 'Not authenticated.' };
                const now = new Date();
                const scheduledAt = input.scheduledAt;
                const status =
                    scheduledAt && scheduledAt.getTime() > now.getTime()
                        ? 'scheduled'
                        : 'QUEUED';
                const { db } = await connectToDatabase();
                const doc = {
                    projectId: new ObjectId(input.projectId),
                    botId: r.bot._id,
                    userId: new ObjectId(session.user._id),
                    name: input.name,
                    audience: input.audience,
                    message: input.message,
                    status,
                    stats: { total: 0, sent: 0, failed: 0 },
                    scheduledAt: scheduledAt ?? now,
                    createdAt: now,
                    updatedAt: now,
                };
                const ins = await db
                    .collection('telegram_broadcasts')
                    .insertOne(doc as any);
                revalidatePath('/dashboard/telegram/broadcasts');
                return {
                    success: true,
                    broadcastId: ins.insertedId.toString(),
                    message: 'Broadcast created.',
                };
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

// Rust-backed entry point used by the dashboard. The legacy Node-side
// implementation (`sendTelegramBroadcastNowLegacy` and its helper
// `sendBroadcastToChat`) was deleted in Phase 9 of the broadcast-worker
// port — it had no remaining callers and the Rust router owns the
// throttled-send pipeline now. When Rust is unreachable we requeue the
// broadcast for the cron worker so the user-visible "Send now" action
// still completes.
export async function sendTelegramBroadcastNow(
    broadcastId: string,
    projectId: string,
): Promise<ActionResult> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBroadcasts.sendNow(
                    broadcastId,
                    projectId,
                );
                if (!res.success) return { success: false, error: res.error };
                revalidatePath('/dashboard/telegram/broadcasts');
                return { success: true, message: res.message };
            },
            async () => {
                if (!ObjectId.isValid(broadcastId)) {
                    return { success: false, error: 'Invalid broadcast id.' };
                }
                const { db } = await connectToDatabase();
                const existing = await db
                    .collection<TelegramBroadcast>('telegram_broadcasts')
                    .findOne({ _id: new ObjectId(broadcastId) });
                if (!existing) return { success: false, error: 'Broadcast not found.' };
                const r = await requireBot(existing.botId.toString());
                if (!r.ok) return { success: false, error: r.error };
                if (r.bot.projectId.toString() !== projectId) {
                    return { success: false, error: 'Bot/project mismatch.' };
                }
                const status = String(existing.status ?? '').toLowerCase();
                if (status === 'sending' || status === 'completed') {
                    return {
                        success: false,
                        error: `Cannot send a ${existing.status} broadcast.`,
                    };
                }
                const now = new Date();
                await db.collection<TelegramBroadcast>('telegram_broadcasts').updateOne(
                    { _id: existing._id },
                    { $set: { status: 'QUEUED', scheduledAt: now, updatedAt: now } },
                );
                revalidatePath('/dashboard/telegram/broadcasts');
                return { success: true, message: 'Broadcast queued for delivery.' };
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

    from '@/lib/rust-client/telegram-broadcasts';
import type { BroadcastRow as TelegramBroadcastRowType }
    from '@/lib/rust-client/telegram-broadcasts';

/**
 * Convert a Mongo `telegram_broadcasts` document into the shape the
 * Rust BFF would return. Status casing differs: Mongo uses upper-case
 * legacy values, Rust uses lower-case canonical values.
 */
function mongoBroadcastToRustRow(doc: any): TelegramBroadcastRowType {
    const stats = doc.stats ?? {};
    const rawStatus = String(doc.status ?? '').toLowerCase();
    const status =
        rawStatus === 'queued' || rawStatus === 'scheduled'
            ? 'scheduled'
            : rawStatus === 'sending'
              ? 'sending'
              : rawStatus === 'completed'
                ? 'completed'
                : rawStatus === 'failed'
                  ? 'failed'
                  : rawStatus === 'cancelled' || rawStatus === 'canceled'
                    ? 'cancelled'
                    : 'draft';
    const iso = (v: unknown): string | undefined => {
        if (!v) return undefined;
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'string') return v;
        return undefined;
    };
    return {
        _id: doc._id?.toString?.() ?? String(doc._id ?? ''),
        projectId: doc.projectId?.toString?.() ?? String(doc.projectId ?? ''),
        botId: doc.botId?.toString?.() ?? String(doc.botId ?? ''),
        name: doc.name ?? '',
        status: status as TelegramBroadcastRowType['status'],
        audience: doc.audience ?? {},
        message: doc.message ?? {},
        media: doc.media ?? [],
        inlineKeyboard: doc.inlineKeyboard ?? doc.message?.buttons ?? [],
        counters: {
            sent: stats.sent,
            failed: stats.failed,
        },
        stats: { total: stats.total, sent: stats.sent, failed: stats.failed },
        errorSummary: doc.errorSummary ?? null,
        scheduledAt: iso(doc.scheduledAt),
        startedAt: iso(doc.startedAt),
        completedAt: iso(doc.completedAt ?? doc.finishedAt),
        createdAt: iso(doc.createdAt) ?? new Date(0).toISOString(),
        updatedAt: iso(doc.updatedAt) ?? new Date(0).toISOString(),
    };
}

export async function listTelegramBroadcasts(
    projectId: string,
    botId?: string,
): Promise<TelegramBroadcastRowType[]> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBroadcasts.list({ projectId, botId });
                if (res.error) return [];
                return res.broadcasts ?? [];
            },
            async () => {
                if (!ObjectId.isValid(projectId)) return [];
                const session = await getSession();
                if (!session?.user) return [];
                const project = await getProjectById(projectId);
                if (!project) return [];
                const filter: Record<string, unknown> = {
                    projectId: new ObjectId(projectId),
                };
                if (botId && ObjectId.isValid(botId)) {
                    filter.botId = new ObjectId(botId);
                }
                const { db } = await connectToDatabase();
                const docs = await db
                    .collection('telegram_broadcasts')
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .limit(100)
                    .toArray();
                return docs.map(mongoBroadcastToRustRow);
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return [];
        console.error('[telegram.listBroadcasts]', err);
        return [];
    }
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
        const res = await rustClient.telegramBotProfile.updateProfile(input.botId, {
            name: input.name,
            description: input.description,
            shortDescription: input.shortDescription,
            miniAppUrl: input.miniAppUrl,
            paymentProviderToken: input.paymentProviderToken,
        });
        if (!res.success) return { success: false, error: res.error };
        invalidateTelegramBotCache(input.botId);
        revalidatePath('/dashboard/telegram', 'layout');
        return { success: true, message: res.message ?? 'Profile updated.' };
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
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
        const res = await rustClient.telegramBotProfile.setMenuButton(
            input.botId,
            input.menuButton,
        );
        if (!res.success) return { success: false, error: res.error };
        invalidateTelegramBotCache(input.botId);
        return { success: true, message: res.message ?? 'Menu button updated.' };
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function getTelegramBotCommands(botId: string): Promise<
    Array<{ command: string; description: string }>
> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramBots.getCommands(botId);
                return res.commands ?? [];
            },
            // Fallback path: read the mirror on the bot doc that
            // `setTelegramBotCommands` writes when Rust is down. If the
            // mirror is empty we fall through to a live /getMyCommands so
            // the Commands tab still shows whatever Telegram reports.
            async () => {
                const r = await requireBot(botId);
                if (!r.ok) return [];
                if (Array.isArray(r.bot.commands) && r.bot.commands.length) {
                    return r.bot.commands;
                }
                try {
                    const live = await TelegramBotApi.getMyCommands(r.bot.token);
                    return live ?? [];
                } catch {
                    return [];
                }
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return [];
        return [];
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

    from '@/lib/rust-client/telegram-auto-reply';
import type { RuleRow as TelegramAutoReplyRuleRowType }
    from '@/lib/rust-client/telegram-auto-reply';

/**
 * Convert a Mongo `telegram_auto_reply_rules` doc to the wire `RuleRow`
 * shape. Used by the legacy bot-scoped fallback paths in this file.
 */
function autoReplyDocToRow(d: Record<string, unknown>): TelegramAutoReplyRuleRowType {
    const toIso = (v: unknown) =>
        v instanceof Date
            ? v.toISOString()
            : typeof v === 'string'
                ? v
                : new Date(0).toISOString();
    return {
        _id: String(d._id),
        projectId: String((d as { projectId?: unknown }).projectId),
        botId: (d as { botId?: unknown }).botId != null
            ? String((d as { botId?: unknown }).botId)
            : null,
        name: String((d as { name?: unknown }).name ?? ''),
        status: ((d as { status?: unknown }).status === 'disabled'
            ? 'disabled'
            : 'enabled') as TelegramAutoReplyRuleRowType['status'],
        priority: typeof (d as { priority?: unknown }).priority === 'number'
            ? (d as { priority: number }).priority
            : 0,
        trigger: (((d as { trigger?: unknown }).trigger ?? { kind: 'keyword' }) as TelegramAutoReplyRuleRowType['trigger']),
        conditions: Array.isArray((d as { conditions?: unknown }).conditions)
            ? (d as { conditions: TelegramAutoReplyRuleRowType['conditions'] }).conditions
            : [],
        actions: Array.isArray((d as { actions?: unknown }).actions)
            ? (d as { actions: TelegramAutoReplyRuleRowType['actions'] }).actions
            : [],
        cooldown: (((d as { cooldown?: unknown }).cooldown ?? {}) as TelegramAutoReplyRuleRowType['cooldown']),
        runCount: typeof (d as { runCount?: unknown }).runCount === 'number'
            ? (d as { runCount: number }).runCount
            : 0,
        errorCount: typeof (d as { errorCount?: unknown }).errorCount === 'number'
            ? (d as { errorCount: number }).errorCount
            : 0,
        fired7d: typeof (d as { fired7d?: unknown }).fired7d === 'number'
            ? (d as { fired7d: number }).fired7d
            : 0,
        createdAt: toIso((d as { createdAt?: unknown }).createdAt),
        updatedAt: toIso((d as { updatedAt?: unknown }).updatedAt),
    };
}

export async function listTelegramAutoReplyRules(
    botId: string,
): Promise<TelegramAutoReplyRuleRowType[]> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramAutoReply.list(botId);
                if (res.error) return [];
                return res.rules ?? [];
            },
            async () => {
                if (!ObjectId.isValid(botId)) return [];
                const r = await requireBot(botId);
                if (!r.ok) return [];
                const { db } = await connectToDatabase();
                const docs = await db
                    .collection('telegram_auto_reply_rules')
                    .find({
                        projectId: r.bot.projectId,
                        botId: r.bot._id,
                    })
                    .sort({ priority: 1, createdAt: -1 })
                    .toArray();
                return docs.map((d) => autoReplyDocToRow(d as unknown as Record<string, unknown>));
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return [];
        return [];
    }
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
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramAutoReply.upsert({
                    botId: input.botId,
                    ruleId: input.ruleId,
                    name: input.name,
                    trigger: input.trigger as any,
                    pattern: input.pattern,
                    caseSensitive: input.caseSensitive,
                    matchMode: input.matchMode as any,
                    response: input.response as any,
                    isActive: input.isActive,
                    priority: input.priority,
                    insideBusinessHoursOnly: input.insideBusinessHoursOnly,
                });
                if (!res.success) return { success: false, error: res.error };
                revalidatePath('/dashboard/telegram/auto-reply');
                return { success: true, ruleId: res.ruleId, message: res.message };
            },
            async () => {
                if (!ObjectId.isValid(input.botId)) {
                    return { success: false, error: 'Invalid bot id.' };
                }
                const r = await requireBot(input.botId);
                if (!r.ok) return { success: false, error: r.error };
                const { db } = await connectToDatabase();
                const now = new Date();
                // The legacy shape carries `trigger` as a string ('keyword',
                // 'greeting', etc) plus a separate `pattern`. The new
                // backend stores trigger as `{ kind, payload }`. Translate.
                const triggerDoc = {
                    kind: input.trigger,
                    payload: input.pattern,
                    caseSensitive: input.caseSensitive,
                };
                if (input.ruleId) {
                    if (!ObjectId.isValid(input.ruleId)) {
                        return { success: false, error: 'Invalid rule id.' };
                    }
                    const $set: Record<string, unknown> = {
                        name: input.name,
                        trigger: triggerDoc,
                        updatedAt: now,
                    };
                    if (typeof input.priority === 'number') $set.priority = input.priority;
                    if (typeof input.isActive === 'boolean') {
                        $set.status = input.isActive ? 'enabled' : 'disabled';
                    }
                    const result = await db.collection('telegram_auto_reply_rules').updateOne(
                        {
                            _id: new ObjectId(input.ruleId),
                            projectId: r.bot.projectId,
                        },
                        { $set },
                    );
                    if (result.matchedCount === 0) {
                        return { success: false, error: 'Rule not found.' };
                    }
                    revalidatePath('/dashboard/telegram/auto-reply');
                    return { success: true, ruleId: input.ruleId, message: 'Rule updated.' };
                }
                const doc = {
                    projectId: r.bot.projectId,
                    botId: r.bot._id,
                    name: input.name,
                    status: input.isActive === false ? 'disabled' : 'enabled',
                    priority: typeof input.priority === 'number' ? input.priority : 0,
                    trigger: triggerDoc,
                    conditions: [],
                    actions: [],
                    cooldown: {},
                    runCount: 0,
                    errorCount: 0,
                    fired7d: 0,
                    createdAt: now,
                    updatedAt: now,
                };
                const result = await db
                    .collection('telegram_auto_reply_rules')
                    .insertOne(doc as never);
                revalidatePath('/dashboard/telegram/auto-reply');
                return {
                    success: true,
                    ruleId: String(result.insertedId),
                    message: 'Rule created.',
                };
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function deleteTelegramAutoReplyRule(input: {
    botId: string;
    ruleId: string;
}): Promise<ActionResult> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramAutoReply.deleteRule(input.ruleId, input.botId);
                if (!res.success) return { success: false, error: res.error };
                revalidatePath('/dashboard/telegram/auto-reply');
                return { success: true, message: res.message };
            },
            async () => {
                if (!ObjectId.isValid(input.botId) || !ObjectId.isValid(input.ruleId)) {
                    return { success: false, error: 'Invalid id.' };
                }
                const r = await requireBot(input.botId);
                if (!r.ok) return { success: false, error: r.error };
                const { db } = await connectToDatabase();
                const result = await db.collection('telegram_auto_reply_rules').deleteOne({
                    _id: new ObjectId(input.ruleId),
                    projectId: r.bot.projectId,
                });
                if (result.deletedCount === 0) {
                    return { success: false, error: 'Rule not found.' };
                }
                revalidatePath('/dashboard/telegram/auto-reply');
                return { success: true, message: 'Rule deleted.' };
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

export async function toggleTelegramAutoReplyRule(input: {
    botId: string;
    ruleId: string;
    isActive: boolean;
}): Promise<ActionResult> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramAutoReply.toggle(
                    input.ruleId,
                    input.botId,
                    input.isActive,
                );
                if (!res.success) return { success: false, error: res.error };
                return { success: true, message: res.message };
            },
            async () => {
                if (!ObjectId.isValid(input.botId) || !ObjectId.isValid(input.ruleId)) {
                    return { success: false, error: 'Invalid id.' };
                }
                const r = await requireBot(input.botId);
                if (!r.ok) return { success: false, error: r.error };
                const { db } = await connectToDatabase();
                const result = await db.collection('telegram_auto_reply_rules').updateOne(
                    {
                        _id: new ObjectId(input.ruleId),
                        projectId: r.bot.projectId,
                    },
                    {
                        $set: {
                            status: input.isActive ? 'enabled' : 'disabled',
                            updatedAt: new Date(),
                        },
                    },
                );
                if (result.matchedCount === 0) {
                    return { success: false, error: 'Rule not found.' };
                }
                return {
                    success: true,
                    message: input.isActive ? 'Rule enabled.' : 'Rule disabled.',
                };
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return { success: false, error: err.message };
        return { success: false, error: getErrorMessage(err) };
    }
}

/* ── channels ──────────────────────────────────────────────────── */

    from '@/lib/rust-client/telegram-channels';
import type { ChannelRow as TelegramChannelRowType }
    from '@/lib/rust-client/telegram-channels';

export async function listTelegramChannels(
    projectId: string,
    botId?: string,
): Promise<TelegramChannelRowType[]> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramChannels.list({ projectId, botId });
                if (res.error) return [];
                return res.channels ?? [];
            },
            async () => {
                if (!ObjectId.isValid(projectId)) return [];
                const { db } = await connectToDatabase();
                const filter: Filter<TelegramChannel> = {
                    projectId: new ObjectId(projectId),
                };
                if (botId && ObjectId.isValid(botId)) {
                    filter.botId = new ObjectId(botId);
                }
                const rows = await db
                    .collection<TelegramChannel>('telegram_channels')
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .toArray();
                // Hydrate Mongo docs into the Rust `ChannelRow` wire shape so
                // page components see a consistent type whether the data
                // arrived from the BFF or the fallback path.
                return rows.map((r): TelegramChannelRowType => {
                    const createdAt = r.createdAt instanceof Date
                        ? r.createdAt.toISOString()
                        : new Date(0).toISOString();
                    const lastSyncedAt = r.lastSyncedAt instanceof Date
                        ? r.lastSyncedAt.toISOString()
                        : createdAt;
                    const canPost = Boolean(r.canPost ?? true);
                    return {
                        _id: r._id.toString(),
                        projectId: r.projectId.toString(),
                        botId: r.botId.toString(),
                        chatId: String(r.chatId ?? ''),
                        username: r.username,
                        title: r.title ?? r.username ?? String(r.chatId ?? ''),
                        type: 'channel',
                        memberCount: r.memberCount,
                        isAdmin: canPost,
                        permissions: {
                            canPostMessages: canPost,
                            canEditMessages: canPost,
                            canDeleteMessages: canPost,
                            canInviteUsers: false,
                            canManageChat: false,
                            canPinMessages: canPost,
                        },
                        lastSyncedAt,
                        createdAt,
                    };
                });
            },
        );
    } catch (err) {
        if (err instanceof RustApiError) return [];
        return [];
    }
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
