/**
 * Client for `/v1/telegram/bot-profile`. Server-only.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/bot-profile';

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
}

export interface UpdateProfileBody {
    name?: string;
    description?: string;
    shortDescription?: string;
    miniAppUrl?: string;
    paymentProviderToken?: string;
}

export type MenuButton =
    | { type: 'default' }
    | { type: 'commands' }
    | { type: 'web_app'; text: string; url: string };

export const telegramBotProfileApi = {
    updateProfile: (botId: string, body: UpdateProfileBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    setMenuButton: (botId: string, menuButton: MenuButton) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/menu-button`, {
            method: 'POST',
            body: JSON.stringify({ menuButton }),
        }),
};

export type TelegramBotProfileApi = typeof telegramBotProfileApi;
