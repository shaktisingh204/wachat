import 'server-only';
import { cookies } from 'next/headers';
import { rustFetch } from './fetcher';
import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getDecodedSession } from '@/lib/auth';

const BASE = '/v1/telegram/ads';

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    campaignId?: string;
}
export interface CampaignRow {
    _id: string;
    projectId: string;
    name: string;
    status: string;
    platformId?: string;
    landingUrl?: string;
    budgetCents: number;
    impressions: number;
    clicks: number;
    notes: string;
    createdAt: string;
    updatedAt: string;
}
export interface ListResp {
    campaigns: CampaignRow[];
    total: number;
    hasMore: boolean;
    page: number;
    pageSize: number;
    error?: string;
}
export interface ListQuery {
    projectId: string;
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    createdFrom?: string;
    createdTo?: string;
}
export interface UpsertBody {
    projectId: string;
    campaignId?: string;
    name: string;
    status?: string;
    platformId?: string;
    landingUrl?: string;
    budgetCents?: number;
    impressions?: number;
    clicks?: number;
    notes?: string;
}

export interface DetailResp {
    campaign?: CampaignRow;
    error?: string;
}

export interface AnalyticsByDayPoint {
    date: string;
    impressions: number;
    clicks: number;
    spendCents: number;
}
export interface TopCampaign {
    campaignId: string;
    name: string;
    impressions: number;
    clicks: number;
    ctr: number;
}
export interface AnalyticsResp {
    totalSpendCents: number;
    totalImpressions: number;
    totalClicks: number;
    ctr: number;
    cpmCents: number;
    cpcCents: number;
    byDay: AnalyticsByDayPoint[];
    topCampaigns: TopCampaign[];
    error?: string;
}
export interface AnalyticsQuery {
    projectId: string;
    from?: string;
    to?: string;
}

export interface ImportBody {
    projectId: string;
    csv: string;
    mode?: 'replace_stats' | 'append';
}
export interface ImportResp {
    success: boolean;
    inserted: number;
    updated: number;
    skipped: number;
    error?: string;
    message?: string;
}

export interface BulkDeleteBody {
    projectId: string;
    ids: string[];
}
export interface BulkDeleteResp {
    success: boolean;
    deleted: number;
    error?: string;
    message?: string;
}

export interface UtmBody {
    projectId: string;
    campaignId?: string;
    landingUrl: string;
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
}
export interface UtmResp {
    success: boolean;
    shortUrl: string;
    longUrl: string;
    error?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

export const telegramAdsApi = {
    list: (q: ListQuery) =>
        rustFetch<ListResp>(`${BASE}/${buildQuery(q as unknown as Record<string, string | number | undefined>)}`),
    detail: (campaignId: string, projectId: string) =>
        rustFetch<DetailResp>(
            `${BASE}/${encodeURIComponent(campaignId)}?projectId=${encodeURIComponent(projectId)}`,
        ),
    upsert: (body: UpsertBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    delete: (campaignId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(campaignId)}?projectId=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
        ),
    analytics: (q: AnalyticsQuery) =>
        rustFetch<AnalyticsResp>(
            `${BASE}/analytics${buildQuery(q as unknown as Record<string, string | number | undefined>)}`,
        ),
    importCsv: (body: ImportBody) =>
        rustFetch<ImportResp>(`${BASE}/import`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
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
            `${base}${BASE}/export?projectId=${encodeURIComponent(projectId)}`,
            {
                headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
                cache: 'no-store',
            },
        );
        if (!res.ok) return '';
        return await res.text();
    },
    bulkDelete: (body: BulkDeleteBody) =>
        rustFetch<BulkDeleteResp>(`${BASE}/bulk-delete`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    utm: (body: UtmBody) =>
        rustFetch<UtmResp>(`${BASE}/utm`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};
export type TelegramAdsApi = typeof telegramAdsApi;
