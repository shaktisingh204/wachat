/**
 * Client for the Ad Manager Pixels-and-friends router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/ads/pixels` by the
 * `wachat-ads-pixels` crate, which ports the Pixels + Conversions API +
 * Offline Events + Lead Gen + Catalogs slice of
 * `src/app/actions/ad-manager.actions.ts`. Each method is a thin wrapper
 * around {@link rustFetch} and returns the same `{ data?, error? }` envelopes
 * the legacy TS server actions returned, so calling code does not need to
 * change beyond the import.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/ads/pixels';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AdsPixelsAckResult {
    success?: boolean;
    error?: string;
    data?: unknown;
}

export interface AdsPixelsListResp {
    data?: unknown[];
    error?: string;
}

export interface AdsPixelsValueResp {
    data?: unknown;
    error?: string;
}

export type PixelStatsAggregation = 'event' | 'browser_type' | 'url';

export interface CreatePixelBody {
    name: string;
}

export interface SharePixelBody {
    adAccountId: string;
}

export interface CreateCustomConversionBody {
    name: string;
    description?: string;
    custom_event_type: string;
    rule: Record<string, unknown>;
    default_conversion_value?: number;
}

export interface ConversionApiEventBody {
    event_name: string;
    event_time: number;
    user_data: Record<string, unknown>;
    custom_data?: Record<string, unknown>;
    action_source?: string;
    event_source_url?: string;
}

export interface UploadOfflineEventsBody {
    events: Array<Record<string, unknown>>;
}

export interface CreateProductSetBody {
    name: string;
    filter?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function jsonInit(body: unknown): RequestInit {
    return {
        method: 'POST',
        body: JSON.stringify(body),
    };
}

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && `${v}`.length > 0,
    ) as Array<[string, string | number]>;
    if (entries.length === 0) return path;
    const qs = entries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(`${v}`)}`)
        .join('&');
    return `${path}?${qs}`;
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const wachatAdsPixelsApi = {
    // -------- Pixels --------

    /** Legacy: `listPixels(adAccountId)`. */
    listPixels: (adAccountId: string) =>
        rustFetch<AdsPixelsListResp>(
            `${BASE}/ad-accounts/${encodeURIComponent(adAccountId)}/pixels`,
        ),

    /** Legacy: `createPixel(adAccountId, name)`. */
    createPixel: (adAccountId: string, body: CreatePixelBody) =>
        rustFetch<AdsPixelsAckResult>(
            `${BASE}/ad-accounts/${encodeURIComponent(adAccountId)}/pixels`,
            jsonInit(body),
        ),

    /** Legacy: `getPixelStats(pixelId, aggregation?)`. */
    getPixelStats: (pixelId: string, aggregation: PixelStatsAggregation = 'event') =>
        rustFetch<AdsPixelsValueResp>(
            withQuery(`${BASE}/pixels/${encodeURIComponent(pixelId)}/stats`, { aggregation }),
        ),

    /** Legacy: `sharePixelWithAdAccount(pixelId, adAccountId)`. */
    sharePixelWithAdAccount: (pixelId: string, body: SharePixelBody) =>
        rustFetch<AdsPixelsAckResult>(
            `${BASE}/pixels/${encodeURIComponent(pixelId)}/share`,
            jsonInit(body),
        ),

    // -------- Custom conversions --------

    /** Legacy: `listCustomConversions(adAccountId)` (Pixels-slice variant). */
    listCustomConversions: (adAccountId: string) =>
        rustFetch<AdsPixelsListResp>(
            `${BASE}/ad-accounts/${encodeURIComponent(adAccountId)}/custom-conversions`,
        ),

    /**
     * Legacy: `createCustomConversion(adAccountId, payload)` from
     * `ad-manager.actions.ts`. The same name also exists in
     * `ad-manager-features.actions.ts` — this wrapper targets the
     * Pixels-slice port.
     */
    createCustomConversion: (adAccountId: string, body: CreateCustomConversionBody) =>
        rustFetch<AdsPixelsAckResult>(
            `${BASE}/ad-accounts/${encodeURIComponent(adAccountId)}/custom-conversions`,
            jsonInit(body),
        ),

    // -------- Conversions API + Offline Events --------

    /** Legacy: `sendConversionApiEvent(pixelId, payload)`. */
    sendConversionApiEvent: (pixelId: string, body: ConversionApiEventBody) =>
        rustFetch<AdsPixelsAckResult>(
            `${BASE}/pixels/${encodeURIComponent(pixelId)}/events`,
            jsonInit(body),
        ),

    /** Legacy: `listOfflineEventSets(adAccountId)`. */
    listOfflineEventSets: (adAccountId: string) =>
        rustFetch<AdsPixelsListResp>(
            `${BASE}/ad-accounts/${encodeURIComponent(adAccountId)}/offline-event-sets`,
        ),

    /** Legacy: `uploadOfflineEvents(dataSetId, events)`. */
    uploadOfflineEvents: (dataSetId: string, events: Array<Record<string, unknown>>) =>
        rustFetch<AdsPixelsAckResult>(
            `${BASE}/offline-event-sets/${encodeURIComponent(dataSetId)}/events`,
            jsonInit({ events } satisfies UploadOfflineEventsBody),
        ),

    // -------- Lead Gen --------

    /** Legacy: `listLeadGenForms(pageId)`. */
    listLeadGenForms: (pageId: string) =>
        rustFetch<AdsPixelsListResp>(
            `${BASE}/pages/${encodeURIComponent(pageId)}/leadgen-forms`,
        ),

    /** Legacy: `getLeadsFromForm(formId, since?)`. */
    getLeadsFromForm: (formId: string, since?: number) =>
        rustFetch<AdsPixelsListResp>(
            withQuery(`${BASE}/leadgen-forms/${encodeURIComponent(formId)}/leads`, { since }),
        ),

    // -------- Catalogs / Product sets --------

    /** Legacy: `listCatalogs(businessId)`. */
    listCatalogs: (businessId: string) =>
        rustFetch<AdsPixelsListResp>(
            `${BASE}/businesses/${encodeURIComponent(businessId)}/catalogs`,
        ),

    /** Legacy: `listProductSets(catalogId)`. */
    listProductSets: (catalogId: string) =>
        rustFetch<AdsPixelsListResp>(
            `${BASE}/catalogs/${encodeURIComponent(catalogId)}/product-sets`,
        ),

    /** Legacy: `createProductSet(catalogId, payload)`. */
    createProductSet: (catalogId: string, body: CreateProductSetBody) =>
        rustFetch<AdsPixelsAckResult>(
            `${BASE}/catalogs/${encodeURIComponent(catalogId)}/product-sets`,
            jsonInit(body),
        ),
};

export type WachatAdsPixelsApi = typeof wachatAdsPixelsApi;
