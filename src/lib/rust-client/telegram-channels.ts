/**
 * Client for `/v1/telegram/channels`. Server-only.
 *
 * Mirrors the routes registered by the `telegram-channels` Rust crate.
 * Every endpoint is project-scoped — pass `projectId` on every call so
 * the BFF can run its tenant guard.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/channels';

// ---------------------------------------------------------------------------
//  Wire shapes
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    channelId?: string;
    postId?: string;
    messageId?: number;
}

export interface ChannelPermissions {
    canPostMessages: boolean;
    canEditMessages: boolean;
    canDeleteMessages: boolean;
    canInviteUsers: boolean;
    canManageChat: boolean;
    canPinMessages: boolean;
}

export interface ChannelRow {
    _id: string;
    projectId: string;
    botId: string;
    chatId: string;
    username?: string;
    title: string;
    type: 'channel' | 'supergroup';
    memberCount?: number;
    isVerified?: boolean;
    isAdmin: boolean;
    permissions: ChannelPermissions;
    lastSyncedAt: string;
    createdAt: string;
}

export interface ListResp {
    channels: ChannelRow[];
    error?: string;
    total?: number;
}

export interface ListQuery {
    projectId: string;
    botId?: string;
    search?: string;
    type?: 'channel' | 'supergroup';
    limit?: number;
    skip?: number;
}

export interface DiscoverBody {
    projectId: string;
    botId: string;
    /** Numeric chat id (e.g. `-1001234567890`). */
    chatId?: string;
    /** `@username` of the channel (without the `@` is OK). */
    username?: string;
}

export interface PromoteBody {
    projectId: string;
    userId: number;
    can_post_messages?: boolean;
    can_edit_messages?: boolean;
    can_delete_messages?: boolean;
    can_invite_users?: boolean;
    can_manage_chat?: boolean;
    can_pin_messages?: boolean;
    can_promote_members?: boolean;
    can_restrict_members?: boolean;
    can_change_info?: boolean;
    can_manage_video_chats?: boolean;
    is_anonymous?: boolean;
}

export interface DemoteBody {
    projectId: string;
    userId: number;
}

export interface MediaItem {
    url: string;
    type?: 'photo' | 'video' | 'document' | 'audio';
    caption?: string;
}

export interface PostMessage {
    text?: string;
    media?: MediaItem;
    mediaGroup?: MediaItem[];
    parseMode?: 'HTML' | 'MarkdownV2';
    entities?: unknown;
    disableWebPagePreview?: boolean;
    disableNotification?: boolean;
    /** ISO-8601 timestamp. If set, the post is queued for a worker. */
    scheduleAt?: string;
}

export interface PostBody {
    projectId: string;
    message: PostMessage;
    /** Telegram InlineKeyboardMarkup `{ inline_keyboard: [[{...}]] }`. */
    inlineKeyboard?: unknown;
}

export interface EditPostBody {
    projectId: string;
    text?: string;
    caption?: string;
    parseMode?: 'HTML' | 'MarkdownV2';
}

export interface PinBody {
    projectId: string;
    disableNotification?: boolean;
}

export interface PostRow {
    _id: string;
    channelId: string;
    messageId: number;
    kind: 'text' | 'media' | 'mediaGroup';
    text?: string;
    media?: unknown;
    isPinned: boolean;
    views?: number;
    sentAt: string;
    editedAt?: string;
}

export interface PostsResp {
    posts: PostRow[];
    error?: string;
    nextCursor?: string;
}

export interface ScheduledRow {
    _id: string;
    channelId: string;
    message: PostMessage;
    inlineKeyboard?: unknown;
    status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
    scheduledAt: string;
    createdAt: string;
}

export interface ScheduledResp {
    scheduled: ScheduledRow[];
    error?: string;
}

export interface AdminRow {
    userId: number;
    status: 'creator' | 'administrator';
    name: string;
    username?: string;
    canPostMessages: boolean;
    canEditMessages: boolean;
    canDeleteMessages: boolean;
    canInviteUsers: boolean;
    canManageChat: boolean;
    canPinMessages: boolean;
    canPromoteMembers: boolean;
    canChangeInfo: boolean;
    isAnonymous: boolean;
}

export interface AdminsResp {
    admins: AdminRow[];
    error?: string;
}

export interface StatsPoint {
    date: string;
    posts: number;
}

export interface StatsResp {
    postsCount: number;
    totalViews: number;
    scheduledCount: number;
    series: StatsPoint[];
    topPosts: PostRow[];
    error?: string;
}

export interface StatsQuery {
    projectId: string;
    from?: string;
    to?: string;
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined>): string {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v == null || v === '') continue;
        u.set(k, String(v));
    }
    const s = u.toString();
    return s ? `?${s}` : '';
}

export const telegramChannelsApi = {
    /** `GET /v1/telegram/channels?projectId=…&botId=…&search=…&type=` */
    list: (q: ListQuery) =>
        rustFetch<ListResp>(
            `${BASE}/${qs({
                projectId: q.projectId,
                botId: q.botId,
                search: q.search,
                type: q.type,
                limit: q.limit,
                skip: q.skip,
            })}`,
        ),

    /** `POST /v1/telegram/channels/discover` — locate a channel via the bot. */
    discover: (body: DiscoverBody) =>
        rustFetch<AckResult>(`${BASE}/discover`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `GET /v1/telegram/channels/{channelId}` — refresh from Telegram. */
    get: (channelId: string, projectId: string) =>
        rustFetch<ChannelRow | { error: string }>(
            `${BASE}/${encodeURIComponent(channelId)}${qs({ projectId })}`,
        ),

    /** `DELETE /v1/telegram/channels/{channelId}` — soft-remove. */
    remove: (channelId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(channelId)}${qs({ projectId })}`,
            { method: 'DELETE' },
        ),

    /** `GET /v1/telegram/channels/{channelId}/admins` */
    listAdmins: (channelId: string, projectId: string) =>
        rustFetch<AdminsResp>(
            `${BASE}/${encodeURIComponent(channelId)}/admins${qs({ projectId })}`,
        ),

    /** `POST /v1/telegram/channels/{channelId}/promote` */
    promote: (channelId: string, body: PromoteBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(channelId)}/promote`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `POST /v1/telegram/channels/{channelId}/demote` */
    demote: (channelId: string, body: DemoteBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(channelId)}/demote`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `POST /v1/telegram/channels/{channelId}/post` */
    post: (channelId: string, body: PostBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(channelId)}/post`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `GET /v1/telegram/channels/{channelId}/posts` */
    listPosts: (
        channelId: string,
        projectId: string,
        opts?: { cursor?: string; limit?: number },
    ) =>
        rustFetch<PostsResp>(
            `${BASE}/${encodeURIComponent(channelId)}/posts${qs({
                projectId,
                cursor: opts?.cursor,
                limit: opts?.limit,
            })}`,
        ),

    /** `POST /v1/telegram/channels/{channelId}/posts/{postId}/edit` */
    editPost: (channelId: string, postId: string, body: EditPostBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(channelId)}/posts/${encodeURIComponent(postId)}/edit`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `DELETE /v1/telegram/channels/{channelId}/posts/{postId}` */
    deletePost: (channelId: string, postId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(channelId)}/posts/${encodeURIComponent(postId)}${qs(
                { projectId },
            )}`,
            { method: 'DELETE' },
        ),

    /** `POST /v1/telegram/channels/{channelId}/posts/{postId}/pin` */
    pinPost: (channelId: string, postId: string, body: PinBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(channelId)}/posts/${encodeURIComponent(postId)}/pin`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `DELETE /v1/telegram/channels/{channelId}/posts/{postId}/pin` */
    unpinPost: (channelId: string, postId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(channelId)}/posts/${encodeURIComponent(postId)}/pin${qs(
                { projectId },
            )}`,
            { method: 'DELETE' },
        ),

    /** `GET /v1/telegram/channels/{channelId}/scheduled` */
    listScheduled: (channelId: string, projectId: string) =>
        rustFetch<ScheduledResp>(
            `${BASE}/${encodeURIComponent(channelId)}/scheduled${qs({ projectId })}`,
        ),

    /** `DELETE /v1/telegram/channels/{channelId}/scheduled/{postId}` */
    cancelScheduled: (channelId: string, postId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(channelId)}/scheduled/${encodeURIComponent(postId)}${qs(
                { projectId },
            )}`,
            { method: 'DELETE' },
        ),

    /** `GET /v1/telegram/channels/{channelId}/stats` */
    stats: (channelId: string, q: StatsQuery) =>
        rustFetch<StatsResp>(
            `${BASE}/${encodeURIComponent(channelId)}/stats${qs({
                projectId: q.projectId,
                from: q.from,
                to: q.to,
            })}`,
        ),
};

export type TelegramChannelsApi = typeof telegramChannelsApi;
