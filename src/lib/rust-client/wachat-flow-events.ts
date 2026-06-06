/**
 * Client for the Wachat **flow-events** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/flow-events` by the
 * `wachat-flow-events` crate — read-only trigger analytics aggregated over the
 * `wa_flow_events` collection, scoped to the authenticated user:
 *
 *   GET /                  → batchMetrics (?projectId=…) — flowId(hex) → metrics map
 *   GET /{flowId}/metrics  → flowMetrics — metrics for a single flow
 *
 * Reads never fabricate values: a flow with no events yields
 * `{ triggersToday: 0, totalTriggers: 0, lastTriggeredAt: null }`.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/flow-events';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Trigger metrics for a single flow.
 *
 * Mirrors `wachat_flow_events::dto::FlowMetrics`. The counts are zero and
 * `lastTriggeredAt` is `null` when the flow has no recorded events yet.
 */
export interface FlowMetrics {
    /** Events whose `ts` falls on the current UTC day. */
    triggersToday: number;
    /** Total events ever recorded for the flow. */
    totalTriggers: number;
    /** ISO-8601 timestamp of the most recent event, or `null` when none. */
    lastTriggeredAt: string | null;
}

/**
 * Response for `GET /v1/wachat/flow-events?projectId=…`.
 *
 * The Rust handler serializes its `BatchMetricsResponse` with
 * `#[serde(transparent)]`, so the wire body is the bare map itself — a
 * `flowId` (hex string) → {@link FlowMetrics} object. Flows with no events are
 * simply absent from the map (callers default them to the zero baseline).
 */
export type BatchMetricsResponse = Record<string, FlowMetrics>;

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatFlowEventsApi = {
    /**
     * Batch trigger metrics for every flow in a project, keyed by `flowId` hex.
     * `GET /v1/wachat/flow-events?projectId={projectId}`
     */
    batchMetrics: (projectId: string) =>
        rustFetch<BatchMetricsResponse>(
            `${BASE}/?projectId=${encodeURIComponent(projectId)}`,
        ),

    /**
     * Trigger metrics for a single flow owned by the caller.
     * `GET /v1/wachat/flow-events/{flowId}/metrics`
     */
    flowMetrics: (flowId: string) =>
        rustFetch<FlowMetrics>(
            `${BASE}/${encodeURIComponent(flowId)}/metrics`,
        ),
};

export type WachatFlowEventsApi = typeof wachatFlowEventsApi;
