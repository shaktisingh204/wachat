import 'server-only';
import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/flows';

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    replyId?: string;
}
export interface ReplyRow {
    _id: string;
    projectId: string;
    shortcut: string;
    text: string;
    parseMode?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ListResp {
    replies: ReplyRow[];
    error?: string;
}
export interface UpsertBody {
    projectId: string;
    replyId?: string;
    shortcut: string;
    text: string;
    parseMode?: string;
}

export const telegramFlowsApi = {
    list: (projectId: string) =>
        rustFetch<ListResp>(`${BASE}/?projectId=${encodeURIComponent(projectId)}`),
    upsert: (body: UpsertBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    delete: (replyId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(replyId)}?projectId=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
        ),
};
export type TelegramFlowsApi = typeof telegramFlowsApi;
