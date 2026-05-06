import 'server-only';
import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/mini-apps';

export interface MiniAppEntry {
    botId: string;
    username: string;
    name: string;
    miniAppUrl: string;
}
export interface ListResp {
    miniApps: MiniAppEntry[];
    error?: string;
}

export const telegramMiniAppsApi = {
    list: (projectId: string) =>
        rustFetch<ListResp>(`${BASE}/?projectId=${encodeURIComponent(projectId)}`),
};
export type TelegramMiniAppsApi = typeof telegramMiniAppsApi;
