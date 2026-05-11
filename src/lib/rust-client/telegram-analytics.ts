/**
 * Typed client for the Rust `telegram-analytics` crate (mounted at
 * `/v1/telegram/analytics`).
 *
 * The Rust handlers swallow most failures into a stringy `error` field
 * rather than throwing — this client mirrors that contract: the page
 * inspects `error` and renders a friendly empty state instead of
 * trying to recover from a thrown exception.
 *
 * All time-range params accept ISO-8601 strings (`Date.toISOString()`).
 */
import 'server-only';
import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/analytics';

// -------------------------------------------------------------------------
//  Shared types
// -------------------------------------------------------------------------

export type TelegramAnalyticsGranularity = 'hour' | 'day' | 'week';

export interface TelegramAnalyticsTimeBucket {
    ts: string;
    in: number;
    out: number;
}

export interface TelegramAnalyticsBroadcastBucket {
    ts: string;
    sent: number;
    failed: number;
}

export interface TelegramAnalyticsKeyCount {
    key: string;
    label: string;
    count: number;
}

export interface TelegramAnalyticsContactSummary {
    chatId: string;
    title: string;
    messages: number;
}

// -------------------------------------------------------------------------
//  Overview
// -------------------------------------------------------------------------

export interface TelegramAnalyticsBotsBreakdown {
    total: number;
    active: number;
    errored: number;
}

export interface TelegramAnalyticsMessagesBreakdown {
    incoming: number;
    outgoing: number;
    byDay: TelegramAnalyticsTimeBucket[];
}

export interface TelegramAnalyticsBroadcastsBreakdown {
    sent: number;
    successRate: number;
    topErrorCodes: TelegramAnalyticsKeyCount[];
}

export interface TelegramAnalyticsPaymentsBreakdown {
    count: number;
    sumCents: number;
    currencyBreakdown: TelegramAnalyticsKeyCount[];
}

export interface TelegramAnalyticsCommandsBreakdown {
    top: TelegramAnalyticsKeyCount[];
    total: number;
}

export interface TelegramAnalyticsAutoReplyBreakdown {
    fired: number;
    top: TelegramAnalyticsKeyCount[];
}

export interface TelegramAnalyticsContactsBreakdown {
    total: number;
    newThisPeriod: number;
    lost: number;
}

export interface TelegramAnalyticsChatsBreakdown {
    activeThisPeriod: number;
    newThisPeriod: number;
}

/** Response from `GET /overview`. The legacy `bots / activeChats /
 * broadcasts` scalars are preserved at the top level so existing
 * dashboards keep working; the rich breakdowns live in their
 * `*Breakdown` fields. */
export interface OverviewResp {
    // legacy scalars
    bots: number;
    activeChats: number;
    broadcasts: number;

    botsBreakdown?: TelegramAnalyticsBotsBreakdown;
    messagesBreakdown?: TelegramAnalyticsMessagesBreakdown;
    broadcastsBreakdown?: TelegramAnalyticsBroadcastsBreakdown;
    paymentsBreakdown?: TelegramAnalyticsPaymentsBreakdown;
    commandsBreakdown?: TelegramAnalyticsCommandsBreakdown;
    autoReplyBreakdown?: TelegramAnalyticsAutoReplyBreakdown;
    contactsBreakdown?: TelegramAnalyticsContactsBreakdown;
    chatsBreakdown?: TelegramAnalyticsChatsBreakdown;

    error?: string;
}

// -------------------------------------------------------------------------
//  Per-bot (legacy)
// -------------------------------------------------------------------------

export interface Totals {
    messages: number;
    inbound: number;
    outbound: number;
    chats: number;
}
export interface TimeseriesPoint {
    date: string;
    inbound: number;
    outbound: number;
}
export interface TopChat {
    chatId: string;
    title: string;
    messages: number;
}
export interface BotAnalyticsResp {
    totals: Totals;
    timeseries: TimeseriesPoint[];
    topChats: TopChat[];
    error?: string;
}

// -------------------------------------------------------------------------
//  Timeseries / leaderboards / funnel responses
// -------------------------------------------------------------------------

export interface MessagesTimeseriesResp {
    series: TelegramAnalyticsTimeBucket[];
    granularity: TelegramAnalyticsGranularity;
    error?: string;
}

export interface BroadcastsTimeseriesResp {
    series: TelegramAnalyticsBroadcastBucket[];
    granularity: TelegramAnalyticsGranularity;
    error?: string;
}

export interface TopContactsResp {
    contacts: TelegramAnalyticsContactSummary[];
    error?: string;
}

export interface TopCommandsResp {
    commands: TelegramAnalyticsKeyCount[];
    error?: string;
}

export interface FunnelResp {
    contactedBot: number;
    replied: number;
    completedFlow: number;
    paid: number;
    error?: string;
}

// -------------------------------------------------------------------------
//  Common query options
// -------------------------------------------------------------------------

export interface TelegramAnalyticsRange {
    projectId: string;
    from?: string;
    to?: string;
    botId?: string;
}

export interface TelegramAnalyticsTimeseriesOpts extends TelegramAnalyticsRange {
    granularity?: TelegramAnalyticsGranularity;
}

export interface TelegramAnalyticsTopOpts extends TelegramAnalyticsRange {
    limit?: number;
}

export type TelegramAnalyticsCsvSection =
    | 'overview'
    | 'messages'
    | 'broadcasts'
    | 'commands';

export interface TelegramAnalyticsExportOpts extends TelegramAnalyticsRange {
    section?: TelegramAnalyticsCsvSection;
}

// -------------------------------------------------------------------------
//  Query-string builder
// -------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

function rangeParams(r: TelegramAnalyticsRange): Record<string, string | undefined> {
    return {
        projectId: r.projectId,
        from: r.from,
        to: r.to,
        botId: r.botId,
    };
}

// -------------------------------------------------------------------------
//  Public API
// -------------------------------------------------------------------------

export const telegramAnalyticsApi = {
    /** Workspace KPIs scoped to a project + optional bot + date range. */
    overview: (opts: TelegramAnalyticsRange) =>
        rustFetch<OverviewResp>(`${BASE}/overview${qs(rangeParams(opts))}`),

    /** Legacy per-bot endpoint — last N days only. */
    bot: (botId: string, days?: number) =>
        rustFetch<BotAnalyticsResp>(
            `${BASE}/bots/${encodeURIComponent(botId)}${days ? `?days=${days}` : ''}`,
        ),

    /** Messages timeseries bucketed by hour / day / week. */
    messagesTimeseries: (opts: TelegramAnalyticsTimeseriesOpts) =>
        rustFetch<MessagesTimeseriesResp>(
            `${BASE}/messages-timeseries${qs({
                ...rangeParams(opts),
                granularity: opts.granularity,
            })}`,
        ),

    /** Broadcast `sent / failed` timeseries. */
    broadcastsTimeseries: (opts: TelegramAnalyticsTimeseriesOpts) =>
        rustFetch<BroadcastsTimeseriesResp>(
            `${BASE}/broadcasts-timeseries${qs({
                ...rangeParams(opts),
                granularity: opts.granularity,
            })}`,
        ),

    /** Top contacts by message volume. */
    topContacts: (opts: TelegramAnalyticsTopOpts) =>
        rustFetch<TopContactsResp>(
            `${BASE}/top-contacts${qs({
                ...rangeParams(opts),
                limit: opts.limit,
            })}`,
        ),

    /** Top commands declared (best-effort until an invocation log exists). */
    topCommands: (opts: TelegramAnalyticsTopOpts) =>
        rustFetch<TopCommandsResp>(
            `${BASE}/top-commands${qs({
                ...rangeParams(opts),
                limit: opts.limit,
            })}`,
        ),

    /** Conversion funnel: contactedBot → replied → completedFlow → paid. */
    funnel: (opts: TelegramAnalyticsRange) =>
        rustFetch<FunnelResp>(`${BASE}/funnel${qs(rangeParams(opts))}`),

    /** Resolve the CSV download URL (relative to the Rust API host).
     *  The page proxies through a server action so the JWT is attached. */
    exportCsvPath: (opts: TelegramAnalyticsExportOpts): string =>
        `${BASE}/export.csv${qs({
            ...rangeParams(opts),
            section: opts.section,
        })}`,

    /** Fetch the CSV body as a string (the JWT is attached by `rustFetch`).
     *  We bypass `rustFetch`'s JSON parser by reading `text()` directly. */
    exportCsv: async (opts: TelegramAnalyticsExportOpts): Promise<string> => {
        // rustFetch is JSON-only, so we manually compose the request.
        const { rustFetch: _ } = await import('./fetcher');
        const { issueRustJwt } = await import('@/lib/jwt-for-rust');
        const { cookies } = await import('next/headers');
        const { getDecodedSession } = await import('@/lib/auth');
        const cookieStore = await cookies();
        const cookie = cookieStore.get('session')?.value;
        const decoded = cookie ? await getDecodedSession(cookie) : null;
        const userId = decoded
            ? ((decoded as any).userId ||
              (decoded as any).sub ||
              (decoded as any)._id)
            : null;
        if (!userId) throw new Error('No active session');
        const token = await issueRustJwt({
            userId: String(userId),
            tenantId: String(userId),
            roles: [],
        });
        const base = process.env.RUST_API_URL || 'http://localhost:8080';
        const res = await fetch(
            `${base}${telegramAnalyticsApi.exportCsvPath(opts)}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'text/csv',
                },
                cache: 'no-store',
            },
        );
        if (!res.ok) {
            throw new Error(`CSV export failed: ${res.status}`);
        }
        return await res.text();
    },
};

export type TelegramAnalyticsApi = typeof telegramAnalyticsApi;
