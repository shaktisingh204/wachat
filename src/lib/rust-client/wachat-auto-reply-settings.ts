/**
 * Client for the Wachat **auto-reply-settings** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/auto-reply-settings` by
 * the `wachat-auto-reply-settings` crate (port of the native-Mongo writes
 * in `src/app/actions/project.actions.ts` —
 * `handleUpdateMasterSwitch` / `handleUpdateAutoReplySettings` /
 * `handleUpdateOptInOutSettings`):
 *
 *   GET   /{projectId}                  → get_settings
 *   PATCH /{projectId}/master-switch    → update_master_switch
 *   PUT   /{projectId}/welcome-message  → update_welcome_message
 *   PUT   /{projectId}/inactive-hours   → update_inactive_hours
 *   PUT   /{projectId}/general          → update_general
 *   PUT   /{projectId}/ai-assistant     → update_ai_assistant
 *   PUT   /{projectId}/opt-in-out       → update_opt_in_out
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/auto-reply-settings';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`). Shapes match
// `AutoReplySettings` / `OptInOutSettings` in `@/lib/definitions`.
// ---------------------------------------------------------------------------

/** One keyword-matched general reply rule (mirrors `GeneralReplyRule`). */
export interface AutoReplyGeneralRule {
    id: string;
    keywords: string;
    reply: string;
    /** `"contains"` or `"exact"`. */
    matchType: string;
}

/** `autoReplySettings.welcomeMessage` sub-document. */
export interface WelcomeMessageSettings {
    enabled: boolean;
    message: string;
}

/** `autoReplySettings.inactiveHours` sub-document. */
export interface InactiveHoursSettings {
    enabled: boolean;
    message: string;
    startTime: string;
    endTime: string;
    timezone: string;
    /** Active weekdays — `0` = Sunday … `6` = Saturday. */
    days: number[];
}

/** `autoReplySettings.general` sub-document. */
export interface GeneralSettings {
    enabled: boolean;
    replies: AutoReplyGeneralRule[];
}

/** `autoReplySettings.aiAssistant` sub-document. */
export interface AiAssistantSettings {
    enabled: boolean;
    context: string;
    autoTranslate: boolean;
}

/** `optInOutSettings` sub-document. */
export interface OptInOutSettingsBody {
    enabled: boolean;
    optInKeywords: string[];
    optOutKeywords: string[];
    optInResponse: string;
    optOutResponse: string;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * Result of `GET /v1/wachat/auto-reply-settings/{projectId}`.
 *
 * Both fields are cleaned-JSON projections of the stored sub-documents, or
 * `null` when the project has never saved them. Shapes match
 * `AutoReplySettings` / `OptInOutSettings` from `@/lib/definitions`.
 */
export interface AutoReplySettingsResponse {
    autoReplySettings: {
        masterEnabled?: boolean;
        welcomeMessage?: WelcomeMessageSettings;
        inactiveHours?: InactiveHoursSettings;
        general?: GeneralSettings;
        aiAssistant?: AiAssistantSettings;
    } | null;
    optInOutSettings: OptInOutSettingsBody | null;
}

/** `{ success: true }` envelope returned by every mutation endpoint. */
export interface AutoReplySettingsSuccess {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatAutoReplySettingsApi = {
    getSettings: (projectId: string) =>
        rustFetch<AutoReplySettingsResponse>(
            `${BASE}/${encodeURIComponent(projectId)}`,
        ),

    updateMasterSwitch: (projectId: string, enabled: boolean) =>
        rustFetch<AutoReplySettingsSuccess>(
            `${BASE}/${encodeURIComponent(projectId)}/master-switch`,
            {
                method: 'PATCH',
                body: JSON.stringify({ enabled }),
            },
        ),

    updateWelcomeMessage: (projectId: string, body: WelcomeMessageSettings) =>
        rustFetch<AutoReplySettingsSuccess>(
            `${BASE}/${encodeURIComponent(projectId)}/welcome-message`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),

    updateInactiveHours: (projectId: string, body: InactiveHoursSettings) =>
        rustFetch<AutoReplySettingsSuccess>(
            `${BASE}/${encodeURIComponent(projectId)}/inactive-hours`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),

    updateGeneral: (projectId: string, body: GeneralSettings) =>
        rustFetch<AutoReplySettingsSuccess>(
            `${BASE}/${encodeURIComponent(projectId)}/general`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),

    updateAiAssistant: (projectId: string, body: AiAssistantSettings) =>
        rustFetch<AutoReplySettingsSuccess>(
            `${BASE}/${encodeURIComponent(projectId)}/ai-assistant`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),

    updateOptInOut: (projectId: string, body: OptInOutSettingsBody) =>
        rustFetch<AutoReplySettingsSuccess>(
            `${BASE}/${encodeURIComponent(projectId)}/opt-in-out`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),
};

export type WachatAutoReplySettingsApi = typeof wachatAutoReplySettingsApi;
