/**
 * Client for the SabChat reports Rust crate — `/v1/sabchat/reports/*`.
 *
 * Mirrors the read-only analytics endpoints exposed by `sabchat-reports`:
 *   GET /live              → live queue counts + SLA breach + longest wait
 *   GET /volume            → conversation + message buckets over a window
 *   GET /response-times    → first-response latency percentiles (minutes)
 *   GET /by-agent          → per-agent leaderboard rows
 *   GET /by-inbox          → per-inbox rollup rows
 *   GET /by-channel        → per-channelType rollup rows
 *   GET /csat              → CSAT summary
 *
 * Server-only — the JWT-issuing fetcher must never reach the browser.
 */
import 'server-only';

import { rustFetch } from './fetcher';

// ---------------------------------------------------------------------------
// Wire types (mirror the Rust DTOs — camelCase).
// ---------------------------------------------------------------------------

export interface LiveReport {
    openCount: number;
    pendingCount: number;
    snoozedCount: number;
    slaBreachedCount: number;
    longestWaitMinutes: number;
    queueByInbox: Array<{ inboxId: string; name: string; count: number }>;
}

export interface VolumeBucket {
    at: string;
    conversations: number;
    messages: number;
}

export interface VolumeReport {
    buckets: VolumeBucket[];
}

export interface ResponseTimes {
    count: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
}

export interface AgentRow {
    agentId: string;
    conversationsHandled: number;
    avgFirstResponseMin: number;
    resolvedCount: number;
    openCount: number;
}

export interface InboxRow {
    inboxId: string;
    name: string;
    channelType: string;
    conversationsCreated: number;
    messagesSent: number;
    avgFirstResponseMin: number;
    resolvedCount: number;
}

export interface ChannelRow {
    channelType: string;
    conversationsCreated: number;
    messagesSent: number;
    resolvedCount: number;
}

export interface CsatStats {
    count: number;
    mean?: number;
    distribution?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const sabchatReportsApi = {
    live: () => rustFetch<LiveReport>('/v1/sabchat/reports/live'),

    volume: (q: { from?: string; to?: string; groupBy?: 'hour' | 'day' | 'week' } = {}) =>
        rustFetch<VolumeReport>(`/v1/sabchat/reports/volume${qs(q)}`),

    responseTimes: (q: { from?: string; to?: string } = {}) =>
        rustFetch<ResponseTimes>(`/v1/sabchat/reports/response-times${qs(q)}`),

    byAgent: (q: { from?: string; to?: string } = {}) =>
        rustFetch<AgentRow[]>(`/v1/sabchat/reports/by-agent${qs(q)}`),

    byInbox: (q: { from?: string; to?: string } = {}) =>
        rustFetch<InboxRow[]>(`/v1/sabchat/reports/by-inbox${qs(q)}`),

    byChannel: (q: { from?: string; to?: string } = {}) =>
        rustFetch<ChannelRow[]>(`/v1/sabchat/reports/by-channel${qs(q)}`),

    csat: (q: { from?: string; to?: string } = {}) =>
        rustFetch<CsatStats>(`/v1/sabchat/reports/csat${qs(q)}`),
};

export type SabchatReportsApi = typeof sabchatReportsApi;
