/**
 * Client for the Facebook Pages & Profile management router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/pages` by the
 * `wachat-facebook-pages` crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ success?, error?, … }` shape
 * the legacy TS server actions returned, so the calling page/component
 * code does not need to change beyond the import.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/pages';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AckResult {
    success?: boolean;
    error?: string;
    redirectPath?: string;
}

export interface PageSetupBody {
    projectId: string;
    facebookPageId: string;
    accessToken: string;
}

export interface OAuthCallbackBody {
    code: string;
    state: string;
    /** Hex string of the user's Mongo `_id` from the active session. */
    userId: string;
    /** Raw value of the `onboarding_state` cookie. */
    stateCookie: string;
    includeCatalog?: boolean;
    /**
     * Facebook Login for Business (JS-SDK `FB.login`) flow — exchange the code
     * WITHOUT a `redirect_uri`. Leave unset/false for the classic redirect flow.
     */
    embedded?: boolean;
}

export interface ManualSetupBody {
    projectName: string;
    facebookPageId: string;
    accessToken: string;
}

export interface PagesResp {
    pages?: any[];
    error?: string;
}

export interface PageDetailsResp {
    page?: any;
    error?: string;
}

export interface UpdatePageDetailsBody {
    projectId: string;
    pageId: string;
    about?: string;
    phone?: string;
    website?: string;
}

export interface PageInsightsResp {
    insights?: { pageReach: number; postEngagement: number };
    error?: string;
}

export interface DetailedInsightsQuery {
    metrics?: string;
    period?: 'day' | 'week' | 'days_28' | 'month' | 'lifetime';
    since?: string;
    until?: string;
}

export interface DemographicsResp {
    demographics?: Record<string, any>;
    error?: string;
}

export interface CtaResp {
    cta?: any;
    error?: string;
}

export type CtaType =
    | 'BOOK_NOW'
    | 'CALL_NOW'
    | 'CONTACT_US'
    | 'GET_QUOTE'
    | 'MESSAGE_PAGE'
    | 'ORDER_FOOD'
    | 'SHOP_NOW'
    | 'SIGN_UP'
    | 'WATCH_VIDEO'
    | 'SEND_EMAIL'
    | 'LEARN_MORE';

export interface SetCtaBody {
    type: CtaType;
    webUrl?: string;
}

export interface DebugTokenResp {
    tokenInfo?: any;
    error?: string;
}

export interface RefreshTokenResp {
    success: boolean;
    newExpiry?: number;
    error?: string;
}

export interface LiveVideosResp {
    liveVideos?: any[];
    error?: string;
}

export interface CreateLiveVideoBody {
    title: string;
    description?: string;
}

export interface CreateLiveVideoResp {
    liveVideo?: any;
    error?: string;
}

export interface LiveVideoCommentsResp {
    comments?: any[];
    error?: string;
}

export interface ListEnvelope<K extends string> {
    [key: string]: any[] | string | undefined;
    error?: string;
}

export interface SettingsResp { settings?: any[]; error?: string; }
export interface LocationsResp { locations?: any[]; error?: string; }
export interface TabsResp { tabs?: any[]; error?: string; }
export interface RolesResp { roles?: any[]; error?: string; }
export interface InsightsResp { insights?: any[]; error?: string; }

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

function buildQuery(params: Record<string, string | undefined>): string {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
    if (entries.length === 0) return '';
    const qs = entries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
    return `?${qs}`;
}

export const wachatFacebookPagesApi = {
    // OAuth + setup
    handleFacebookPageSetup: (body: PageSetupBody) =>
        rustFetch<AckResult>(`${BASE}/setup`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    handleFacebookOAuthCallback: (body: OAuthCallbackBody) =>
        rustFetch<AckResult>(`${BASE}/oauth-callback`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    handleManualFacebookPageSetup: (body: ManualSetupBody) =>
        rustFetch<AckResult>(`${BASE}/manual-setup`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // User-level pages
    getFacebookPages: () => rustFetch<PagesResp>(BASE),

    // Project-scoped page detail / mutation
    getPageDetails: (projectId: string) =>
        rustFetch<PageDetailsResp>(`${BASE}/${encodeURIComponent(projectId)}`),

    handleUpdatePageDetails: (projectId: string, body: UpdatePageDetailsBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(projectId)}/details`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // Insights
    getPageInsights: (projectId: string) =>
        rustFetch<PageInsightsResp>(`${BASE}/${encodeURIComponent(projectId)}/insights`),

    getDetailedPageInsights: (projectId: string, q?: DetailedInsightsQuery) =>
        rustFetch<InsightsResp>(
            `${BASE}/${encodeURIComponent(projectId)}/insights/detailed${buildQuery((q || {}) as Record<string, string | undefined>)}`,
        ),

    getPageFanDemographics: (projectId: string) =>
        rustFetch<DemographicsResp>(
            `${BASE}/${encodeURIComponent(projectId)}/insights/demographics`,
        ),

    // Settings / locations / tabs / roles
    getPageSettings: (projectId: string) =>
        rustFetch<SettingsResp>(`${BASE}/${encodeURIComponent(projectId)}/settings`),

    getPageLocations: (projectId: string) =>
        rustFetch<LocationsResp>(`${BASE}/${encodeURIComponent(projectId)}/locations`),

    getPageTabs: (projectId: string) =>
        rustFetch<TabsResp>(`${BASE}/${encodeURIComponent(projectId)}/tabs`),

    getPageRoles: (projectId: string) =>
        rustFetch<RolesResp>(`${BASE}/${encodeURIComponent(projectId)}/roles`),

    // Page CTA
    getPageCallToAction: (projectId: string) =>
        rustFetch<CtaResp>(`${BASE}/${encodeURIComponent(projectId)}/cta`),

    setPageCallToAction: (projectId: string, body: SetCtaBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(projectId)}/cta`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // Token management
    debugAccessToken: (projectId: string) =>
        rustFetch<DebugTokenResp>(`${BASE}/${encodeURIComponent(projectId)}/token/debug`),

    refreshLongLivedToken: (projectId: string) =>
        rustFetch<RefreshTokenResp>(
            `${BASE}/${encodeURIComponent(projectId)}/token/refresh`,
            { method: 'POST' },
        ),

    // Live videos
    getPageLiveVideos: (projectId: string) =>
        rustFetch<LiveVideosResp>(`${BASE}/${encodeURIComponent(projectId)}/live-videos`),

    createLiveVideo: (projectId: string, body: CreateLiveVideoBody) =>
        rustFetch<CreateLiveVideoResp>(
            `${BASE}/${encodeURIComponent(projectId)}/live-videos`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    endLiveVideo: (projectId: string, liveVideoId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/live-videos/${encodeURIComponent(liveVideoId)}/end`,
            { method: 'POST' },
        ),

    getLiveVideoComments: (projectId: string, liveVideoId: string) =>
        rustFetch<LiveVideoCommentsResp>(
            `${BASE}/${encodeURIComponent(projectId)}/live-videos/${encodeURIComponent(liveVideoId)}/comments`,
        ),
};

export type WachatFacebookPagesApi = typeof wachatFacebookPagesApi;
