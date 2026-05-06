/**
 * Client for `/v1/telegram/broadcasts`. Server-only.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/broadcasts';

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    broadcastId?: string;
}

export interface BroadcastRow {
    _id: string;
    botId: string;
    name: string;
    status: string;
    audience: any;
    message: any;
    stats: { total?: number; sent?: number; failed?: number } | any;
    scheduledAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ListResp {
    broadcasts: BroadcastRow[];
    error?: string;
}

export interface CreateBody {
    botId: string;
    name: string;
    audience: any;
    message: any;
    scheduledAt?: string;
}

export const telegramBroadcastsApi = {
    list: (botId: string) =>
        rustFetch<ListResp>(`${BASE}/?botId=${encodeURIComponent(botId)}`),
    create: (body: CreateBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    sendNow: (broadcastId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(broadcastId)}/send`, {
            method: 'POST',
        }),
};

export type TelegramBroadcastsApi = typeof telegramBroadcastsApi;
