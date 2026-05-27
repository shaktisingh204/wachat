'use server';

/**
 * Server-action shims for the Rust `telegram-analytics` crate.
 *
 * Each body is a thin wrapper around `rustClient.telegramAnalytics.*`.
 * The client component on `/dashboard/telegram/analytics` calls these
 * actions and renders the structured response — failures bubble up as
 * a stringy `error` field on the payload (matching the Rust contract).
 */

import { rustClient } from '@/lib/rust-client';
import { getErrorMessage } from '@/lib/utils';
import type {
    OverviewResp,
    MessagesTimeseriesResp,
    BroadcastsTimeseriesResp,
    TopContactsResp,
    TopCommandsResp,
    FunnelResp,
    TelegramAnalyticsGranularity,
    TelegramAnalyticsCsvSection,
} from '@/lib/rust-client/telegram-analytics';


interface AnalyticsRangeInput {
    projectId: string;
    from?: string;
    to?: string;
    botId?: string;
}

export async function getTelegramAnalyticsOverview(
    input: AnalyticsRangeInput,
): Promise<OverviewResp & { error?: string }> {
    if (!input.projectId) {
        return {
            bots: 0,
            activeChats: 0,
            broadcasts: 0,
            error: 'projectId is required',
        };
    }
    try {
        return await rustClient.telegramAnalytics.overview(input);
    } catch (e) {
        return {
            bots: 0,
            activeChats: 0,
            broadcasts: 0,
            error: getErrorMessage(e),
        };
    }
}

export async function getTelegramMessagesTimeseries(
    input: AnalyticsRangeInput & { granularity?: TelegramAnalyticsGranularity },
): Promise<MessagesTimeseriesResp> {
    if (!input.projectId) {
        return {
            series: [],
            granularity: input.granularity ?? 'day',
            error: 'projectId is required',
        };
    }
    try {
        return await rustClient.telegramAnalytics.messagesTimeseries(input);
    } catch (e) {
        return {
            series: [],
            granularity: input.granularity ?? 'day',
            error: getErrorMessage(e),
        };
    }
}

export async function getTelegramBroadcastsTimeseries(
    input: AnalyticsRangeInput & { granularity?: TelegramAnalyticsGranularity },
): Promise<BroadcastsTimeseriesResp> {
    if (!input.projectId) {
        return {
            series: [],
            granularity: input.granularity ?? 'day',
            error: 'projectId is required',
        };
    }
    try {
        return await rustClient.telegramAnalytics.broadcastsTimeseries(input);
    } catch (e) {
        return {
            series: [],
            granularity: input.granularity ?? 'day',
            error: getErrorMessage(e),
        };
    }
}

export async function getTelegramTopContacts(
    input: AnalyticsRangeInput & { limit?: number },
): Promise<TopContactsResp> {
    if (!input.projectId) {
        return { contacts: [], error: 'projectId is required' };
    }
    try {
        return await rustClient.telegramAnalytics.topContacts(input);
    } catch (e) {
        return { contacts: [], error: getErrorMessage(e) };
    }
}

export async function getTelegramTopCommands(
    input: AnalyticsRangeInput & { limit?: number },
): Promise<TopCommandsResp> {
    if (!input.projectId) {
        return { commands: [], error: 'projectId is required' };
    }
    try {
        return await rustClient.telegramAnalytics.topCommands(input);
    } catch (e) {
        return { commands: [], error: getErrorMessage(e) };
    }
}

export async function getTelegramAnalyticsFunnel(
    input: AnalyticsRangeInput,
): Promise<FunnelResp> {
    if (!input.projectId) {
        return {
            contactedBot: 0,
            replied: 0,
            completedFlow: 0,
            paid: 0,
            error: 'projectId is required',
        };
    }
    try {
        return await rustClient.telegramAnalytics.funnel(input);
    } catch (e) {
        return {
            contactedBot: 0,
            replied: 0,
            completedFlow: 0,
            paid: 0,
            error: getErrorMessage(e),
        };
    }
}

/** Returns the CSV body as a string. Caller is responsible for
 *  triggering the browser download (e.g. via Blob + anchor). */
export async function exportTelegramAnalyticsCsv(
    input: AnalyticsRangeInput & { section?: TelegramAnalyticsCsvSection },
): Promise<{ csv?: string; error?: string }> {
    if (!input.projectId) {
        return { error: 'projectId is required' };
    }
    try {
        const csv = await rustClient.telegramAnalytics.exportCsv(input);
        return { csv };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
