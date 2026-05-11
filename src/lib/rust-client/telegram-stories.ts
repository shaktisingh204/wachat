/**
 * Client for `/v1/telegram/stories` — multi-tenant Telegram Stories
 * (Bot API 7.0+). All routes are project-scoped; the BFF enforces
 * tenancy via `require_project`. Server-only.
 */
import 'server-only';

import { cookies } from 'next/headers';

import { rustFetch } from './fetcher';
import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getDecodedSession } from '@/lib/auth';

const BASE = '/v1/telegram/stories';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export type StoryType = 'channel' | 'business';
export type StoryStatus =
    | 'draft'
    | 'scheduled'
    | 'posted'
    | 'expired'
    | 'failed'
    | 'deleted';
export type StoryMediaKind = 'photo' | 'video';
export type StoryPrivacyKind =
    | 'public'
    | 'contacts'
    | 'close_friends'
    | 'selected';
export type StoryActivePeriodSeconds = 21600 | 43200 | 86400 | 172800;

export interface StoryArea {
    position: Record<string, unknown> | null;
    type: string;
    payload: Record<string, unknown> | null;
}

export interface StoryContent {
    mediaKind: StoryMediaKind;
    /** SabFiles node id — the BFF resolves it to a public URL Telegram can fetch. */
    sabFileId: string;
    caption?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2' | string;
    captionEntities?: unknown;
    areas?: StoryArea[];
}

export interface StoryPrivacy {
    kind: StoryPrivacyKind;
    userIds?: number[];
}

export interface StoryRow {
    _id: string;
    projectId: string;
    botId: string;
    channelId?: string;
    businessConnectionId?: string;
    telegramStoryId?: number;
    type: StoryType;
    content: StoryContent;
    privacy: StoryPrivacy;
    activePeriodSeconds: number;
    postToChatPage: boolean;
    protectContent: boolean;
    status: StoryStatus;
    scheduledAt?: string;
    postedAt?: string;
    expiresAt?: string;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    storyId?: string;
    telegramStoryId?: number;
}

// ---- List ----

export interface ListQuery {
    projectId: string;
    botId?: string;
    status?: StoryStatus | 'all';
    type?: StoryType | 'all';
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface ListResp {
    stories: StoryRow[];
    total: number;
    hasMore: boolean;
    page: number;
    pageSize: number;
    error?: string;
}

export interface DetailResp {
    story?: StoryRow;
    error?: string;
}

// ---- Create / Update ----

export interface CreateBody {
    projectId: string;
    botId: string;
    type: StoryType;
    channelId?: string;
    businessConnectionId?: string;
    content: StoryContent;
    privacy: StoryPrivacy;
    activePeriodSeconds: StoryActivePeriodSeconds;
    postToChatPage?: boolean;
    protectContent?: boolean;
    /** RFC3339; if present the story enters `scheduled` instead of `draft`. */
    scheduledAt?: string;
}

export interface UpdateBody {
    projectId: string;
    content?: StoryContent;
    privacy?: StoryPrivacy;
    activePeriodSeconds?: StoryActivePeriodSeconds;
    postToChatPage?: boolean;
    protectContent?: boolean;
    scheduledAt?: string;
}

// ---- Action bodies ----

export interface ProjectScoped {
    projectId: string;
}

export interface ScheduleBody {
    projectId: string;
    /** RFC3339. */
    scheduledAt: string;
}

export interface EditBody {
    projectId: string;
    content?: StoryContent;
    privacy?: StoryPrivacy;
}

// ---- Business connections ----

export interface BusinessConnectionRow {
    _id: string;
    projectId: string;
    botId: string;
    connectionId: string;
    userId?: number;
    canReply: boolean;
    canEdit: boolean;
    isEnabled: boolean;
    createdAt: string;
}

export interface BusinessConnectionsResp {
    connections: BusinessConnectionRow[];
    error?: string;
}

export interface RegisterBcBody {
    projectId: string;
    botId: string;
    connectionId: string;
}

// ---- Star balance ----

export interface StarBalanceQuery {
    projectId: string;
    botId: string;
    connectionId: string;
}

export interface StarBalanceResp {
    success: boolean;
    amount: number;
    nanostarAmount: number;
    error?: string;
}

// ---- Analytics ----

export interface AnalyticsQuery {
    projectId: string;
    from?: string;
    to?: string;
}

export interface AnalyticsByDayPoint {
    date: string;
    drafts: number;
    scheduled: number;
    posted: number;
    expired: number;
    failed: number;
}

export interface AnalyticsResp {
    drafts: number;
    scheduled: number;
    posted: number;
    expired: number;
    failed: number;
    postedToday: number;
    active: number;
    byDay: AnalyticsByDayPoint[];
    error?: string;
}

// ---------------------------------------------------------------------------
//  Query string helper
// ---------------------------------------------------------------------------

function qs(
    params: Record<string, string | number | undefined | null>,
): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const telegramStoriesApi = {
    list: (q: ListQuery) =>
        rustFetch<ListResp>(
            `${BASE}/${qs({
                projectId: q.projectId,
                botId: q.botId,
                status: q.status,
                type: q.type,
                search: q.search,
                page: q.page,
                pageSize: q.pageSize,
            })}`,
        ),

    create: (body: CreateBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    detail: (storyId: string, projectId: string) =>
        rustFetch<DetailResp>(
            `${BASE}/${encodeURIComponent(storyId)}${qs({ projectId })}`,
        ),

    update: (storyId: string, body: UpdateBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(storyId)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),

    delete: (storyId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(storyId)}${qs({ projectId })}`,
            { method: 'DELETE' },
        ),

    post: (storyId: string, body: ProjectScoped) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(storyId)}/post`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    schedule: (storyId: string, body: ScheduleBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(storyId)}/schedule`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    cancel: (storyId: string, body: ProjectScoped) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(storyId)}/cancel`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    editOnTelegram: (storyId: string, body: EditBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(storyId)}/edit`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteOnTelegram: (storyId: string, body: ProjectScoped) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(storyId)}/delete-on-telegram`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    // -- Business connections --
    listBusinessConnections: (projectId: string, botId?: string) =>
        rustFetch<BusinessConnectionsResp>(
            `${BASE}/business-connections${qs({ projectId, botId })}`,
        ),

    registerBusinessConnection: (body: RegisterBcBody) =>
        rustFetch<AckResult>(`${BASE}/business-connections`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteBusinessConnection: (id: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/business-connections/${encodeURIComponent(id)}${qs({ projectId })}`,
            { method: 'DELETE' },
        ),

    // -- Star balance --
    starBalance: (q: StarBalanceQuery) =>
        rustFetch<StarBalanceResp>(
            `${BASE}/star-balance${qs({
                projectId: q.projectId,
                botId: q.botId,
                connectionId: q.connectionId,
            })}`,
        ),

    // -- Analytics --
    analytics: (q: AnalyticsQuery) =>
        rustFetch<AnalyticsResp>(
            `${BASE}/analytics${qs({
                projectId: q.projectId,
                from: q.from,
                to: q.to,
            })}`,
        ),

    // -- CSV export (text/csv) --
    exportCsv: async (projectId: string): Promise<string> => {
        const cookieStore = await cookies();
        const cookie = cookieStore.get('session')?.value;
        const decoded = cookie ? await getDecodedSession(cookie) : null;
        const userId = decoded
            ? ((decoded as { userId?: string; sub?: string; _id?: string }).userId
                || (decoded as { sub?: string }).sub
                || (decoded as { _id?: string })._id)
            : null;
        if (!userId) return '';
        const token = await issueRustJwt({
            userId: String(userId),
            tenantId: String(userId),
            roles: [],
        });
        const base = process.env.RUST_API_URL || 'http://localhost:8080';
        const res = await fetch(
            `${base}${BASE}/export${qs({ projectId })}`,
            {
                headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
                cache: 'no-store',
            },
        );
        if (!res.ok) return '';
        return await res.text();
    },
};

export type TelegramStoriesApi = typeof telegramStoriesApi;
