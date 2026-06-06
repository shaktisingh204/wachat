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
// Mongo-only roll-ups (Wave D) — GET endpoints backing the dashboard pages.
//
// All three are pure Mongo aggregations (no Meta Graph) over the real
// `outgoing_messages` / `messages` / `broadcasts` / `agents` / `wa_chat_ratings`
// collections. Response field names mirror the Rust crates verbatim
// (`serde(rename_all = "camelCase")`) — see `wachat-analytics`:
//   - `dashboard_summary.rs`  → DashboardSummaryResult
//   - `agent_performance.rs`  → AgentPerformanceResult
//   - `agent_hourly.rs`       → AgentHourlyResult
// ---------------------------------------------------------------------------

/**
 * One day of the 30-day overview chart series.
 * `date` is `YYYY-MM-DD` (UTC). Mirrors Rust `DailyPoint`.
 */
export interface DashboardDailyPoint {
    date: string;
    sent: number;
    delivered: number;
    read: number;
}

/**
 * Result of `GET /v1/wachat/analytics/projects/:id/dashboard-summary`.
 *
 * Single-call replacement for the native `getDashboardStats` +
 * `getDashboardChartData`: headline totals plus a dense, zero-filled 30-day
 * daily series (exactly 30 entries, oldest → newest). Mirrors Rust
 * `DashboardSummary`.
 */
export interface DashboardSummaryResult {
    totalMessages: number;
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
    totalCampaigns: number;
    /** Exactly 30 entries, oldest → newest, zero-filled for empty days. */
    dailySeries: DashboardDailyPoint[];
}

/**
 * One per-agent leaderboard row. Mirrors Rust `AgentPerformanceRow`.
 *
 * `csatScore` is the average customer-satisfaction rating and `csatReviews`
 * the number of ratings backing it — both `0` when an agent has no ratings
 * (never fabricated).
 */
export interface AgentPerformanceRow {
    agentId: string;
    agentName: string;
    messagesSent: number;
    avgResponseMs: number;
    totalConversations: number;
    csatScore: number;
    csatReviews: number;
}

/**
 * Result of `GET /v1/wachat/analytics/projects/:id/agent-performance?days=N`.
 * Mirrors Rust `AgentPerformanceResult`. `days` echoes the clamped window
 * (1..=365, default 30).
 */
export interface AgentPerformanceResult {
    days: number;
    performance: AgentPerformanceRow[];
}

/**
 * One hour-of-day bucket for the response-time drill-in.
 * `hour` is 0–23 (UTC). Mirrors Rust `HourlyBucket`.
 */
export interface AgentHourlyBucket {
    hour: number;
    avgResponseMs: number;
    messageCount: number;
}

/**
 * Result of `GET /v1/wachat/analytics/projects/:id/agents/:agentId/hourly?days=N`.
 *
 * Per-agent hourly response-time buckets — a dense 24-entry series (hour 0 →
 * 23, zero-filled) plus the window totals. Mirrors Rust `AgentHourlyResult`.
 */
export interface AgentHourlyResult {
    agentId: string;
    days: number;
    totalMessages: number;
    /** Overall mean response time across the window, ms (0 when no data). */
    avgResponseMs: number;
    /** Exactly 24 entries, hour 0 → 23. */
    buckets: AgentHourlyBucket[];
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

    // --- Wave D: Mongo-only roll-ups (GET) ---

    /**
     * `GET /projects/:id/dashboard-summary` — overview totals + dense 30-day
     * daily series in one response. Backs `/wachat/overview`.
     */
    dashboardSummary: (projectId: string) =>
        rustFetch<DashboardSummaryResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/dashboard-summary`,
        ),

    /**
     * `GET /projects/:id/agent-performance?days=N` — per-agent leaderboard with
     * real CSAT join. Backs `/wachat/team-performance`. `days` defaults to the
     * Rust default (30) when omitted; the server clamps it to 1..=365.
     */
    agentPerformance: (projectId: string, days?: number) =>
        rustFetch<AgentPerformanceResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/agent-performance${
                typeof days === 'number' ? `?days=${encodeURIComponent(String(days))}` : ''
            }`,
        ),

    /**
     * `GET /projects/:id/agents/:agentId/hourly?days=N` — per-hour response-time
     * buckets for one agent (response-time-tracker drill-in). `days` defaults
     * to the Rust default (30) when omitted; the server clamps it to 1..=365.
     */
    agentHourly: (projectId: string, agentId: string, days?: number) =>
        rustFetch<AgentHourlyResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(
                agentId,
            )}/hourly${typeof days === 'number' ? `?days=${encodeURIComponent(String(days))}` : ''}`,
        ),
};

export type WachatAnalyticsApi = typeof wachatAnalyticsApi;
