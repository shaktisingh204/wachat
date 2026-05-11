import 'server-only';
import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/settings';

// ---------------------------------------------------------------------------
// Settings tree — mirrors `telegram_settings::ProjectSettings`
// ---------------------------------------------------------------------------

export interface RateLimitDefaults {
    perChatPerSecond: number;
    perBotPerSecond: number;
    perBotPerMinute: number;
}
export interface RetentionDays {
    messages: number;
    deliveries: number;
    webhookLog: number;
    sessions: number;
}
export interface DefaultsSettings {
    languageCode: string;
    parseMode: 'HTML' | 'MarkdownV2' | 'plain' | string;
    signatureLine?: string | null;
    disableWebPagePreview: boolean;
    disableNotification: boolean;
    allowedLanguages: string[];
    maxBroadcastConcurrency: number;
    defaultRateLimit: RateLimitDefaults;
    retentionDays: RetentionDays;
}
export interface BusinessHoursEntry {
    weekday: number; // 0..6 Sunday..Saturday
    openHHMM: string;
    closeHHMM: string;
}
export interface OutOfHoursReply {
    kind: 'reply_text' | 'reply_media' | 'noop' | string;
    payload?: unknown;
}
export interface BusinessHoursSettings {
    timezone: string;
    schedule: BusinessHoursEntry[];
    outOfHoursReply?: OutOfHoursReply | null;
}
export interface NotificationsSettings {
    dailyDigest: boolean;
    errorAlerts: boolean;
    slackWebhook?: string | null;
    emailRecipients: string[];
}
export interface SecuritySettings {
    rotateWebhookSecretEveryDays?: number | null;
    requireBotAdmin: boolean;
    ipAllowlist: string[];
}
export interface GdprSettings {
    dataRetentionDays: number;
    autoDeleteIdleChatsDays: number;
}

export interface ProjectSettings {
    defaults: DefaultsSettings;
    businessHours: BusinessHoursSettings;
    notifications: NotificationsSettings;
    security: SecuritySettings;
    gdpr: GdprSettings;
}

export interface EffectiveSettings extends ProjectSettings {
    projectId: string;
    botId?: string;
}

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    requestId?: string;
}

export interface ProjectResp {
    settings?: ProjectSettings;
    error?: string;
}
export interface EffectiveResp {
    effective?: EffectiveSettings;
    error?: string;
}
export interface OverridesResp {
    overrides?: Record<string, unknown>;
    error?: string;
}
export interface TestHoursResp {
    within_business_hours: boolean;
    timestamp: string;
    error?: string;
}
export interface GdprRequestRow {
    _id: string;
    projectId: string;
    requestedBy: string;
    kind: 'export' | 'delete' | string;
    status: 'queued' | 'running' | 'done' | 'failed' | string;
    createdAt: string;
    reason?: string;
}
export interface GdprListResp {
    requests: GdprRequestRow[];
    error?: string;
}
export interface AuditRow {
    _id: string;
    actorId: string;
    field: string;
    oldValue: string;
    newValue: string;
    changedAt: string;
}
export interface AuditListResp {
    rows: AuditRow[];
    nextCursor?: string;
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

export const telegramSettingsApi = {
    getProject: (projectId: string) =>
        rustFetch<ProjectResp>(`${BASE}/${buildQuery({ projectId })}`),
    putProject: (projectId: string, body: ProjectSettings) =>
        rustFetch<AckResult>(`${BASE}/${buildQuery({ projectId })}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    getEffective: (projectId: string, botId?: string) =>
        rustFetch<EffectiveResp>(
            `${BASE}/effective${buildQuery({ projectId, botId })}`,
        ),
    getOverrides: (projectId: string, botId: string) =>
        rustFetch<OverridesResp>(
            `${BASE}/overrides${buildQuery({ projectId, botId })}`,
        ),
    putOverrides: (
        projectId: string,
        botId: string,
        overrides: Record<string, unknown>,
    ) =>
        rustFetch<AckResult>(`${BASE}/overrides${buildQuery({ projectId, botId })}`, {
            method: 'PUT',
            body: JSON.stringify(overrides),
        }),
    deleteOverrides: (projectId: string, botId: string) =>
        rustFetch<AckResult>(`${BASE}/overrides${buildQuery({ projectId, botId })}`, {
            method: 'DELETE',
        }),
    testOutOfHours: (
        projectId: string,
        body: { timestamp?: string; botId?: string },
    ) =>
        rustFetch<TestHoursResp>(
            `${BASE}/test-out-of-hours${buildQuery({ projectId })}`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
    exportData: (projectId: string, reason?: string) =>
        rustFetch<AckResult>(`${BASE}/export-data${buildQuery({ projectId })}`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),
    deleteData: (projectId: string, confirm: string, reason?: string) =>
        rustFetch<AckResult>(`${BASE}/delete-data${buildQuery({ projectId })}`, {
            method: 'POST',
            body: JSON.stringify({ confirm, reason }),
        }),
    listGdprRequests: (projectId: string) =>
        rustFetch<GdprListResp>(
            `${BASE}/gdpr-requests${buildQuery({ projectId })}`,
        ),
    audit: (projectId: string, opts: { cursor?: string; limit?: number } = {}) =>
        rustFetch<AuditListResp>(
            `${BASE}/audit${buildQuery({ projectId, cursor: opts.cursor, limit: opts.limit })}`,
        ),
};

export type TelegramSettingsApi = typeof telegramSettingsApi;
