/**
 * Client for `/v1/telegram/commands`. Server-only.
 *
 * Wraps the telegram-commands crate: command registry, scope-aware
 * definitions, invocation log, BotAPI push/pull, analytics, import,
 * export.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { rustFetch } from './fetcher';
import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getDecodedSession } from '@/lib/auth';

const BASE = '/v1/telegram/commands';

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    commandId?: string;
}

export type CommandScopeKind =
    | 'default'
    | 'all_private_chats'
    | 'all_group_chats'
    | 'all_chat_administrators'
    | 'chat'
    | 'chat_administrators'
    | 'chat_member';

export interface CommandScope {
    kind: CommandScopeKind;
    chatId?: string;
    userId?: string;
}

export type CommandHandlerKind =
    | 'reply_text'
    | 'reply_media'
    | 'run_flow'
    | 'http_call'
    | 'noop';

export interface CommandHandler {
    kind: CommandHandlerKind;
    payload?: Record<string, unknown> | null;
}

export interface CommandRow {
    _id: string;
    projectId: string;
    botId?: string | null;
    command: string;
    description: string;
    scope: CommandScope;
    languageCode?: string;
    handler: CommandHandler;
    hidden: boolean;
    runCount: number;
    lastRunAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ListQuery {
    projectId: string;
    botId?: string;
    scope?: string;
    languageCode?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface ListResp {
    commands: CommandRow[];
    total: number;
    hasMore: boolean;
    page: number;
    pageSize: number;
    error?: string;
}

export interface CreateBody {
    projectId: string;
    botId?: string | null;
    command: string;
    description?: string;
    scope?: CommandScope;
    languageCode?: string;
    handler?: CommandHandler;
    hidden?: boolean;
}

export interface UpdateBody {
    projectId: string;
    botId?: string | null;
    clearBot?: boolean;
    command?: string;
    description?: string;
    scope?: CommandScope;
    languageCode?: string;
    clearLanguageCode?: boolean;
    handler?: CommandHandler;
    hidden?: boolean;
}

export interface DetailResp {
    command?: CommandRow;
    error?: string;
}

export interface PushBody {
    projectId: string;
    botId: string;
    scope?: CommandScope;
    languageCode?: string;
}

export interface PushResp {
    success: boolean;
    pushed: number;
    error?: string;
    message?: string;
}

export interface BotCommandView {
    command: string;
    description: string;
}

export interface PullResp {
    success: boolean;
    live: BotCommandView[];
    local: BotCommandView[];
    error?: string;
}

export interface MatchBody {
    projectId: string;
    botId: string;
    command: string;
    chatId?: string;
    userId?: string;
    languageCode?: string;
}

export interface MatchResp {
    matched: boolean;
    command?: CommandRow;
    error?: string;
}

export interface LogBody {
    projectId: string;
    botId: string;
    commandId: string;
    chatId?: string;
    userId?: string;
    success: boolean;
    errorMessage?: string;
}

export interface RunRow {
    _id: string;
    commandId: string;
    botId: string;
    chatId?: string;
    userId?: string;
    success: boolean;
    errorMessage?: string;
    createdAt: string;
}

export interface RunsResp {
    runs: RunRow[];
    nextCursor?: string;
    error?: string;
}

export interface AnalyticsQuery {
    projectId: string;
    from?: string;
    to?: string;
    botId?: string;
}

export interface PerCommandStat {
    commandId: string;
    command: string;
    runs: number;
    success: number;
    failures: number;
    successRate: number;
}

export interface AnalyticsByDayPoint {
    date: string;
    runs: number;
    success: number;
    failures: number;
}

export interface AnalyticsResp {
    totalRuns: number;
    totalSuccess: number;
    totalFailures: number;
    successRate: number;
    perCommand: PerCommandStat[];
    byDay: AnalyticsByDayPoint[];
    error?: string;
}

export interface ImportBody {
    projectId: string;
    commands: CreateBody[];
}

export interface ImportResp {
    success: boolean;
    inserted: number;
    skipped: number;
    errors: string[];
    error?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

export const telegramCommandsApi = {
    list: (q: ListQuery) =>
        rustFetch<ListResp>(`${BASE}/${buildQuery(q as unknown as Record<string, string | number | undefined>)}`),
    create: (body: CreateBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    detail: (id: string, projectId: string) =>
        rustFetch<DetailResp>(
            `${BASE}/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
        ),
    update: (id: string, body: UpdateBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    delete: (id: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
        ),
    duplicate: (id: string, projectId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(id)}/duplicate`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        }),
    push: (body: PushBody) =>
        rustFetch<PushResp>(`${BASE}/push`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    pull: (body: PushBody) =>
        rustFetch<PullResp>(`${BASE}/pull`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    match: (body: MatchBody) =>
        rustFetch<MatchResp>(`${BASE}/match`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    log: (body: LogBody) =>
        rustFetch<AckResult>(`${BASE}/log`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    runs: (id: string, projectId: string, opts?: { cursor?: string; limit?: number }) =>
        rustFetch<RunsResp>(
            `${BASE}/${encodeURIComponent(id)}/runs${buildQuery({
                projectId,
                cursor: opts?.cursor,
                limit: opts?.limit,
            })}`,
        ),
    analytics: (q: AnalyticsQuery) =>
        rustFetch<AnalyticsResp>(
            `${BASE}/analytics${buildQuery(q as unknown as Record<string, string | number | undefined>)}`,
        ),
    import: (body: ImportBody) =>
        rustFetch<ImportResp>(`${BASE}/import`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    exportCsv: async (projectId: string): Promise<string> => {
        const cookieStore = await cookies();
        const cookie = cookieStore.get('session')?.value;
        const decoded = cookie ? await getDecodedSession(cookie) : null;
        const userId = decoded
            ? ((decoded as { userId?: string; sub?: string; _id?: string }).userId
                || (decoded as { sub?: string }).sub
                || (decoded as { _id?: string })._id)
            : null;
        if (!userId) return '';
        const token = await issueRustJwt({
            userId: String(userId),
            tenantId: String(userId),
            roles: [],
        });
        const base = process.env.RUST_API_URL || 'http://localhost:8080';
        const res = await fetch(
            `${base}${BASE}/export?projectId=${encodeURIComponent(projectId)}`,
            {
                headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
                cache: 'no-store',
            },
        );
        if (!res.ok) return '';
        return await res.text();
    },
};

export type TelegramCommandsApi = typeof telegramCommandsApi;
