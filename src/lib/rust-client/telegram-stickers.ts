import 'server-only';
import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/stickers';

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    setId?: string;
}
export interface SetRow {
    _id: string;
    botId: string;
    name: string;
    title: string;
    stickerType: string;
    stickerCount: number;
    createdAt: string;
}
export interface ListResp {
    sets: SetRow[];
    error?: string;
}
export interface CreateBody {
    botId: string;
    name: string;
    title: string;
    stickerType?: string;
}

export const telegramStickersApi = {
    list: (botId: string) =>
        rustFetch<ListResp>(`${BASE}/?botId=${encodeURIComponent(botId)}`),
    create: (body: CreateBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    delete: (setId: string, botId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(setId)}?botId=${encodeURIComponent(botId)}`,
            { method: 'DELETE' },
        ),
};
export type TelegramStickersApi = typeof telegramStickersApi;
