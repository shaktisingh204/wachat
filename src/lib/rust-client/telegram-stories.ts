import 'server-only';
import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/stories';

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    postId?: string;
}
export interface PostRow {
    _id: string;
    botId: string;
    channelId: string;
    message: any;
    status: string;
    scheduledAt: string;
    createdAt: string;
}
export interface ListResp {
    posts: PostRow[];
    error?: string;
}
export interface ScheduleBody {
    botId: string;
    channelId: string;
    message: any;
    scheduledAt: string;
}

export const telegramStoriesApi = {
    list: (botId: string) =>
        rustFetch<ListResp>(`${BASE}/?botId=${encodeURIComponent(botId)}`),
    schedule: (body: ScheduleBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    cancel: (postId: string, botId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(postId)}?botId=${encodeURIComponent(botId)}`,
            { method: 'DELETE' },
        ),
};
export type TelegramStoriesApi = typeof telegramStoriesApi;
