/**
 * Client for the admin-side API-key CRUD on the Rust BFF.
 *
 * Mirrors the three actions in `src/app/actions/api-keys.actions.ts`:
 *
 *   POST  /v1/api-keys                  → generateApiKey
 *   GET   /v1/api-keys                  → getApiKeysForUser
 *   PATCH /v1/api-keys/{keyId}/revoke   → revokeApiKey
 *
 * NOT to be confused with the public-API verifier — that path lives on
 * the request side (`/v1/wachat/public/*`) and authenticates inbound
 * customer traffic. The endpoints here are user-facing CRUD: a logged-in
 * dashboard user generates / lists / revokes their own keys.
 *
 * Server-only — uses the shared JWT-issuing fetcher so the AuthUser's
 * `user_id` becomes the Mongo `tenantId` filter on the Rust side. Cross-
 * user reads/writes are 404'd by the handler.
 */
import 'server-only';

import { rustFetch } from './fetcher';

// NOTE: no trailing slash. The Rust side nests this crate at `/v1/api-keys`
// with an inner `route("/")`; under axum 0.8 the bare prefix `/v1/api-keys`
// matches but `/v1/api-keys/` 404s. Hitting `${BASE}` (not `${BASE}/`) is what
// makes list/generate resolve — do NOT re-add the trailing slash.
const BASE = '/v1/api-keys';

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/**
 * Body for `POST /v1/api-keys`. `name` is the only required field — it's
 * shown in the dashboard list. `scopes` and `tier` are optional and
 * default to `["*"]` / `"FREE"` respectively on the Rust side, matching
 * the legacy TS server action that never narrowed either at create time.
 */
export interface AdminApiKeyGenerateBody {
    name: string;
    /** Optional grant list; defaults to `["*"]`. */
    scopes?: string[];
    /** Optional plan tier — `FREE` | `PRO` | `ENTERPRISE`. */
    tier?: 'FREE' | 'PRO' | 'ENTERPRISE';
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * Result of `POST /v1/api-keys`. `apiKey` is the **plaintext** secret —
 * surfaced exactly once and never re-readable. UI must display it
 * immediately and warn the user it cannot be retrieved later.
 */
export interface AdminApiKeyGenerateResult {
    success: boolean;
    /** Plaintext key — `sn_<32 url-safe>`. Only present on success. */
    apiKey?: string;
    /** Hex `_id` of the new row, useful for audit logging. */
    keyId?: string;
    error?: string;
}

/**
 * Metadata-only summary returned by `GET /v1/api-keys`. The hash and
 * plaintext are NEVER on the wire; only fields safe to show in the
 * dashboard.
 */
export interface AdminApiKeySummary {
    /** Hex `_id`, used as the path parameter for revoke. */
    _id: string;
    name: string;
    revoked: boolean;
    requestCount: number;
    /** ISO-8601 string. Always present. */
    createdAt: string;
    /** ISO-8601 string. Absent until the key is first used. */
    lastUsedAt?: string;
}

/** Result of `PATCH /v1/api-keys/{keyId}/revoke`. */
export interface AdminApiKeyRevokeResult {
    success: boolean;
    error?: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatApiKeysAdminApi = {
    /**
     * Generate a new API key for the authenticated user.
     *
     * The returned `apiKey` is the only chance to capture the plaintext
     * — store it client-side just long enough to display and warn the
     * user, then forget it.
     */
    generate: (body: AdminApiKeyGenerateBody) =>
        rustFetch<AdminApiKeyGenerateResult>(BASE, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /**
     * List the authenticated user's API keys (metadata only).
     *
     * Sorted by `createdAt` desc on the Rust side. Revoked keys are
     * included so the dashboard can render them grayed out — the same
     * behavior the legacy server action had.
     */
    list: () => rustFetch<AdminApiKeySummary[]>(BASE),

    /**
     * Soft-delete a key by id. The Rust handler scopes the update by
     * `tenantId == user_id`, so cross-user attempts return
     * `success: false` rather than mutating anything.
     */
    revoke: (keyId: string) =>
        rustFetch<AdminApiKeyRevokeResult>(
            `${BASE}/${encodeURIComponent(keyId)}/revoke`,
            { method: 'PATCH' },
        ),
};

export type WachatApiKeysAdminApi = typeof wachatApiKeysAdminApi;
