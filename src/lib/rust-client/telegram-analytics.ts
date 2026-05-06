import 'server-only';
import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/analytics';

export interface OverviewResp {
    bots: number;
    activeChats: number;
    broadcasts: number;
    error?: string;
}

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

export const telegramAnalyticsApi = {
    overview: (projectId: string) =>
        rustFetch<OverviewResp>(`${BASE}/overview?projectId=${encodeURIComponent(projectId)}`),
    bot: (botId: string, days?: number) =>
        rustFetch<BotAnalyticsResp>(
            `${BASE}/bots/${encodeURIComponent(botId)}${days ? `?days=${days}` : ''}`,
        ),
};

export type TelegramAnalyticsApi = typeof telegramAnalyticsApi;
