/**
 * Client for the Ad Manager BFF on Rust.
 *
 * Most ad-manager actions are thin proxies over the Meta Marketing
 * Graph API. Rather than expose one TS function per Graph endpoint
 * we ship a single `graph(...)` call that mirrors the legacy
 * `graph(path, opts)` helper from `ad-manager.actions.ts`. The Rust
 * side resolves the user's `adManagerAccessToken` (or
 * `metaSuiteAccessToken` for the FB Pages / IG / promotable_posts
 * subset) from Mongo and forwards to graph.facebook.com.
 *
 * The stateful endpoints — Mongo-backed ad-accounts list, the
 * `ad_campaigns` "quick create" mirror, asset uploads — get their
 * own typed methods.
 */
import 'server-only';

import { rustFetch, rustAdminFetch } from './fetcher';

const BASE = '/v1/ad-manager';

export type AdManagerTokenKind = 'adManager' | 'metaSuite';

export interface GraphProxyBody {
    /** Graph path without leading `/`. Example: `act_123/campaigns`. */
    path: string;
    /** GET / POST / DELETE. Default: GET. */
    method?: 'GET' | 'POST' | 'DELETE';
    /** Query-string params. Always merged with `access_token` server-side. */
    params?: Record<string, unknown>;
    /** Body params (POST / DELETE). Sent as JSON alongside `access_token`. */
    body?: Record<string, unknown>;
    /** Which token to use. Defaults to `adManager`. */
    tokenKind?: AdManagerTokenKind;
}

export interface GraphProxyResult<T = unknown> {
    data?: T;
    error?: string;
}

export interface AdAccountsResult {
    accounts: any[];
    error?: string;
}

export interface SuccessResult {
    success: boolean;
    error?: string;
}

export interface LocalCampaignsResult {
    campaigns: any[];
    error?: string;
}

export interface UploadImageResult {
    imageHash?: string;
    imageUrl?: string;
    error?: string;
}

export interface UploadVideoResult {
    videoId?: string;
    error?: string;
}

export const adManagerApi = {
    // -- Generic Graph proxy --------------------------------------------

    graph: <T = unknown>(body: GraphProxyBody) =>
        rustFetch<GraphProxyResult<T>>(`${BASE}/graph`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // -- Ad accounts (Mongo-backed) -------------------------------------

    getAdAccounts: () =>
        rustFetch<AdAccountsResult>(`${BASE}/accounts`, { method: 'POST' }),

    deleteAdAccount: (accountId: string) =>
        rustFetch<SuccessResult>(`${BASE}/accounts/delete`, {
            method: 'POST',
            body: JSON.stringify({ accountId }),
        }),

    // -- Local "quick create" campaigns ---------------------------------

    listLocalCampaigns: (adAccountId: string) =>
        rustFetch<LocalCampaignsResult>(`${BASE}/local-campaigns/list`, {
            method: 'POST',
            body: JSON.stringify({ adAccountId }),
        }),

    insertLocalCampaign: (body: {
        adAccountId: string;
        name: string;
        status: string;
        dailyBudget: number;
        metaCampaignId: string;
        metaAdSetId: string;
        metaAdCreativeId: string;
        metaAdId: string;
    }) =>
        rustFetch<SuccessResult>(`${BASE}/local-campaigns/insert`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteLocalCampaignsByMetaId: (metaCampaignId: string) =>
        rustFetch<SuccessResult>(`${BASE}/local-campaigns/delete-by-meta-id`, {
            method: 'POST',
            body: JSON.stringify({ metaCampaignId }),
        }),

    updateLocalCampaignStatus: (metaCampaignId: string, status: string) =>
        rustFetch<SuccessResult>(`${BASE}/local-campaigns/update-status`, {
            method: 'POST',
            body: JSON.stringify({ metaCampaignId, status }),
        }),

    // -- Multipart uploads ----------------------------------------------

    uploadImage: (formData: FormData) =>
        rustFetch<UploadImageResult>(`${BASE}/upload/image`, {
            method: 'POST',
            body: formData as any,
        }),

    uploadVideo: (formData: FormData) =>
        rustFetch<UploadVideoResult>(`${BASE}/upload/video`, {
            method: 'POST',
            body: formData as any,
        }),

    countLocalCampaignsForUser: () =>
        rustFetch<{ count: number }>(`${BASE}/local-campaigns/count`, {
            method: 'POST',
        }),

    /** Admin-only: total number of `ad_campaigns` mirror records. */
    countLocalCampaignsGlobal: () =>
        rustAdminFetch<{ count: number }>(`${BASE}/admin/local-campaigns/count-global`, {
            method: 'POST',
        }),

    /**
     * Replace `users.metaAdAccounts[]`. Called from the OAuth callback once
     * Meta returns the user's ad accounts. The Rust side trusts the
     * AuthUser.user_id and writes nothing else on the doc.
     */
    setMetaAdAccounts: (accounts: { id: string; name: string; account_id: string }[]) =>
        rustFetch<SuccessResult>(`${BASE}/accounts/set`, {
            method: 'POST',
            body: JSON.stringify({ accounts }),
        }),

    /** Per-campaign last-30d insights, joined into one comparison row each. */
    compareCampaigns: (campaignIds: string[]) =>
        rustFetch<{ comparisons: any[]; error?: string }>(
            `${BASE}/aggregate/compare-campaigns`,
            {
                method: 'POST',
                body: JSON.stringify({ campaignIds }),
            },
        ),

    /**
     * Budget tuning suggestions per active campaign — Rust fetches active
     * campaigns + last-7d insights and applies the CTR/CPC heuristic.
     */
    getBudgetRecommendations: (adAccountId: string) =>
        rustFetch<{ recommendations: any[]; error?: string }>(
            `${BASE}/aggregate/budget-recommendations/${encodeURIComponent(adAccountId)}`,
            { method: 'POST' },
        ),

    /**
     * Last-30d funnel: impressions → reach → clicks → add-to-cart → leads → purchases.
     */
    getConversionFunnel: (adAccountId: string) =>
        rustFetch<{ funnel: any; error?: string }>(
            `${BASE}/aggregate/conversion-funnel/${encodeURIComponent(adAccountId)}`,
            { method: 'POST' },
        ),

    /**
     * Decorated local-campaigns list — Rust merges `ad_campaigns` rows
     * with the current Graph status + insights for their `metaAdId`s.
     */
    decoratedLocalCampaigns: (adAccountId: string) =>
        rustFetch<{ campaigns: any[]; error?: string }>(
            `${BASE}/aggregate/decorated-local-campaigns`,
            {
                method: 'POST',
                body: JSON.stringify({ adAccountId }),
            },
        ),

    /** Ads list with insights flattened + image_url coalesced. */
    reshapedAds: (adSetId: string) =>
        rustFetch<{ ads: any[]; error?: string }>(`${BASE}/aggregate/reshaped-ads`, {
            method: 'POST',
            body: JSON.stringify({ adSetId }),
        }),

    /**
     * Multi-step quick-create: campaign → ad set → creative → ad, then
     * insert into `ad_campaigns`. All four Graph calls + the Mongo write
     * happen on the Rust side in one round trip.
     */
    /** Multipart Server Action entrypoints. */
    fromFormCreateAdCampaign: (formData: FormData) =>
        rustFetch<{ message?: string; error?: string }>(
            `${BASE}/from-form/create-ad-campaign`,
            { method: 'POST', body: formData as any },
        ),

    fromFormCreateAutomatedRule: (formData: FormData) =>
        rustFetch<{ message?: string; error?: string }>(
            `${BASE}/from-form/create-automated-rule`,
            { method: 'POST', body: formData as any },
        ),

    fromFormCreateCustomConversion: (formData: FormData) =>
        rustFetch<{ message?: string; error?: string }>(
            `${BASE}/from-form/create-custom-conversion`,
            { method: 'POST', body: formData as any },
        ),

    quickCreateCampaign: (body: {
        adAccountId: string;
        facebookPageId: string;
        campaignName: string;
        dailyBudgetMinor: number;
        adMessage: string;
        destinationUrl: string;
        objective?: string;
        status?: string;
        imageHash?: string | null;
        targetCountry?: string;
        minAge?: number;
        maxAge?: number;
    }) =>
        rustFetch<{ message?: string; error?: string }>(
            `${BASE}/aggregate/quick-create-campaign`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),
};

export type AdManagerApi = typeof adManagerApi;
