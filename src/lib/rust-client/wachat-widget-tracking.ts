/**
 * Client for the Wachat **widget-tracking** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/widget` by the
 * `wachat-widget-tracking` crate. Backs the
 * `/wachat/integrations/whatsapp-widget-generator` page: per-project widget
 * analytics (loads / opens / clicks) and the advanced behaviour knobs that
 * used to live only in `localStorage`.
 *
 *   GET  /{projectId}/stats              → getStats           (get_stats)
 *   POST /{projectId}/track              → trackEvent         (track_event)
 *   PUT  /{projectId}/advanced-settings  → updateAdvancedSettings (update_advanced_settings)
 *
 * Counters + settings persist on the real `projects` collection under
 * `widgetSettings` (`stats` for analytics, `advanced` for the knobs).
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/widget';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Response for `GET /v1/wachat/widget/{projectId}/stats` — the project's
 * widget analytics. Each field defaults to `0` server-side when the project
 * has never recorded an event (mirrors `WidgetStats::default()`).
 */
export interface WidgetStats {
    loads: number;
    opens: number;
    clicks: number;
}

/** The three event kinds the tracker accepts. Anything else is a 422. */
export type WidgetEventType = 'load' | 'open' | 'click';

/** Body for `POST /v1/wachat/widget/{projectId}/track` — `TrackEventBody`. */
export interface TrackEventBody {
    eventType: WidgetEventType;
}

/**
 * Body for `PUT /v1/wachat/widget/{projectId}/advanced-settings` — the new
 * behaviour knobs stored under `widgetSettings.advanced` (`AdvancedSettingsBody`).
 */
export interface AdvancedSettingsBody {
    /** Delay (ms) before the widget auto-opens. `0` disables auto-open. */
    autoOpenDelay: number;
    /** Whether A/B style testing is enabled for this widget. */
    abTestEnabled: boolean;
    /** Active style variant identifier (e.g. `"classic"`, `"modern"`). */
    styleVariant: string;
}

/** `{ success: true }` envelope returned by the mutation endpoints. */
export interface WidgetSuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatWidgetTrackingApi = {
    /** `GET /{projectId}/stats` — owner-or-agent guarded widget analytics. */
    getStats: (projectId: string) =>
        rustFetch<WidgetStats>(
            `${BASE}/${encodeURIComponent(projectId)}/stats`,
        ),

    /**
     * `POST /{projectId}/track` — `$inc` the matching widget counter.
     * Scoped by project existence only (see crate handler docs); the session
     * JWT is still required by the router edge.
     */
    trackEvent: (projectId: string, body: TrackEventBody) =>
        rustFetch<WidgetSuccessResponse>(
            `${BASE}/${encodeURIComponent(projectId)}/track`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    /**
     * `PUT /{projectId}/advanced-settings` — owner-or-agent guarded `$set` of
     * `widgetSettings.advanced` (`{ autoOpenDelay, abTestEnabled, styleVariant }`).
     */
    updateAdvancedSettings: (projectId: string, body: AdvancedSettingsBody) =>
        rustFetch<WidgetSuccessResponse>(
            `${BASE}/${encodeURIComponent(projectId)}/advanced-settings`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),
};

export type WachatWidgetTrackingApi = typeof wachatWidgetTrackingApi;
