/**
 * Client for `/v1/telegram/commands`. Server-only.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/commands';

export interface BotCommand {
    command: string;
    description: string;
}

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
}

export interface CommandsResp {
    commands: BotCommand[];
    error?: string;
}

export const telegramCommandsApi = {
    get: (botId: string) =>
        rustFetch<CommandsResp>(`${BASE}/${encodeURIComponent(botId)}`),
    set: (botId: string, commands: BotCommand[]) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}`, {
            method: 'POST',
            body: JSON.stringify({ commands }),
        }),
};

export type TelegramCommandsApi = typeof telegramCommandsApi;
