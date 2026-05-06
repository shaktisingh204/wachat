/**
 * Client for the Ad Manager Audiences + Targeting + Reach router on the
 * Rust BFF.
 *
 * Mirrors the routes registered under `/v1/ads/audiences` by the
 * `wachat-ads-audiences` crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ success?, error?, data? }`
 * envelope the legacy TS server actions returned, so the calling
 * page/component code does not need to change beyond the import.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/ads/audiences';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AckResult<T = any> {
    success?: boolean;
    error?: string;
    data?: T;
}

export interface ListResp<T = any> {
    data?: T[];
    error?: string;
}

export interface ValueResp<T = any> {
    data?: T;
    error?: string;
}

export interface AudiencesResp<T = any> {
    audiences?: T[];
    error?: string;
}

export interface CreateCustomAudienceBody {
    name: string;
    description?: string;
    /** `CUSTOM | WEBSITE | APP | ENGAGEMENT | OFFLINE_CONVERSION`. */
    subtype: string;
    customer_file_source?: string;
    retention_days?: number;
    rule?: Record<string, any>;
}

export interface CreateLookalikeBody {
    name: string;
    origin_audience_id: string;
    country: string;
    /** 0.01 .. 0.20 — defaults to 0.01 when omitted. */
    ratio?: number;
}

export interface CreateSavedAudienceBody {
    name: string;
    description?: string;
    targeting: Record<string, any>;
}

export interface AudienceUsersBody {
    schema: string[];
    /** Pre-hashed (SHA-256) rows aligned with `schema`. */
    hashedUsers: string[][];
}

export interface ShareAudienceBody {
    accountIds: string[];
}

export interface WebsiteRetargetingBody {
    name: string;
    pixel_id: string;
    rule: { inclusions: Record<string, any>; exclusions?: Record<string, any> };
    retention_days?: number;
}

export interface SearchTargetingQuery {
    q: string;
    /** `adinterest | adgeolocation | adworkposition | adworkemployer
     *  | adeducationschool | adeducationmajor | adlocale`. */
    type?: string;
    /** Comma-separated location_types — only honored when type=adgeolocation. */
    locationTypes?: string;
}

export interface BrowseTargetingQuery {
    /** `adinterest_category | behaviors | demographics`. */
    type: string;
}

export interface ReachEstimateBody {
    targeting: Record<string, any>;
    optimization_goal?: string;
    currency?: string;
}

export interface DeliveryEstimateBody {
    targeting_spec: Record<string, any>;
    optimization_goal: string;
    daily_budget?: number;
}

export interface SuggestTargetingBody {
    interestList: string[];
}

export interface ValidateInterest {
    id: string;
    name: string;
}

export interface ValidateTargetingBody {
    interests: ValidateInterest[];
}

export interface TargetingSentenceLinesBody {
    targeting: Record<string, any>;
}

export interface CreateRfpBody {
    campaign_group_id?: string;
    name: string;
    target_spec: Record<string, any>;
    budget: number;
    start_time: string;
    end_time: string;
    buying_type?: 'RESERVED' | 'AUCTION';
    prediction_mode?: number;
    story_event_type?: number;
    destination_id?: string;
    destination_ids?: string[];
    instream_packages?: string[];
}

// ---------------------------------------------------------------------------
//  URL helpers
// ---------------------------------------------------------------------------

function buildQuery(params: Record<string, string | undefined>): string {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
    if (entries.length === 0) return '';
    const qs = entries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
    return `?${qs}`;
}

const enc = (s: string) => encodeURIComponent(s);

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const wachatAdsAudiencesApi = {
    // Custom audiences
    getCustomAudiences: (adAccountId: string) =>
        rustFetch<AudiencesResp>(`${BASE}/ad-accounts/${enc(adAccountId)}/custom-audiences`),

    createCustomAudience: (adAccountId: string, body: CreateCustomAudienceBody) =>
        rustFetch<AckResult<{ id: string }>>(
            `${BASE}/ad-accounts/${enc(adAccountId)}/custom-audiences`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    createLookalikeAudience: (adAccountId: string, body: CreateLookalikeBody) =>
        rustFetch<AckResult>(
            `${BASE}/ad-accounts/${enc(adAccountId)}/lookalike-audiences`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    createWebsiteRetargetingAudience: (adAccountId: string, body: WebsiteRetargetingBody) =>
        rustFetch<AckResult<{ id: string }>>(
            `${BASE}/ad-accounts/${enc(adAccountId)}/website-retargeting-audiences`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    deleteCustomAudience: (audienceId: string) =>
        rustFetch<AckResult>(`${BASE}/custom-audiences/${enc(audienceId)}`, {
            method: 'DELETE',
        }),

    addUsersToCustomAudience: (audienceId: string, body: AudienceUsersBody) =>
        rustFetch<AckResult>(`${BASE}/custom-audiences/${enc(audienceId)}/users`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    removeUsersFromCustomAudience: (audienceId: string, body: AudienceUsersBody) =>
        rustFetch<AckResult>(`${BASE}/custom-audiences/${enc(audienceId)}/users`, {
            method: 'DELETE',
            body: JSON.stringify(body),
        }),

    shareCustomAudience: (audienceId: string, body: ShareAudienceBody) =>
        rustFetch<AckResult>(`${BASE}/custom-audiences/${enc(audienceId)}/share`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listSharedAudienceAccounts: (audienceId: string) =>
        rustFetch<ListResp>(`${BASE}/custom-audiences/${enc(audienceId)}/share`),

    // Saved audiences
    getSavedAudiences: (adAccountId: string) =>
        rustFetch<ListResp>(`${BASE}/ad-accounts/${enc(adAccountId)}/saved-audiences`),

    createSavedAudience: (adAccountId: string, body: CreateSavedAudienceBody) =>
        rustFetch<AckResult>(
            `${BASE}/ad-accounts/${enc(adAccountId)}/saved-audiences`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    deleteSavedAudience: (audienceId: string) =>
        rustFetch<AckResult>(`${BASE}/saved-audiences/${enc(audienceId)}`, {
            method: 'DELETE',
        }),

    // Targeting search & introspection
    searchTargeting: (q: SearchTargetingQuery) =>
        rustFetch<ListResp>(
            `${BASE}/targeting/search${buildQuery({
                q: q.q,
                type: q.type,
                locationTypes: q.locationTypes,
            })}`,
        ),

    browseTargeting: (q: BrowseTargetingQuery) =>
        rustFetch<ListResp>(`${BASE}/targeting/browse${buildQuery({ type: q.type })}`),

    suggestTargeting: (body: SuggestTargetingBody) =>
        rustFetch<ListResp>(`${BASE}/targeting/suggest`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    validateTargeting: (body: ValidateTargetingBody) =>
        rustFetch<ListResp>(`${BASE}/targeting/validate`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    getTargetingSentenceLines: (adAccountId: string, body: TargetingSentenceLinesBody) =>
        rustFetch<ListResp>(
            `${BASE}/ad-accounts/${enc(adAccountId)}/targeting-sentence-lines`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    // Reach / delivery / RFP
    getReachEstimate: (adAccountId: string, body: ReachEstimateBody) =>
        rustFetch<ValueResp>(
            `${BASE}/ad-accounts/${enc(adAccountId)}/reach-estimate`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    getDeliveryEstimate: (adAccountId: string, body: DeliveryEstimateBody) =>
        rustFetch<ValueResp>(
            `${BASE}/ad-accounts/${enc(adAccountId)}/delivery-estimate`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    listReachFrequencyPredictions: (adAccountId: string) =>
        rustFetch<ListResp>(
            `${BASE}/ad-accounts/${enc(adAccountId)}/reach-frequency-predictions`,
        ),

    createReachFrequencyPrediction: (adAccountId: string, body: CreateRfpBody) =>
        rustFetch<AckResult<{ id: string }>>(
            `${BASE}/ad-accounts/${enc(adAccountId)}/reach-frequency-predictions`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
};

export type WachatAdsAudiencesApi = typeof wachatAdsAudiencesApi;
