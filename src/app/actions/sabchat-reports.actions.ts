'use server';

/**
 * SabChat Reports server actions — thin pass-through to the Rust BFF
 * (`/v1/sabchat/reports/*`). Every action wraps `rustClient.sabchatReports`
 * and either returns the data or `{ error }` so server components and
 * client islands can degrade gracefully when the Rust crate is unavailable.
 */

import { rustClient } from '@/lib/rust-client';
import { getErrorMessage } from '@/lib/utils';
import type {
    AgentRow,
    ChannelRow,
    CsatStats,
    InboxRow,
    LiveReport,
    ResponseTimes,
    VolumeReport,
} from '@/lib/rust-client/sabchat-reports';

type WindowQuery = { from?: string; to?: string };

export async function getLive(): Promise<LiveReport | { error: string }> {
    try {
        return await rustClient.sabchatReports.live();
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getVolume(
    q: WindowQuery & { groupBy?: 'hour' | 'day' | 'week' } = {},
): Promise<VolumeReport | { error: string }> {
    try {
        return await rustClient.sabchatReports.volume(q);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getResponseTimes(
    q: WindowQuery = {},
): Promise<ResponseTimes | { error: string }> {
    try {
        return await rustClient.sabchatReports.responseTimes(q);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getByAgent(
    q: WindowQuery = {},
): Promise<AgentRow[] | { error: string }> {
    try {
        return await rustClient.sabchatReports.byAgent(q);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getByInbox(
    q: WindowQuery = {},
): Promise<InboxRow[] | { error: string }> {
    try {
        return await rustClient.sabchatReports.byInbox(q);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getByChannel(
    q: WindowQuery = {},
): Promise<ChannelRow[] | { error: string }> {
    try {
        return await rustClient.sabchatReports.byChannel(q);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getCsat(
    q: WindowQuery = {},
): Promise<CsatStats | { error: string }> {
    try {
        return await rustClient.sabchatReports.csat(q);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
