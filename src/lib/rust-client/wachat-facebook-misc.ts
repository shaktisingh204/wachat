/**
 * Client for the Facebook misc-domain router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/misc` by the
 * `wachat-facebook-misc` crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ success?, error?, … }` shape
 * the legacy TS server actions returned, so the calling page/component
 * code does not need to change beyond the import.
 *
 * The router covers the residual stub functions in
 * `src/app/actions/facebook.actions.ts`: subscribed apps + webhook
 * subscription, blocked profiles, two status probes
 * (messaging-feature-review, publishing-auth-status), and the
 * `fb_competitors` collection's CRUD + sync flow.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/misc';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AckResult {
    success?: boolean;
    error?: string;
}

export interface BlockedProfilesResp {
    profiles?: any[];
    error?: string;
}

export interface SubscribedAppsResp {
    apps?: any[];
    error?: string;
}

export interface UpdateWebhookSubscriptionBody {
    subscribedFields: string[];
}

export interface MessagingFeatureReviewItem {
    feature: string;
    status: string;
}

export interface MessagingFeatureReviewResp {
    features?: MessagingFeatureReviewItem[];
    error?: string;
}

export interface PublishingAuthStatusResp {
    data?: any;
    error?: string;
}

export interface CompetitorsResp {
    competitors?: any[];
    error?: string;
}

export interface AddCompetitorBody {
    pageId: string;
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const wachatFacebookMiscApi = {
    // Blocked profiles
    getBlockedProfiles: (projectId: string) =>
        rustFetch<BlockedProfilesResp>(
            `${BASE}/${encodeURIComponent(projectId)}/blocked`,
        ),

    // Subscribed apps + webhook subscription
    getSubscribedApps: (projectId: string) =>
        rustFetch<SubscribedAppsResp>(
            `${BASE}/${encodeURIComponent(projectId)}/subscribed-apps`,
        ),

    updateWebhookSubscription: (projectId: string, subscribedFields: string[]) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/subscribed-apps`,
            {
                method: 'POST',
                body: JSON.stringify({ subscribedFields }),
            },
        ),

    unsubscribeApp: (projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/subscribed-apps`,
            { method: 'DELETE' },
        ),

    // Status probes
    getMessagingFeatureReview: (projectId: string) =>
        rustFetch<MessagingFeatureReviewResp>(
            `${BASE}/${encodeURIComponent(projectId)}/messaging-feature-review`,
        ),

    getPublishingAuthStatus: (projectId: string) =>
        rustFetch<PublishingAuthStatusResp>(
            `${BASE}/${encodeURIComponent(projectId)}/publishing-auth-status`,
        ),

    // Competitors
    getTrackedCompetitors: (projectId: string) =>
        rustFetch<CompetitorsResp>(
            `${BASE}/${encodeURIComponent(projectId)}/competitors`,
        ),

    addCompetitor: (projectId: string, pageId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/competitors`,
            {
                method: 'POST',
                body: JSON.stringify({ pageId } satisfies AddCompetitorBody),
            },
        ),

    removeCompetitor: (competitorId: string) =>
        rustFetch<AckResult>(
            `${BASE}/competitors/${encodeURIComponent(competitorId)}`,
            { method: 'DELETE' },
        ),

    syncCompetitorData: (competitorId: string) =>
        rustFetch<AckResult>(
            `${BASE}/competitors/${encodeURIComponent(competitorId)}/sync`,
            { method: 'POST' },
        ),
};

export type WachatFacebookMiscApi = typeof wachatFacebookMiscApi;
