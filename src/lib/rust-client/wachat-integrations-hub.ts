/**
 * Client for the Wachat **integrations-hub** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/integrations` by the
 * `wachat-integrations-hub` crate. Scope is intentionally narrow: this crate
 * only records which OAuth providers a tenant has connected
 * (`wa_oauth_connections`, keyed by `{userId, provider}`). The actual OAuth
 * handoff stays in Next.js; razorpay / link-clicks / widget / webhooks /
 * api-keys live in their own crates and are NOT touched here.
 *
 *   GET    /oauth                      → list_connections
 *   POST   /oauth/{provider}/connect   → connect_provider
 *   DELETE /oauth/{provider}           → disconnect_provider
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/integrations';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/** Provider slugs the OAuth Connections tab knows about. The Rust handlers
 * reject anything else with a 400. */
export type OauthProvider = 'facebook' | 'shopify' | 'google-analytics';

/**
 * One row in the `GET /oauth` response — the connection state for a single
 * provider, scoped to the calling user. `GET /oauth` always returns all three
 * known providers (connected or not) so the page can render a stable grid.
 */
export interface OauthConnection {
    /** Provider slug. */
    provider: OauthProvider;
    /** Whether the caller currently has an active connection record. */
    connected: boolean;
    /**
     * Human label for the connected account (e.g. WABA / store name).
     * Absent (omitted from JSON) when no connection exists yet.
     */
    accountLabel?: string;
    /**
     * ISO-8601 timestamp of when the connection was recorded.
     * Absent when not connected.
     */
    connectedAt?: string;
}

/** Response envelope for `GET /oauth`. */
export interface ListConnectionsResponse {
    connections: OauthConnection[];
}

/**
 * Optional body for `POST /oauth/{provider}/connect`. The real OAuth handoff
 * happens in Next; this just records an initiated intent, so an account label
 * is the only thing worth carrying through.
 */
export interface ConnectBody {
    /** Optional label for the account being connected. */
    accountLabel?: string;
}

/** `{ success: true }` envelope for the connect / disconnect mutations. */
export interface SuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatIntegrationsHubApi = {
    /** `GET /oauth` — list every known provider with its connection state. */
    listConnections: () =>
        rustFetch<ListConnectionsResponse>(`${BASE}/oauth`),

    /** `POST /oauth/{provider}/connect` — record an initiated connection intent. */
    connectProvider: (provider: OauthProvider, body?: ConnectBody) =>
        rustFetch<SuccessResponse>(
            `${BASE}/oauth/${encodeURIComponent(provider)}/connect`,
            {
                method: 'POST',
                body: JSON.stringify(body ?? {}),
            },
        ),

    /** `DELETE /oauth/{provider}` — remove the caller's connection record. */
    disconnectProvider: (provider: OauthProvider) =>
        rustFetch<SuccessResponse>(
            `${BASE}/oauth/${encodeURIComponent(provider)}`,
            { method: 'DELETE' },
        ),
};

export type WachatIntegrationsHubApi = typeof wachatIntegrationsHubApi;
