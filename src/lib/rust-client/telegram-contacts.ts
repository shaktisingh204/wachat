import 'server-only';
import { cookies } from 'next/headers';
import { rustFetch } from './fetcher';
import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getDecodedSession } from '@/lib/auth';

const BASE = '/v1/telegram/contacts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    contactId?: string;
}

export interface ContactRow {
    _id: string;
    projectId: string;
    botId?: string | null;
    chatId: number;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    phoneNumber?: string;
    isBot: boolean;
    isPremium: boolean;
    isVerified: boolean;
    tags: string[];
    notes: string;
    customFields: Record<string, string>;
    assignedAgentId?: string | null;
    lastInteractionAt?: string;
    source: 'webhook' | 'manual' | 'csv' | 'sync' | string;
    blocked: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ListQuery {
    projectId: string;
    botId?: string;
    search?: string;
    tag?: string;
    languageCode?: string;
    hasPhone?: boolean;
    blocked?: boolean;
    assignedAgentId?: string;
    lastInteractionAfter?: string;
    lastInteractionBefore?: string;
    page?: number;
    pageSize?: number;
}

export interface ListResp {
    contacts: ContactRow[];
    total: number;
    hasMore: boolean;
    page: number;
    pageSize: number;
    error?: string;
}

export interface UpsertBody {
    projectId: string;
    contactId?: string;
    botId?: string;
    chatId?: number;
    firstName?: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    phoneNumber?: string;
    isBot?: boolean;
    isPremium?: boolean;
    isVerified?: boolean;
    tags?: string[];
    notes?: string;
    customFields?: Record<string, string>;
    assignedAgentId?: string | null;
    blocked?: boolean;
    source?: string;
}

export interface DetailResp {
    contact?: ContactRow;
    error?: string;
}

export interface BulkIdsBody {
    projectId: string;
    ids: string[];
}

export interface BulkResultResp {
    success: boolean;
    affected: number;
    error?: string;
    message?: string;
}

export interface BulkTagBody {
    projectId: string;
    ids: string[];
    add?: string[];
    remove?: string[];
}

export interface BulkAssignBody {
    projectId: string;
    ids: string[];
    assignedAgentId?: string | null;
}

export interface SyncFromChatsBody {
    projectId: string;
    botId?: string;
}

export interface SyncFromChatsResp {
    success: boolean;
    inserted: number;
    updated: number;
    scanned: number;
    error?: string;
    message?: string;
}

export interface ImportBody {
    projectId: string;
    botId?: string;
    csv: string;
    mode?: 'append' | 'replace';
}

export interface ImportResp {
    success: boolean;
    inserted: number;
    updated: number;
    skipped: number;
    error?: string;
    message?: string;
}

export interface SegmentRow {
    _id: string;
    projectId: string;
    name: string;
    description?: string;
    filter: Record<string, unknown>;
    memberCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface ListSegmentsResp {
    segments: SegmentRow[];
    error?: string;
}

export interface CreateSegmentBody {
    projectId: string;
    name: string;
    description?: string;
    filter: Record<string, unknown>;
}

export interface SegmentAckResult {
    success: boolean;
    segmentId?: string;
    error?: string;
    message?: string;
}

export interface SegmentContactsQuery {
    projectId: string;
    cursor?: string;
    limit?: number;
}

export interface SegmentContactsResp {
    contacts: ContactRow[];
    nextCursor?: string;
    hasMore: boolean;
    total: number;
    error?: string;
}

export interface AnalyticsQuery {
    projectId: string;
    from?: string;
    to?: string;
    botId?: string;
}

export interface LanguageCount {
    code: string;
    count: number;
}
export interface TagCount {
    tag: string;
    count: number;
}
export interface DayPoint {
    date: string;
    count: number;
}

export interface AnalyticsResp {
    total: number;
    newInRange: number;
    churned: number;
    topTags: TagCount[];
    languages: LanguageCount[];
    byDay: DayPoint[];
    error?: string;
}

export interface ResolveBody {
    projectId: string;
    botId: string;
    chatId: number;
    firstName?: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isBot?: boolean;
    isPremium?: boolean;
    isVerified?: boolean;
}

export interface ResolveResp {
    success: boolean;
    contact?: ContactRow;
    error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const telegramContactsApi = {
    list: (q: ListQuery) =>
        rustFetch<ListResp>(`${BASE}/${buildQuery(q as unknown as Record<string, string | number | boolean | undefined>)}`),
    detail: (contactId: string, projectId: string) =>
        rustFetch<DetailResp>(
            `${BASE}/${encodeURIComponent(contactId)}?projectId=${encodeURIComponent(projectId)}`,
        ),
    upsert: (body: UpsertBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    update: (contactId: string, body: UpsertBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(contactId)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    delete: (contactId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(contactId)}?projectId=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
        ),
    bulkDelete: (body: BulkIdsBody) =>
        rustFetch<BulkResultResp>(`${BASE}/bulk-delete`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    bulkTag: (body: BulkTagBody) =>
        rustFetch<BulkResultResp>(`${BASE}/bulk-tag`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    bulkAssign: (body: BulkAssignBody) =>
        rustFetch<BulkResultResp>(`${BASE}/bulk-assign`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    syncFromChats: (body: SyncFromChatsBody) =>
        rustFetch<SyncFromChatsResp>(`${BASE}/sync-from-chats`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    importCsv: (body: ImportBody) =>
        rustFetch<ImportResp>(`${BASE}/import`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    exportCsv: async (
        projectId: string,
        opts?: { tag?: string; search?: string; botId?: string },
    ): Promise<string> => {
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
        const qs = buildQuery({
            projectId,
            tag: opts?.tag,
            search: opts?.search,
            botId: opts?.botId,
        });
        const res = await fetch(`${base}${BASE}/export${qs}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
            cache: 'no-store',
        });
        if (!res.ok) return '';
        return await res.text();
    },
    listSegments: (projectId: string) =>
        rustFetch<ListSegmentsResp>(
            `${BASE}/segments?projectId=${encodeURIComponent(projectId)}`,
        ),
    createSegment: (body: CreateSegmentBody) =>
        rustFetch<SegmentAckResult>(`${BASE}/segments`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    deleteSegment: (segmentId: string, projectId: string) =>
        rustFetch<SegmentAckResult>(
            `${BASE}/segments/${encodeURIComponent(segmentId)}?projectId=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
        ),
    segmentContacts: (segmentId: string, q: SegmentContactsQuery) =>
        rustFetch<SegmentContactsResp>(
            `${BASE}/segments/${encodeURIComponent(segmentId)}/contacts${buildQuery(q as unknown as Record<string, string | number | boolean | undefined>)}`,
        ),
    analytics: (q: AnalyticsQuery) =>
        rustFetch<AnalyticsResp>(
            `${BASE}/analytics${buildQuery(q as unknown as Record<string, string | number | boolean | undefined>)}`,
        ),
    resolve: (body: ResolveBody) =>
        rustFetch<ResolveResp>(`${BASE}/resolve`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

export type TelegramContactsApi = typeof telegramContactsApi;
