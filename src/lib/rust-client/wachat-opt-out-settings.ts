/**
 * Client for the Wachat **opt-out settings** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/opt-out-settings` by the
 * `wachat-opt-out-settings` crate. This crate persists the per-project
 * AI-Settings toggle(s) shown on the `/wachat/opt-out` page; the opt-out
 * LIST itself lives in `wachat-features` and is untouched here.
 *
 *   GET  /projects/{projectId}   → getSettings (saved doc, or defaults)
 *   POST /projects/{projectId}   → upsertSettings ({ success })
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/opt-out-settings';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * The cleaned settings document for a project, or sensible defaults when no
 * doc has been saved yet. Shape matches `default_settings()` / the
 * `wa_opt_out_settings` doc the Rust handlers persist.
 */
export interface OptOutSettings {
    /** The project the settings belong to (hex ObjectId string). */
    projectId: string;
    /**
     * Auto-add inbound contacts to the opt-out list when sentiment analysis
     * detects an unsubscribe intent (e.g. "stop messaging me").
     */
    sentimentAutoOptOut: boolean;
    /** Present on a persisted doc; absent on the default payload. */
    _id?: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Body for `POST /v1/wachat/opt-out-settings/projects/{projectId}`.
 *
 * All fields optional so partial updates are cheap — unspecified flags keep
 * their current (or default) value on the Rust side.
 */
export interface UpsertOptOutSettingsBody {
    /** Toggle for the sentiment auto-opt-out feature. */
    sentimentAutoOptOut?: boolean;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * Result of `GET /v1/wachat/opt-out-settings/projects/{projectId}`.
 *
 * `settings` is the cleaned `wa_opt_out_settings` doc passed through, or the
 * default payload (`{ projectId, sentimentAutoOptOut: false }`) when none has
 * been saved yet.
 */
export interface GetOptOutSettingsResponse {
    settings: OptOutSettings;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatOptOutSettingsApi = {
    getSettings: (projectId: string) =>
        rustFetch<GetOptOutSettingsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}`,
        ),

    upsertSettings: (projectId: string, body: UpsertOptOutSettingsBody) =>
        rustFetch<{ success: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),
};

export type WachatOptOutSettingsApi = typeof wachatOptOutSettingsApi;
