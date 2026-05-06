/**
 * Client for `/v1/telegram/channels`. Server-only.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/channels';

export interface ChannelRow {
    _id: string;
    botId: string;
    chatId: string;
    title?: string;
    username?: string;
    memberCount: number;
    createdAt: string;
}

export interface ListResp {
    channels: ChannelRow[];
    error?: string;
}

export const telegramChannelsApi = {
    list: (botId: string) =>
        rustFetch<ListResp>(`${BASE}/?botId=${encodeURIComponent(botId)}`),
};

export type TelegramChannelsApi = typeof telegramChannelsApi;
