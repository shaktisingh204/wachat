/**
 * Client for the Telegram Bots router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/telegram/bots` by the
 * `telegram-bots` Rust crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ success, error?, message?, … }`
 * envelope shape the legacy TS server actions in
 * `src/app/actions/telegram.actions.ts` returned, so the calling
 * page/component code does not need to change beyond the import.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/bots';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    botId?: string;
}

export interface WebhookInfoView {
    url?: string;
    pendingUpdateCount?: number;
    lastErrorMessage?: string;
    lastErrorDate?: string;
    maxConnections?: number;
    ipAddress?: string;
    allowedUpdates?: string[];
    hasCustomCertificate?: boolean;
}

export type BotStatus = 'active' | 'disconnected' | 'error';

export interface BotRow {
    _id: string;
    projectId: string;
    userId: string;
    /** Telegram numeric bot id (the digits before the `:` in the token). */
    botId: number;
    username: string;
    name: string;
    isActive: boolean;
    webhookUrl?: string;
    webhookRegisteredAt?: string;
    webhookInfo?: WebhookInfoView;
    canJoinGroups?: boolean;
    canReadAllGroupMessages?: boolean;
    supportsInlineQueries?: boolean;
    hasMainWebApp?: boolean;
    status: BotStatus;
    lastSeenAt?: string;
    latencyMs?: number;
    createdAt: string;
    updatedAt: string;
}

export interface ListBotsResp {
    bots: BotRow[];
    total: number;
    page: number;
    pageSize: number;
    error?: string;
}

export interface ListBotsParams {
    projectId: string;
    status?: BotStatus;
    q?: string;
    page?: number;
    pageSize?: number;
}

export interface GetBotResp {
    bot?: BotRow;
    error?: string;
}

export interface ConnectBotBody {
    projectId: string;
    token: string;
}

export interface BotInfoResp {
    bot?: BotRow;
    error?: string;
}

export interface BotCommand {
    command: string;
    description: string;
}

export interface CommandsResp {
    commands: BotCommand[];
    error?: string;
}

export interface MenuButton {
    type: 'default' | 'commands' | 'web_app';
    text?: string;
    web_app?: { url: string };
}

export interface MenuButtonResp {
    menuButton?: MenuButton | Record<string, unknown>;
    error?: string;
}

export interface AdminRightsDto {
    isAnonymous: boolean;
    canManageChat: boolean;
    canDeleteMessages: boolean;
    canManageVideoChats: boolean;
    canRestrictMembers: boolean;
    canPromoteMembers: boolean;
    canChangeInfo: boolean;
    canInviteUsers: boolean;
    canPostMessages?: boolean;
    canEditMessages?: boolean;
    canPinMessages?: boolean;
    canManageTopics?: boolean;
    canPostStories?: boolean;
    canEditStories?: boolean;
    canDeleteStories?: boolean;
}

export interface AdminRightsResp {
    rights?: AdminRightsDto;
    forChannels: boolean;
    error?: string;
}

export interface HealthResp {
    success: boolean;
    error?: string;
    latencyMs?: number;
    lastSeenAt?: string;
}

export interface BulkDisconnectResp {
    success: boolean;
    disconnected: number;
    failed: number;
    error?: string;
}

function qs(params: Record<string, string | number | undefined | null>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const telegramBotsApi = {
    /** `GET /v1/telegram/bots?projectId=…` — listTelegramBots */
    list: (projectIdOrParams: string | ListBotsParams) => {
        const p: ListBotsParams =
            typeof projectIdOrParams === 'string'
                ? { projectId: projectIdOrParams }
                : projectIdOrParams;
        const query = qs({
            projectId: p.projectId,
            status: p.status,
            q: p.q,
            page: p.page,
            pageSize: p.pageSize,
        });
        return rustFetch<ListBotsResp>(`${BASE}/${query}`);
    },

    /** `GET /v1/telegram/bots/{botId}` — getTelegramBot */
    get: (botId: string) =>
        rustFetch<GetBotResp>(`${BASE}/${encodeURIComponent(botId)}`),

    /** `GET /v1/telegram/bots/{botId}/info` — refresh via getMe */
    info: (botId: string) =>
        rustFetch<BotInfoResp>(`${BASE}/${encodeURIComponent(botId)}/info`),

    /** `POST /v1/telegram/bots` — connectTelegramBot */
    connect: (body: ConnectBotBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `DELETE /v1/telegram/bots/{botId}` — disconnectTelegramBot */
    disconnect: (botId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}`, {
            method: 'DELETE',
        }),

    /** `POST /v1/telegram/bots/bulk-disconnect` */
    bulkDisconnect: (projectId: string, ids: string[]) =>
        rustFetch<BulkDisconnectResp>(`${BASE}/bulk-disconnect`, {
            method: 'POST',
            body: JSON.stringify({ projectId, ids }),
        }),

    /** `POST /v1/telegram/bots/{botId}/webhook/refresh` — refreshTelegramWebhookInfo */
    refreshWebhookInfo: (botId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/webhook/refresh`, {
            method: 'POST',
        }),

    /** `POST /v1/telegram/bots/{botId}/webhook/rotate` — rotateTelegramWebhookSecret */
    rotateWebhookSecret: (botId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/webhook/rotate`, {
            method: 'POST',
        }),

    /** `POST /v1/telegram/bots/{botId}/health` — synthetic getMe ping */
    health: (botId: string) =>
        rustFetch<HealthResp>(`${BASE}/${encodeURIComponent(botId)}/health`, {
            method: 'POST',
        }),

    // -- commands ---------------------------------------------------------

    getCommands: (botId: string, languageCode?: string) =>
        rustFetch<CommandsResp>(
            `${BASE}/${encodeURIComponent(botId)}/commands${qs({ languageCode })}`,
        ),

    setCommands: (
        botId: string,
        body: {
            projectId: string;
            commands: BotCommand[];
            scope?: Record<string, unknown>;
            languageCode?: string;
        },
    ) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/commands`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteCommands: (botId: string, projectId: string, languageCode?: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(botId)}/commands${qs({ projectId, languageCode })}`,
            { method: 'DELETE' },
        ),

    // -- profile ---------------------------------------------------------

    setName: (
        botId: string,
        body: { projectId: string; name: string; languageCode?: string },
    ) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/name`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    setDescription: (
        botId: string,
        body: { projectId: string; description: string; languageCode?: string },
    ) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/description`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    setShortDescription: (
        botId: string,
        body: { projectId: string; shortDescription: string; languageCode?: string },
    ) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/short-description`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // -- menu button -----------------------------------------------------

    getMenuButton: (botId: string) =>
        rustFetch<MenuButtonResp>(`${BASE}/${encodeURIComponent(botId)}/menu-button`),

    setMenuButton: (
        botId: string,
        body: { projectId: string; menuButton: MenuButton | Record<string, unknown> },
    ) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(botId)}/menu-button`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // -- default admin rights --------------------------------------------

    getAdminRights: (botId: string, forChannels: boolean) =>
        rustFetch<AdminRightsResp>(
            `${BASE}/${encodeURIComponent(botId)}/default-admin-rights${qs({
                forChannels: forChannels ? 'true' : 'false',
            })}`,
        ),

    setAdminRights: (
        botId: string,
        body: { projectId: string; forChannels: boolean; rights?: AdminRightsDto },
    ) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(botId)}/default-admin-rights`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `GET /v1/telegram/bots/export?projectId=…` — CSV (raw text) */
    exportCsv: async (projectId: string): Promise<string> => {
        const path = `${BASE}/export${qs({ projectId })}`;
        // rustFetch returns parsed JSON — use raw fetch via a thin wrapper.
        const { rawRustFetch } = await import('./fetcher-raw');
        return rawRustFetch(path);
    },
};

export type TelegramBotsApi = typeof telegramBotsApi;
