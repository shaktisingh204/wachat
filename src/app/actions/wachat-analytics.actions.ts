'use server';

/**
 * Wachat analytics server actions — Wave D.
 *
 * Thin shims around the `rustClient.wachatAnalytics.*` Mongo-only roll-ups that
 * back the WaChat dashboard pages:
 *
 *   - getDashboardSummary  → `/wachat/overview`              (totals + 30-day series)
 *   - getAgentPerformance  → `/wachat/team-performance`      (per-agent leaderboard + CSAT)
 *   - getAgentHourly       → `/wachat/response-time-tracker` (per-agent hourly drill-in)
 *
 * Each returns a typed envelope: the successful payload OR `{ error }`. Callers
 * narrow on `'error' in res`. These are pure reads — `revalidatePath` is called
 * on the owning route so a manual refresh re-runs the server fetch.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { rustClient } from '@/lib/rust-client';
import { getErrorMessage } from '@/lib/utils';
import type {
    DashboardSummaryResult,
    AgentPerformanceResult,
    AgentHourlyResult,
} from '@/lib/rust-client/wachat-analytics';

export type DashboardSummaryEnvelope = DashboardSummaryResult | { error: string };
export type AgentPerformanceEnvelope = AgentPerformanceResult | { error: string };
export type AgentHourlyEnvelope = AgentHourlyResult | { error: string };

function isValidProjectId(projectId: string | null | undefined): projectId is string {
    return !!projectId && ObjectId.isValid(projectId);
}

/** Clamp an optional day window to the Rust-side bounds (1..=365). */
function clampDays(days: number | undefined): number | undefined {
    if (typeof days !== 'number' || !Number.isFinite(days)) return undefined;
    return Math.min(365, Math.max(1, Math.round(days)));
}

/**
 * Overview totals + dense 30-day daily series in one call. Replaces the native
 * `getDashboardStats` + `getDashboardChartData` Mongo reads.
 */
export async function getDashboardSummary(
    projectId: string,
): Promise<DashboardSummaryEnvelope> {
    if (!isValidProjectId(projectId)) {
        return { error: 'A valid project is required.' };
    }
    try {
        const r = await rustClient.wachatAnalytics.dashboardSummary(projectId);
        revalidatePath('/wachat/overview');
        return r;
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Per-agent performance leaderboard (real messages / response time / CSAT).
 * `days` defaults to 30 server-side; clamped to 1..=365 here for safety.
 */
export async function getAgentPerformance(
    projectId: string,
    days?: number,
): Promise<AgentPerformanceEnvelope> {
    if (!isValidProjectId(projectId)) {
        return { error: 'A valid project is required.' };
    }
    try {
        const r = await rustClient.wachatAnalytics.agentPerformance(
            projectId,
            clampDays(days),
        );
        revalidatePath('/wachat/team-performance');
        return r;
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Per-agent hourly response-time buckets (24-entry dense series) — the
 * response-time-tracker drill-in. `days` defaults to 30 server-side.
 */
export async function getAgentHourly(
    projectId: string,
    agentId: string,
    days?: number,
): Promise<AgentHourlyEnvelope> {
    if (!isValidProjectId(projectId)) {
        return { error: 'A valid project is required.' };
    }
    if (!agentId) {
        return { error: 'An agent is required.' };
    }
    try {
        const r = await rustClient.wachatAnalytics.agentHourly(
            projectId,
            agentId,
            clampDays(days),
        );
        revalidatePath('/wachat/response-time-tracker');
        return r;
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
