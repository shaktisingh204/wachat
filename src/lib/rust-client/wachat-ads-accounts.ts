/**
 * Client for the Ad Accounts & Business router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/ads/accounts` by the
 * `wachat-ads-accounts` crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ data?, error?, … }` shape
 * the legacy TS server actions in
 * `src/app/actions/ad-manager.actions.ts` returned, so the calling
 * page/component code does not need to change beyond the import.
 *
 *   GET    /                                          getAdAccounts
 *   GET    /:adAccountId                              getAdAccountDetails
 *   DELETE /:adAccountId                              deleteAdAccount
 *   GET    /:adAccountId/spend                        getAdAccountSpend
 *   GET    /:adAccountId/capabilities                 getAdAccountCapabilities
 *   GET    /:adAccountId/activities                   getAdAccountActivities
 *   GET    /:adAccountId/users                        listAdAccountUsers
 *   GET    /:adAccountId/agencies                     listAdAccountAgencies
 *   GET    /business/:businessId/invoices             listBusinessInvoices
 *   GET    /business/:businessId/users                listBusinessUsers
 *   GET    /business/:businessId/partners             listBusinessPartners
 *   GET    /business/:businessId/extended-credits     listExtendedCredits
 *   GET    /pages                                     getFacebookPagesForAdCreation
 *   GET    /pages/:pageId/instagram-accounts          getInstagramAccountsForPage
 *   GET    /pages/:pageId/instagram-business          getInstagramBusinessAccount
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/ads/accounts';

// ---------------------------------------------------------------------------
//  Wire shapes (mirror the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AdAccountsResp {
    accounts: any[];
    error?: string;
}

export interface DataResp<T = any> {
    data?: T;
    error?: string;
}

export interface ListResp<T = any> {
    data?: T[];
    error?: string;
}

export interface DeleteAdAccountResp {
    success: boolean;
    error?: string;
}

export interface PagesResp {
    pages?: any[];
    error?: string;
}

export interface SpendQuery {
    since?: string;
    until?: string;
}

export interface ActivitiesQuery {
    since?: string;
    until?: string;
    limit?: number;
}

// ---------------------------------------------------------------------------
//  Internals
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null> | SpendQuery | ActivitiesQuery): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const wachatAdsAccountsApi = {
    // -------- User-level "my ad accounts" --------------------------------
    getAdAccounts: () => rustFetch<AdAccountsResp>(`${BASE}/`),
    
    syncAdAccounts: () => rustFetch<AdAccountsResp>(`${BASE}/sync`, { method: 'POST' }),

    getAdAccountDetails: (adAccountId: string) =>
        rustFetch<DataResp>(`${BASE}/${encodeURIComponent(adAccountId)}`),

    deleteAdAccount: (adAccountId: string) =>
        rustFetch<DeleteAdAccountResp>(
            `${BASE}/${encodeURIComponent(adAccountId)}`,
            { method: 'DELETE' },
        ),

    // -------- Ad-account-scoped lookups ---------------------------------
    getAdAccountSpend: (adAccountId: string, query: SpendQuery = {}) =>
        rustFetch<DataResp>(
            `${BASE}/${encodeURIComponent(adAccountId)}/spend${qs(query)}`,
        ),

    getAdAccountCapabilities: (adAccountId: string) =>
        rustFetch<DataResp>(
            `${BASE}/${encodeURIComponent(adAccountId)}/capabilities`,
        ),

    getAdAccountActivities: (adAccountId: string, query: ActivitiesQuery = {}) =>
        rustFetch<ListResp>(
            `${BASE}/${encodeURIComponent(adAccountId)}/activities${qs(query)}`,
        ),

    listAdAccountUsers: (adAccountId: string) =>
        rustFetch<ListResp>(`${BASE}/${encodeURIComponent(adAccountId)}/users`),

    listAdAccountAgencies: (adAccountId: string) =>
        rustFetch<ListResp>(
            `${BASE}/${encodeURIComponent(adAccountId)}/agencies`,
        ),

    // -------- Business-scoped lookups -----------------------------------
    listBusinessInvoices: (businessId: string) =>
        rustFetch<ListResp>(
            `${BASE}/business/${encodeURIComponent(businessId)}/invoices`,
        ),

    listBusinessUsers: (businessId: string) =>
        rustFetch<ListResp>(
            `${BASE}/business/${encodeURIComponent(businessId)}/users`,
        ),

    listBusinessPartners: (businessId: string) =>
        rustFetch<ListResp>(
            `${BASE}/business/${encodeURIComponent(businessId)}/partners`,
        ),

    listExtendedCredits: (businessId: string) =>
        rustFetch<ListResp>(
            `${BASE}/business/${encodeURIComponent(businessId)}/extended-credits`,
        ),

    // -------- Page + Instagram discovery (creative wizard) --------------
    getFacebookPagesForAdCreation: () => rustFetch<PagesResp>(`${BASE}/pages`),

    getInstagramAccountsForPage: (pageId: string) =>
        rustFetch<ListResp>(
            `${BASE}/pages/${encodeURIComponent(pageId)}/instagram-accounts`,
        ),

    getInstagramBusinessAccount: (pageId: string) =>
        rustFetch<DataResp>(
            `${BASE}/pages/${encodeURIComponent(pageId)}/instagram-business`,
        ),
};

export type WachatAdsAccountsApi = typeof wachatAdsAccountsApi;
