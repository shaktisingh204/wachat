import 'server-only';
import { rustFetch } from './fetcher';

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
    error?: string;
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

export const telegramAdsApi = {
    list: (projectId: string) =>
        rustFetch<ListResp>(`${BASE}/?projectId=${encodeURIComponent(projectId)}`),
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
};
export type TelegramAdsApi = typeof telegramAdsApi;
