'use server';

/**
 * Server actions for the Telegram Channels dashboard page.
 *
 * Each action is a thin pass-through to the Rust BFF
 * (`/v1/telegram/channels`) via `rustClient.telegramChannels`. The
 * dashboard page imports these instead of hitting `rustFetch` directly
 * because the rust client is `server-only`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter } from 'mongodb';

import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AckResult,
    AdminsResp,
    ChannelRow,
    DemoteBody,
    DiscoverBody,
    EditPostBody,
    ListQuery,
    PinBody,
    PostBody,
    PostsResp,
    PromoteBody,
    ScheduledResp,
    StatsResp,
} from '@/lib/rust-client/telegram-channels';
import { connectToDatabase } from '@/lib/mongodb';
import { withRustFallback } from '@/lib/telegram/rust-fallback';
import type { TelegramChannel, TelegramScheduledPost } from '@/lib/definitions';

/**
 * Hydrate a Mongo `telegram_channels` doc into the Rust `ChannelRow`
 * wire shape. The Rust handler returns richer admin / permission data;
 * the fallback only knows what was last persisted, so admin-derived
 * fields default to safe placeholders.
 */
function toChannelRow(doc: Record<string, unknown>): ChannelRow {
    const idVal = doc._id;
    const projectIdVal = doc.projectId;
    const botIdVal = doc.botId;
    const createdAt = doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : (typeof doc.createdAt === 'string' ? doc.createdAt : new Date(0).toISOString());
    const lastSyncedAt = doc.lastSyncedAt instanceof Date
        ? doc.lastSyncedAt.toISOString()
        : (typeof doc.lastSyncedAt === 'string' ? doc.lastSyncedAt : createdAt);
    return {
        _id: String(idVal),
        projectId: String(projectIdVal),
        botId: String(botIdVal),
        chatId: String(doc.chatId ?? ''),
        username: typeof doc.username === 'string' ? doc.username : undefined,
        title: String(doc.title ?? doc.username ?? doc.chatId ?? ''),
        // Stored shape has no `type` field — assume `channel` for legacy rows.
        type: (doc.type === 'supergroup' ? 'supergroup' : 'channel') as ChannelRow['type'],
        memberCount: typeof doc.memberCount === 'number' ? doc.memberCount : undefined,
        isVerified: typeof doc.isVerified === 'boolean' ? doc.isVerified : undefined,
        isAdmin: Boolean(doc.canPost ?? true),
        permissions: {
            canPostMessages: Boolean(doc.canPost ?? true),
            canEditMessages: Boolean(doc.canPost ?? true),
            canDeleteMessages: Boolean(doc.canPost ?? true),
            canInviteUsers: false,
            canManageChat: false,
            canPinMessages: Boolean(doc.canPost ?? true),
        },
        lastSyncedAt,
        createdAt,
    };
}

function toScheduledRow(doc: Record<string, unknown>) {
    const createdAt = doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : (typeof doc.createdAt === 'string' ? doc.createdAt : new Date(0).toISOString());
    const scheduledAt = doc.scheduledAt instanceof Date
        ? doc.scheduledAt.toISOString()
        : (typeof doc.scheduledAt === 'string' ? doc.scheduledAt : createdAt);
    return {
        _id: String(doc._id),
        channelId: String(doc.channelId ?? ''),
        message: (doc.message ?? {}) as Record<string, unknown>,
        inlineKeyboard: doc.inlineKeyboard,
        status: (doc.status ?? 'QUEUED') as 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED',
        scheduledAt,
        createdAt,
    };
}


function revalidate(channelId?: string) {
    revalidatePath('/dashboard/telegram/channels');
    if (channelId) {
        revalidatePath(`/dashboard/telegram/channels/${channelId}`);
    }
}

// ---------------------------------------------------------------------------
//  Reads
// ---------------------------------------------------------------------------

export async function listChannels(q: ListQuery): Promise<{
    channels: ChannelRow[];
    total: number;
    error?: string;
}> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramChannels.list(q);
                return {
                    channels: res.channels ?? [],
                    total: res.total ?? res.channels?.length ?? 0,
                    error: res.error,
                };
            },
            async () => {
                if (!q.projectId || !ObjectId.isValid(q.projectId)) {
                    return { channels: [], total: 0 };
                }
                const { db } = await connectToDatabase();
                const filter: Filter<TelegramChannel> = {
                    projectId: new ObjectId(q.projectId),
                };
                if (q.botId && ObjectId.isValid(q.botId)) {
                    filter.botId = new ObjectId(q.botId);
                }
                if (q.search) {
                    const re = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                    (filter as Filter<TelegramChannel> & { $or?: unknown[] }).$or = [
                        { title: re },
                        { username: re },
                        { chatId: re },
                    ];
                }
                const cursor = db
                    .collection<TelegramChannel>('telegram_channels')
                    .find(filter)
                    .sort({ createdAt: -1 });
                if (typeof q.skip === 'number' && q.skip > 0) cursor.skip(q.skip);
                if (typeof q.limit === 'number' && q.limit > 0) cursor.limit(q.limit);
                const [rows, total] = await Promise.all([
                    cursor.toArray(),
                    db.collection<TelegramChannel>('telegram_channels').countDocuments(filter),
                ]);
                return {
                    channels: rows.map((r) => toChannelRow(r as unknown as Record<string, unknown>)),
                    total,
                };
            },
        );
    } catch (err) {
        return { channels: [], total: 0, error: fromError(err) };
    }
}

export async function getChannel(
    channelId: string,
    projectId: string,
): Promise<{ channel?: ChannelRow; error?: string }> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramChannels.get(channelId, projectId);
                if ('error' in res && typeof res.error === 'string') {
                    return { error: res.error };
                }
                return { channel: res as ChannelRow };
            },
            async () => {
                if (!ObjectId.isValid(channelId) || !ObjectId.isValid(projectId)) {
                    return { error: 'Invalid channel id.' };
                }
                const { db } = await connectToDatabase();
                const doc = await db
                    .collection<TelegramChannel>('telegram_channels')
                    .findOne({
                        _id: new ObjectId(channelId),
                        projectId: new ObjectId(projectId),
                    });
                if (!doc) return { error: 'Channel not found.' };
                return { channel: toChannelRow(doc as unknown as Record<string, unknown>) };
            },
        );
    } catch (err) {
        return { error: fromError(err) };
    }
}

export async function listAdmins(
    channelId: string,
    projectId: string,
): Promise<AdminsResp> {
    try {
        return await rustClient.telegramChannels.listAdmins(channelId, projectId);
    } catch (err) {
        return { admins: [], error: fromError(err) };
    }
}

export async function listPosts(
    channelId: string,
    projectId: string,
    opts?: { cursor?: string; limit?: number },
): Promise<PostsResp> {
    try {
        return await rustClient.telegramChannels.listPosts(
            channelId,
            projectId,
            opts,
        );
    } catch (err) {
        return { posts: [], error: fromError(err) };
    }
}

export async function listScheduled(
    channelId: string,
    projectId: string,
): Promise<ScheduledResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramChannels.listScheduled(channelId, projectId),
            async () => {
                if (!ObjectId.isValid(channelId) || !ObjectId.isValid(projectId)) {
                    return { scheduled: [] };
                }
                const { db } = await connectToDatabase();
                const rows = await db
                    .collection<TelegramScheduledPost>('telegram_scheduled_posts')
                    .find({
                        projectId: new ObjectId(projectId),
                        channelId: new ObjectId(channelId),
                    })
                    .sort({ scheduledAt: 1, createdAt: -1 })
                    .toArray();
                return {
                    scheduled: rows.map((r) => toScheduledRow(r as unknown as Record<string, unknown>)),
                };
            },
        );
    } catch (err) {
        return { scheduled: [], error: fromError(err) };
    }
}

export async function getStats(
    channelId: string,
    projectId: string,
    from?: string,
    to?: string,
): Promise<StatsResp> {
    try {
        return await rustClient.telegramChannels.stats(channelId, {
            projectId,
            from,
            to,
        });
    } catch (err) {
        return {
            postsCount: 0,
            totalViews: 0,
            scheduledCount: 0,
            series: [],
            topPosts: [],
            error: fromError(err),
        };
    }
}

// ---------------------------------------------------------------------------
//  Mutations
// ---------------------------------------------------------------------------

export async function discoverChannel(body: DiscoverBody): Promise<AckResult> {
    try {
        const res = await rustClient.telegramChannels.discover(body);
        if (res.success) revalidate(res.channelId);
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}

export async function removeChannel(
    channelId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        const res = await withRustFallback(
            () => rustClient.telegramChannels.remove(channelId, projectId),
            async () => {
                if (!ObjectId.isValid(channelId) || !ObjectId.isValid(projectId)) {
                    return { success: false, error: 'Invalid channel id.' };
                }
                const { db } = await connectToDatabase();
                const del = await db
                    .collection<TelegramChannel>('telegram_channels')
                    .deleteOne({
                        _id: new ObjectId(channelId),
                        projectId: new ObjectId(projectId),
                    });
                if (del.deletedCount === 0) {
                    return { success: false, error: 'Channel not found.' };
                }
                return { success: true };
            },
        );
        if (res.success) revalidate();
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}

export async function postToChannel(
    channelId: string,
    body: PostBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramChannels.post(channelId, body);
        if (res.success) revalidate(channelId);
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}

export async function editChannelPost(
    channelId: string,
    postId: string,
    body: EditPostBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramChannels.editPost(
            channelId,
            postId,
            body,
        );
        if (res.success) revalidate(channelId);
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}

export async function deleteChannelPost(
    channelId: string,
    postId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramChannels.deletePost(
            channelId,
            postId,
            projectId,
        );
        if (res.success) revalidate(channelId);
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}

export async function pinChannelPost(
    channelId: string,
    postId: string,
    body: PinBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramChannels.pinPost(
            channelId,
            postId,
            body,
        );
        if (res.success) revalidate(channelId);
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}

export async function unpinChannelPost(
    channelId: string,
    postId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramChannels.unpinPost(
            channelId,
            postId,
            projectId,
        );
        if (res.success) revalidate(channelId);
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}

export async function cancelScheduledPost(
    channelId: string,
    postId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        const res = await withRustFallback(
            () =>
                rustClient.telegramChannels.cancelScheduled(
                    channelId,
                    postId,
                    projectId,
                ),
            async () => {
                if (
                    !ObjectId.isValid(postId) ||
                    !ObjectId.isValid(projectId) ||
                    !ObjectId.isValid(channelId)
                ) {
                    return { success: false, error: 'Invalid id.' };
                }
                const { db } = await connectToDatabase();
                const upd = await db
                    .collection<TelegramScheduledPost>('telegram_scheduled_posts')
                    .updateOne(
                        {
                            _id: new ObjectId(postId),
                            projectId: new ObjectId(projectId),
                            channelId: new ObjectId(channelId),
                            status: 'QUEUED',
                        },
                        { $set: { status: 'CANCELLED', updatedAt: new Date() } },
                    );
                if (upd.matchedCount === 0) {
                    return { success: false, error: 'Scheduled post not found.' };
                }
                return { success: true };
            },
        );
        if (res.success) revalidate(channelId);
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}

export async function promoteAdmin(
    channelId: string,
    body: PromoteBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramChannels.promote(channelId, body);
        if (res.success) revalidate(channelId);
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}

export async function demoteAdmin(
    channelId: string,
    body: DemoteBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramChannels.demote(channelId, body);
        if (res.success) revalidate(channelId);
        return res;
    } catch (err) {
        return { success: false, error: fromError(err) };
    }
}
