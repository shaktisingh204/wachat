/**
 * Client for the Wachat **Razorpay** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/razorpay` by the
 * `wachat-razorpay` crate (port of the in-process `razorpay` npm SDK calls
 * that used to live in `src/app/actions/integrations.actions.ts`):
 *
 *   GET  /projects/{id}/settings           → read razorpaySettings (keySecret masked)
 *   PUT  /projects/{id}/settings           → upsert { keyId, keySecret }
 *   GET  /projects/{id}/logs/transactions  → Razorpay payments.all
 *   GET  /projects/{id}/logs/payment-links → Razorpay paymentLink.all
 *   POST /projects/{id}/payment-links      → create a Razorpay payment link
 *
 * Server-only — uses the shared JWT-issuing fetcher. The crate owns the
 * Mongo tenancy guard + all HTTP to `api.razorpay.com`; this client only
 * shapes requests/responses.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/razorpay';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Result of `GET /v1/wachat/razorpay/projects/{id}/settings`.
 *
 * The crate **never** returns the raw secret: when a secret is stored,
 * `keySecret` is the masked placeholder `••••••••`; otherwise it is empty.
 * `configured` is the convenience flag (both creds present).
 */
export interface RazorpaySettingsResponse {
    /** Public Razorpay key id (e.g. `rzp_test_...`). Empty if unset. */
    keyId: string;
    /** Masked secret (`••••••••`) when stored, empty otherwise — never raw. */
    keySecret: string;
    /** Both creds present? */
    configured: boolean;
}

/** Body for `PUT /v1/wachat/razorpay/projects/{id}/settings`. */
export interface PutRazorpaySettingsBody {
    keyId: string;
    /** Raw secret — stored verbatim. Never send the masked placeholder. */
    keySecret: string;
}

/** `{ success: true }` envelope for the settings PUT. */
export interface RazorpaySuccessResponse {
    success: boolean;
}

/**
 * Result of the two log endpoints. `items` are Razorpay payment / payment-link
 * objects passed through verbatim (snake_case `created_at`, `short_url`, etc.),
 * so callers read them as opaque records.
 */
export interface RazorpayLogsResponse {
    items: RazorpayLogItem[];
}

/**
 * A single Razorpay log item (payment or payment link). Razorpay's own JSON
 * is snake_case and not under our control, so this is intentionally loose —
 * known fields are typed, the rest are passthrough.
 */
export interface RazorpayLogItem {
    id: string;
    /** Amount in **paise** (smallest currency unit), as Razorpay returns it. */
    amount?: number;
    status?: string;
    /** Payments only. */
    method?: string;
    /** Payment links only. */
    description?: string;
    /** Unix epoch seconds. */
    created_at?: number;
    [key: string]: unknown;
}

/** Body for `POST /v1/wachat/razorpay/projects/{id}/payment-links`. */
export interface CreateRazorpayPaymentLinkBody {
    /** Amount in **rupees** (whole-currency units) — the crate ×100 to paise. */
    amount: number;
    /** Customer contact number (the crate strips a leading +91). */
    contact: string;
    /** Description shown on the payment page. */
    description: string;
    /** Optional customer display name. */
    name?: string;
    /** Optional customer email (enables email notification when present). */
    email?: string;
}

/** Result of `POST /v1/wachat/razorpay/projects/{id}/payment-links`. */
export interface CreateRazorpayPaymentLinkResponse {
    /** Razorpay payment-link id (`plink_...`). */
    id: string;
    /** Short shareable URL for the payment link. */
    shortUrl: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatRazorpayApi = {
    getSettings: (projectId: string) =>
        rustFetch<RazorpaySettingsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/settings`,
        ),

    putSettings: (projectId: string, body: PutRazorpaySettingsBody) =>
        rustFetch<RazorpaySuccessResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/settings`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),

    listTransactions: (projectId: string) =>
        rustFetch<RazorpayLogsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/logs/transactions`,
        ),

    listPaymentLinks: (projectId: string) =>
        rustFetch<RazorpayLogsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/logs/payment-links`,
        ),

    createPaymentLink: (projectId: string, body: CreateRazorpayPaymentLinkBody) =>
        rustFetch<CreateRazorpayPaymentLinkResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/payment-links`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),
};

export type WachatRazorpayApi = typeof wachatRazorpayApi;
