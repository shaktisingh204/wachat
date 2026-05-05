/**
 * Client for the Wachat **analytics** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/analytics`:
 *
 *   POST /projects/:id/conversation                       → conversationAnalytics
 *   POST /projects/:id/template                           → templateAnalytics
 *   POST /projects/:id/messaging-limit-tier/:pnid         → messagingLimitTier
 *   POST /projects/:id/local-messages                     → localMessageAnalytics
 *   POST /projects/:id/broadcasts                         → broadcastAnalytics
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/analytics';

// ---------------------------------------------------------------------------
// Granularity / shared
// ---------------------------------------------------------------------------

export type ConversationAnalyticsGranularity = 'HALF_HOUR' | 'DAILY' | 'MONTHLY';

// ---------------------------------------------------------------------------
// Conversation analytics
// ---------------------------------------------------------------------------

/**
 * Body for `POST /v1/wachat/analytics/projects/:id/conversation`.
 *
 * Mirrors the legacy `getConversationAnalytics` arguments. Each of the
 * `phoneNumbers`, `countries`, `conversationCategories`, `conversationTypes`,
 * and `dimensions` arrays is optional — empty/omitted means "no filter on
 * this axis". The Rust handler builds the Meta `conversation_analytics.start
 * (...).end(...).granularity(...)` field-spec from these and forwards to
 * `GET https://graph.facebook.com/v23.0/{wabaId}`.
 */
export interface ConversationAnalyticsBody {
    startTimestamp: number;
    endTimestamp: number;
    granularity?: ConversationAnalyticsGranularity;
    phoneNumbers?: string[];
    countries?: string[];
    conversationCategories?: string[];
    conversationTypes?: string[];
    dimensions?: string[];
}

/**
 * Result of `POST /v1/wachat/analytics/projects/:id/conversation`.
 *
 * `dataPoints` is the array Meta returns under `conversation_analytics.data
 * .data_points` (or the legacy `analytics.data_points` shape). Each row's
 * exact shape depends on the requested `dimensions`, so we keep it as
 * `unknown[]` on the wire and let call sites narrow.
 */
export interface ConversationAnalyticsResult {
    dataPoints: Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Template analytics
// ---------------------------------------------------------------------------

export interface TemplateAnalyticsBody {
    startTimestamp: number;
    endTimestamp: number;
    templateIds?: string[];
    granularity?: ConversationAnalyticsGranularity;
}

export interface TemplateAnalyticsResult {
    dataPoints: Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Messaging-limit tier
// ---------------------------------------------------------------------------

export interface MessagingLimitTierResult {
    tier?: string;
}

// ---------------------------------------------------------------------------
// Local Mongo aggregations — outgoing/incoming messages
// ---------------------------------------------------------------------------

/** ISO-8601 strings on the wire — Rust deserializes via `chrono::DateTime<Utc>`. */
export interface LocalMessageAnalyticsBody {
    startDate: string;
    endDate: string;
}

export interface LocalMessageDailyStat {
    date: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    incoming: number;
}

export interface LocalMessageAnalyticsResult {
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
    totalIncoming: number;
    dailyBreakdown: LocalMessageDailyStat[];
}

// ---------------------------------------------------------------------------
// Broadcast analytics
// ---------------------------------------------------------------------------

export interface BroadcastAnalyticsBody {
    startDate?: string;
    endDate?: string;
}

export interface BroadcastSummary {
    name: string;
    templateName: string;
    contactCount: number;
    successCount: number;
    failedCount: number;
    status: string;
    /** ISO-8601 timestamp from the Mongo `broadcasts.createdAt` field. */
    createdAt: string | null;
}

export interface BroadcastAnalyticsResult {
    totalBroadcasts: number;
    totalContacts: number;
    totalSuccess: number;
    totalFailed: number;
    broadcasts: BroadcastSummary[];
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatAnalyticsApi = {
    conversationAnalytics: (
        projectId: string,
        body: ConversationAnalyticsBody,
    ) =>
        rustFetch<ConversationAnalyticsResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/conversation`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    templateAnalytics: (projectId: string, body: TemplateAnalyticsBody) =>
        rustFetch<TemplateAnalyticsResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/template`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    messagingLimitTier: (projectId: string, phoneNumberId: string) =>
        rustFetch<MessagingLimitTierResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/messaging-limit-tier/${encodeURIComponent(phoneNumberId)}`,
            { method: 'POST' },
        ),

    localMessageAnalytics: (
        projectId: string,
        body: LocalMessageAnalyticsBody,
    ) =>
        rustFetch<LocalMessageAnalyticsResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/local-messages`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    broadcastAnalytics: (projectId: string, body: BroadcastAnalyticsBody) =>
        rustFetch<BroadcastAnalyticsResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/broadcasts`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),
};

export type WachatAnalyticsApi = typeof wachatAnalyticsApi;
