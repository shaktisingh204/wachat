/**
 * Client for `/v1/telegram/auto-reply`. Server-only.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/auto-reply';

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    ruleId?: string;
}

export interface RuleRow {
    _id: string;
    botId: string;
    name: string;
    trigger: any;
    pattern?: string;
    caseSensitive: boolean;
    matchMode: string;
    response: any;
    isActive: boolean;
    priority: number;
    insideBusinessHoursOnly: boolean;
    hits: number;
    createdAt: string;
    updatedAt: string;
}

export interface ListResp {
    rules: RuleRow[];
    error?: string;
}

export interface UpsertBody {
    botId: string;
    ruleId?: string;
    name: string;
    trigger: any;
    pattern?: string;
    caseSensitive?: boolean;
    matchMode?: string;
    response: any;
    isActive?: boolean;
    priority?: number;
    insideBusinessHoursOnly?: boolean;
}

export const telegramAutoReplyApi = {
    list: (botId: string) =>
        rustFetch<ListResp>(`${BASE}/?botId=${encodeURIComponent(botId)}`),
    upsert: (body: UpsertBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    deleteRule: (ruleId: string, botId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(ruleId)}?botId=${encodeURIComponent(botId)}`,
            { method: 'DELETE' },
        ),
    toggle: (ruleId: string, botId: string, isActive: boolean) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(ruleId)}/toggle`,
            {
                method: 'POST',
                body: JSON.stringify({ botId, isActive }),
            },
        ),
};

export type TelegramAutoReplyApi = typeof telegramAutoReplyApi;
