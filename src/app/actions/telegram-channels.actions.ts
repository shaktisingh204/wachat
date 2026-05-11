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

export type { ChannelRow, PostBody, PromoteBody } from '@/lib/rust-client/telegram-channels';

function fromError(err: unknown): string {
    if (err instanceof RustApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Unknown error.';
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
        const res = await rustClient.telegramChannels.list(q);
        return {
            channels: res.channels ?? [],
            total: res.total ?? res.channels?.length ?? 0,
            error: res.error,
        };
    } catch (err) {
        return { channels: [], total: 0, error: fromError(err) };
    }
}

export async function getChannel(
    channelId: string,
    projectId: string,
): Promise<{ channel?: ChannelRow; error?: string }> {
    try {
        const res = await rustClient.telegramChannels.get(channelId, projectId);
        if ('error' in res && typeof res.error === 'string') {
            return { error: res.error };
        }
        return { channel: res as ChannelRow };
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
        return await rustClient.telegramChannels.listScheduled(channelId, projectId);
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
        const res = await rustClient.telegramChannels.remove(channelId, projectId);
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
        const res = await rustClient.telegramChannels.cancelScheduled(
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
