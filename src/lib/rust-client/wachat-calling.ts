/**
 * Client for the Wachat **calling** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/calling` by the
 * `wachat-calling` crate (port of `src/app/actions/calling.actions.ts`):
 *
 *   GET    /projects/{id}/phone-numbers/{pnid}/settings   → getPhoneNumberCallingSettings
 *   POST   /projects/{id}/phone-numbers/{pnid}/settings   → savePhoneNumberCallingSettings
 *   GET    /projects/{id}/logs                            → getCallLogs
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/calling';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

export interface CallingWeeklyOperatingHours {
    /** "MONDAY" | "TUESDAY" | … | "SUNDAY". */
    dayOfWeek: string;
    /** "HHMM" 24-hour. */
    openTime: string;
    /** "HHMM" 24-hour. */
    closeTime: string;
}

export interface CallingHolidaySchedule {
    /** "YYYY-MM-DD". */
    date: string;
    startTime: string;
    endTime: string;
}

export interface CallingCallHours {
    status: 'ENABLED' | 'DISABLED' | string;
    timezoneId: string;
    weeklyOperatingHours: CallingWeeklyOperatingHours[];
    holidaySchedule: CallingHolidaySchedule[];
}

export interface CallingSipServer {
    hostname: string;
    port: number;
    requestUriUserParams?: Record<string, string>;
}

export interface CallingSipSettings {
    status: 'ENABLED' | 'DISABLED' | string;
    servers: CallingSipServer[];
}

/**
 * Body for `POST /v1/wachat/calling/projects/{id}/phone-numbers/{pnid}/settings`.
 *
 * Two write modes:
 * - **Quick toggle**: only `quickStatus` set — Rust sends `{calling: {status}}`.
 * - **Full save**: every field set — Rust sends the full envelope (call hours,
 *   SIP, callback permission, restrict-to-countries).
 */
export interface SaveCallingSettingsBody {
    /** If present, only `calling.status` is written. */
    quickStatus?: 'ENABLED' | 'DISABLED' | string;
    callIconVisibility?: 'DEFAULT' | 'HIDDEN' | 'SHOW' | string;
    /** ISO country codes — empty/undefined skips the `call_icons` field. */
    restrictToUserCountries?: string[];
    callbackPermissionStatus?: 'ENABLED' | 'DISABLED' | string;
    callHours?: CallingCallHours;
    sip?: CallingSipSettings;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * Result of `GET /v1/wachat/calling/projects/{id}/phone-numbers/{pnid}/settings`.
 *
 * `settings` is Meta's `calling` object passed through verbatim — shape
 * matches the legacy `CallingSettings` TS type from `@/lib/definitions`.
 * `null` when the phone-number-id has no calling settings yet.
 */
export interface GetCallingSettingsResponse {
    settings: unknown;
}

/**
 * Result of `GET /v1/wachat/calling/projects/{id}/logs`.
 *
 * `logs` are raw `crm_call_logs` documents, sorted `createdAt` desc, capped
 * at 100 — same shape the legacy TS server action returned (the TS callers
 * coerce `_id`/dates on the client side).
 */
export interface CallLogsResponse {
    logs: unknown[];
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatCallingApi = {
    getSettings: (projectId: string, phoneNumberId: string) =>
        rustFetch<GetCallingSettingsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/settings`,
        ),

    saveSettings: (
        projectId: string,
        phoneNumberId: string,
        body: SaveCallingSettingsBody,
    ) =>
        rustFetch<{ success: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/settings`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    listLogs: (projectId: string) =>
        rustFetch<CallLogsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/logs`,
        ),
};

export type WachatCallingApi = typeof wachatCallingApi;
