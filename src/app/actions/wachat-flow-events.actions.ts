'use server';

/**
 * Wachat flow-events server actions — read-only trigger analytics.
 *
 * Thin shims around the `wachat-flow-events` Rust crate (mounted at
 * `/v1/wachat/flow-events`). The crate owns the aggregation over the
 * `wa_flow_events` collection — these actions only validate input, delegate to
 * {@link wachatFlowEventsApi}, and revalidate the flow-builder pages.
 *
 * Replaces the fabricated `Math.random()` metrics that lived in
 * `flow.actions.ts#getFlowMetrics` and the deterministic-hash mock on the list
 * page: every value here is a real count (zeros when a flow has no events).
 *
 * NOTE: `wachatFlowEventsApi` is imported DIRECTLY here rather than through
 * `@/lib/rust-client` — it is registered on the central `rustClient` barrel
 * separately (see this module's wiring note).
 */

import { revalidatePath } from 'next/cache';

import {
    wachatFlowEventsApi,
    type FlowMetrics,
    type BatchMetricsResponse,
} from '@/lib/rust-client/wachat-flow-events';
import { getErrorMessage } from '@/lib/utils';

/** Zero / never-triggered baseline — mirrors `FlowMetrics::empty()` on the Rust side. */
const EMPTY_METRICS: FlowMetrics = {
    triggersToday: 0,
    totalTriggers: 0,
    lastTriggeredAt: null,
};

export type FlowMetricsResult =
    | { success: true; metrics: FlowMetrics }
    | { success: false; error: string };

export type BatchFlowMetricsResult =
    | { success: true; metrics: BatchMetricsResponse }
    | { success: false; error: string };

/**
 * Real trigger metrics for a single flow (detail page "View Analytics").
 *
 * Returns the all-zero baseline when the flow has no recorded events — never a
 * fabricated value.
 */
export async function getFlowEventMetrics(flowId: string): Promise<FlowMetricsResult> {
    if (!flowId || !flowId.trim()) {
        return { success: false, error: 'A flow id is required.' };
    }
    try {
        const metrics = await wachatFlowEventsApi.flowMetrics(flowId.trim());
        revalidatePath(`/wachat/flow-builder/${flowId}`);
        return { success: true, metrics };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Real trigger metrics for every flow in a project, keyed by `flowId` hex
 * (list page "Metrics" column). Flows with no events are absent from the map;
 * callers should default them to {@link EMPTY_METRICS}.
 */
export async function getProjectFlowMetrics(projectId: string): Promise<BatchFlowMetricsResult> {
    if (!projectId || !projectId.trim()) {
        return { success: false, error: 'A project id is required.' };
    }
    try {
        const metrics = await wachatFlowEventsApi.batchMetrics(projectId.trim());
        revalidatePath('/wachat/flow-builder');
        return { success: true, metrics };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export { EMPTY_METRICS };
