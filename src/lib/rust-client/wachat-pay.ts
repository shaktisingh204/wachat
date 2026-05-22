/**
 * Client for the Wachat **pay** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/pay` by the
 * `wachat-pay` crate (Phase 6 — payment-configuration management). Each
 * method is a one-line shim around {@link rustFetch} so the namespace
 * surface stays close to the OpenAPI operation IDs.
 *
 *   GET    /projects/{id}/configurations                                  → listConfigurations
 *   POST   /projects/{id}/configurations                                  → createConfiguration
 *   GET    /projects/{id}/configurations/{name}                           → getConfiguration
 *   DELETE /projects/{id}/configurations/{name}                           → deleteConfiguration
 *   POST   /projects/{id}/configurations/{name}/data-endpoint             → updateDataEndpoint
 *   POST   /projects/{id}/configurations/{name}/regenerate-oauth          → regenerateOauth
 *   POST   /projects/{id}/configurations/{name}/sync-local                → syncLocal
 *   GET    /projects/{id}/transactions                                    → listTransactions
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/pay';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * A single Meta `payment_configuration` record. The shape is whatever Meta
 * returns under the WABA `payment_configurations` envelope — left open-ended
 * because Meta evolves it without a schema bump (`provider_name`, OAuth
 * status, data-endpoint URL, etc.).
 */
export type PaymentConfiguration = Record<string, unknown> & {
    configuration_name?: string;
    provider_name?: string;
    purpose_code?: string;
    merchant_category_code?: string;
    merchant_vpa?: string;
    redirect_url?: string;
    data_endpoint_url?: string;
};

/**
 * Body for `POST /v1/wachat/pay/projects/{id}/configurations`.
 *
 * Mirrors `wachat_pay::config::CreateConfigBody`. When
 * `providerName === "upi_vpa"` the caller must supply `merchantVpa`;
 * otherwise `redirectUrl` is required. The Rust handler hands both
 * through to Meta unchanged and lets the upstream reject mismatches.
 */
export interface CreateConfigBody {
    configurationName: string;
    purposeCode: string;
    merchantCategoryCode: string;
    providerName: string;
    merchantVpa?: string;
    redirectUrl?: string;
}

/** Body for `POST /v1/wachat/pay/projects/{id}/configurations/{name}/data-endpoint`. */
export interface UpdateDataEndpointBody {
    dataEndpointUrl: string;
}

/** Body for `POST /v1/wachat/pay/projects/{id}/configurations/{name}/regenerate-oauth`. */
export interface RegenerateOauthBody {
    redirectUrl: string;
}

/**
 * Body for `POST /v1/wachat/pay/projects/{id}/configurations/{name}/sync-local`.
 *
 * Mirrors the legacy `handlePaymentConfigurationUpdate` server action
 * which accepted an open-ended `updateValue: any` and replaced the
 * matching slot in `projects.paymentConfiguration[]`.
 */
export interface SyncLocalBody {
    configurationName: string;
    updateValue: unknown;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface ListConfigurationsResponse {
    configurations: PaymentConfiguration[];
}

export interface ConfigurationResponse {
    configuration: PaymentConfiguration;
}

/**
 * Result of `POST /v1/wachat/pay/projects/{id}/configurations`. `oauthUrl`
 * is `null` for UPI VPA providers and a Meta-hosted onboarding URL
 * otherwise (mirrors the legacy server action's behavior).
 */
export interface CreateConfigurationResponse {
    message: string;
    oauthUrl: string | null;
}

export interface OauthResponse {
    oauthUrl: string;
}

/**
 * Result of `GET /v1/wachat/pay/projects/{id}/transactions`.
 *
 * Each transaction is a raw `transactions` document — the Rust handler
 * passes the stored Mongo doc through `document_to_clean_json` (ObjectId
 * → hex, Date → ISO 8601). Shape parity with the legacy
 * `getTransactionsForProject` server action: the TS callers were
 * already doing `JSON.parse(JSON.stringify(...))` on the result, so the
 * value here drops directly into the same code paths.
 */
export interface ListTransactionsResponse {
    transactions: Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatPayApi = {
    listConfigurations: (projectId: string) =>
        rustFetch<ListConfigurationsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/configurations`,
        ),

    getConfiguration: (projectId: string, configName: string) =>
        rustFetch<ConfigurationResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/configurations/${encodeURIComponent(configName)}`,
        ),

    createConfiguration: (projectId: string, body: CreateConfigBody) =>
        rustFetch<CreateConfigurationResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/configurations`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    updateDataEndpoint: (
        projectId: string,
        configName: string,
        body: UpdateDataEndpointBody,
    ) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/configurations/${encodeURIComponent(configName)}/data-endpoint`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    regenerateOauth: (
        projectId: string,
        configName: string,
        body: RegenerateOauthBody,
    ) =>
        rustFetch<OauthResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/configurations/${encodeURIComponent(configName)}/regenerate-oauth`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    deleteConfiguration: (projectId: string, configName: string) =>
        rustFetch<{ success: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/configurations/${encodeURIComponent(configName)}`,
            { method: 'DELETE' },
        ),

    syncLocal: (
        projectId: string,
        configName: string,
        body: SyncLocalBody,
    ) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/configurations/${encodeURIComponent(configName)}/sync-local`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    /**
     * `GET /v1/wachat/pay/projects/{id}/transactions` — list every
     * `transactions` row for the project, newest first. Replaces the
     * residual Mongo lookup in `getTransactionsForProject`.
     */
    listTransactions: (projectId: string) =>
        rustFetch<ListTransactionsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/transactions`,
        ),

    refundTransaction: (projectId: string, transactionId: string) =>
        rustFetch<{ success: boolean; message?: string; error?: string }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/transactions/${encodeURIComponent(transactionId)}/refund`,
            { method: 'POST' }
        ),
};

export type WachatPayApi = typeof wachatPayApi;
