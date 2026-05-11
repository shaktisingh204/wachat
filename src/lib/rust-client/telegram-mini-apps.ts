import 'server-only';
import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/mini-apps';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

export interface ThemeParams {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
}

export interface MiniAppRow {
    _id: string;
    projectId: string;
    botId: string;
    botUsername?: string;
    name: string;
    slug: string;
    webAppUrl: string;
    shortName?: string;
    description?: string;
    photoUrl?: string;
    themeParams: ThemeParams;
    defaultButtonLabel: string;
    allowedDomains: string[];
    status: 'active' | 'disabled' | string;
    createdAt: string;
    updatedAt: string;
}

/** @deprecated retained for back-compat with the old read-only view. */
export interface MiniAppEntry {
    botId: string;
    username: string;
    name: string;
    miniAppUrl: string;
}

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    appId?: string;
}

export interface ListQuery {
    projectId: string;
    botId?: string;
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
}

export interface ListResp {
    miniApps: MiniAppRow[];
    total: number;
    page: number;
    pageSize: number;
    error?: string;
    /** Present only on the legacy read-only response shape. */
    [extra: string]: unknown;
}

export interface DetailResp {
    app?: MiniAppRow;
    error?: string;
}

export interface UpsertBody {
    projectId: string;
    botId: string;
    name: string;
    slug: string;
    webAppUrl: string;
    shortName?: string;
    description?: string;
    photoUrl?: string;
    themeParams?: ThemeParams;
    defaultButtonLabel?: string;
    allowedDomains?: string[];
    status?: 'active' | 'disabled' | string;
}

export interface SendBody {
    projectId: string;
    chatId: string;
    label?: string;
    replyMarkup?: 'inline' | 'keyboard' | 'web_app_button';
    text?: string;
}

export interface SendResp {
    success: boolean;
    error?: string;
    messageId?: number;
}

export interface SetMenuButtonBody {
    projectId: string;
    botId?: string;
    chatId?: number;
}

export interface ValidateInitDataBody {
    projectId: string;
    appId: string;
    initData: string;
}

export interface ValidateInitDataResp {
    success: boolean;
    error?: string;
    user?: {
        id?: number;
        first_name?: string;
        last_name?: string;
        username?: string;
        language_code?: string;
        photo_url?: string;
        [k: string]: unknown;
    };
    authDate?: number;
    queryId?: string;
}

export interface SessionRow {
    _id: string;
    chatId?: number;
    userId?: number;
    username?: string;
    firstName?: string;
    validatedAt: string;
    country?: string;
    device?: string;
}

export interface SessionsResp {
    sessions: SessionRow[];
    nextCursor?: string;
    error?: string;
}

export interface AnalyticsQuery {
    projectId: string;
    from?: string;
    to?: string;
}

export interface AnalyticsDayPoint {
    date: string;
    opens: number;
    uniqueUsers: number;
}

export interface AnalyticsResp {
    opens: number;
    uniqueUsers: number;
    conversion: number;
    byDay: AnalyticsDayPoint[];
    error?: string;
}

// ---------------------------------------------------------------------------
//  Client
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

export const telegramMiniAppsApi = {
    /**
     * List mini-app records for a project. Backwards-compatible — the
     * caller used to pass a bare `projectId` string. We still accept
     * that for the legacy read-only callsite, then promote it into a
     * full {@link ListQuery}.
     */
    list: (q: string | ListQuery) => {
        const query: ListQuery =
            typeof q === 'string' ? { projectId: q } : q;
        return rustFetch<ListResp>(`${BASE}/${qs({
            projectId: query.projectId,
            botId: query.botId,
            search: query.search,
            status: query.status,
            page: query.page,
            pageSize: query.pageSize,
        })}`);
    },

    detail: (appId: string, projectId: string) =>
        rustFetch<DetailResp>(
            `${BASE}/${encodeURIComponent(appId)}${qs({ projectId })}`,
        ),

    create: (body: UpsertBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    update: (appId: string, body: UpsertBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(appId)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),

    delete: (appId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(appId)}${qs({ projectId })}`,
            { method: 'DELETE' },
        ),

    send: (appId: string, body: SendBody) =>
        rustFetch<SendResp>(
            `${BASE}/${encodeURIComponent(appId)}/send`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    setMenuButton: (appId: string, body: SetMenuButtonBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(appId)}/set-menu-button`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    validateInitData: (body: ValidateInitDataBody) =>
        rustFetch<ValidateInitDataResp>(
            `${BASE}/validate-init-data`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    sessions: (
        appId: string,
        projectId: string,
        opts?: { cursor?: string; limit?: number },
    ) =>
        rustFetch<SessionsResp>(
            `${BASE}/${encodeURIComponent(appId)}/sessions${qs({
                projectId,
                cursor: opts?.cursor,
                limit: opts?.limit,
            })}`,
        ),

    analytics: (appId: string, q: AnalyticsQuery) =>
        rustFetch<AnalyticsResp>(
            `${BASE}/${encodeURIComponent(appId)}/analytics${qs({
                projectId: q.projectId,
                from: q.from,
                to: q.to,
            })}`,
        ),
};

export type TelegramMiniAppsApi = typeof telegramMiniAppsApi;
