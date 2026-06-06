/**
 * Client for the Wachat **config** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/config` by the
 * project-config / phone-sync / phone-register / webhook-subscribe slices
 * (Phase 5, slices 1–6). Each method is a one-line shim around
 * {@link rustFetch} so the namespace surface stays close to the OpenAPI
 * operation IDs — when codegen replaces this file the call sites won't
 * change.
 *
 *   GET    /projects/:id/public                                            → getPublicProject
 *   POST   /projects/manual-setup                                          → manualSetup
 *
 *   POST   /projects/:id/phone-numbers/sync                                → syncPhoneNumbers
 *   POST   /projects/:id/phone-numbers/:pnid/profile                       → updatePhoneProfile
 *
 *   GET    /projects/:id/webhook-subscription?waba_id=...                  → getWebhookSubscription
 *   POST   /webhooks/subscribe-all                                         → subscribeAllWebhooks
 *   POST   /projects/:id/webhooks/subscribe                                → subscribeWebhook
 *
 *   POST   /projects/:id/phone-numbers/:pnid/register                      → registerPhone
 *   POST   /projects/:id/phone-numbers/:pnid/request-verification-code     → requestVerificationCode
 *   POST   /projects/:id/phone-numbers/:pnid/verify-code                   → verifyCode
 *   POST   /projects/:id/phone-numbers/:pnid/deregister                    → deregisterPhone
 *   POST   /projects/:id/phone-numbers/:pnid/two-step-pin                  → setTwoStepPin
 *
 *   GET    /projects/:id/phone-numbers/:pnid/qr-codes                      → listQrCodes
 *   POST   /projects/:id/phone-numbers/:pnid/qr-codes                      → createQrCode
 *   POST   /projects/:id/phone-numbers/:pnid/qr-codes/:code                → updateQrCode
 *   DELETE /projects/:id/phone-numbers/:pnid/qr-codes/:code                → deleteQrCode
 *
 *   POST   /projects/:id/widget-settings                                   → saveWidgetSettings
 *
 *   GET    /me/businesses?accessToken=...                                  → getMeBusinesses
 *   GET    /waba/:wabaId/details?accessToken=...                           → getWabaDetails
 *   POST   /waba/:wabaId/name                                              → updateWabaName
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/config';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Read-only projection of a Project document.
 *
 * Mirrors `wachat_project_config::dto::PublicProject`. The Rust side strips
 * `accessToken` and any other sensitive token fields before serialization,
 * so the browser-facing client never sees them — even by mistake. Nested
 * `phoneNumbers` entries follow the `StoredPhoneNumber` shape from
 * `wachat-phone-sync` (open-ended `profile` JSON object preserved verbatim).
 */
export interface PublicProject {
    _id: string;
    userId: string;
    name: string;
    wabaId?: string | null;
    businessId?: string | null;
    appId?: string | null;
    phoneNumbers: Array<{
        id: string;
        display_phone_number: string;
        verified_name: string;
        code_verification_status?: string | null;
        quality_rating?: string | null;
        platform_type?: string | null;
        throughput?: unknown;
        profile?: unknown;
    }>;
    messagesPerSecond?: number | null;
    credits?: number | null;
    planId?: string | null;
    reviewStatus?: string | null;
    banState?: string | null;
    createdAt: string;
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/**
 * Body for `POST /v1/wachat/config/projects/manual-setup`.
 *
 * Mirrors `wachat_project_config::dto::ManualSetupReq` — the form data
 * collected by the legacy `handleManualWachatSetup` server action, normalized
 * to camelCase JSON. The Rust handler upserts on `(wabaId, userId)` so the
 * read-then-write race in the legacy code is gone.
 *
 * `phoneNumberId` is optional — the OAuth-linked WABA flow doesn't have one
 * at create time (the phone numbers are sync'd from Meta right after).
 * `includeCatalog` mirrors the legacy `_createProjectFromWaba` flag and is
 * stored as `hasCatalogManagement` on the project doc on first insert.
 */
export interface ManualSetupBody {
    name: string;
    wabaId: string;
    phoneNumberId?: string;
    accessToken: string;
    businessId?: string;
    appId?: string;
    includeCatalog?: boolean;
}

/** Result of `GET /v1/wachat/config/projects/by-waba/:wabaId`. */
export interface ProjectByWabaResponse {
    /** Hex `_id` of the project owned by the caller. */
    projectId: string;
}

/**
 * Body for `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/profile`.
 *
 * Mirrors `wachat_phone_sync::dto::UpdateProfileReq`. Each `undefined` field
 * is omitted from the Meta `whatsapp_business_profile` payload **and** is
 * left untouched on the local Mongo doc — exactly the "only send what was
 * filled in" semantics the legacy server action followed. An empty string
 * still mirrors locally (treated as "user cleared the field").
 *
 * `profilePictureHandle` is a pre-resolved Meta handle from the
 * `/uploads` resumable session — that flow lives in a separate media crate
 * and is intentionally out of scope here.
 */
export interface UpdateProfileBody {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    vertical?: string;
    /** Full website list — `[]` clears, `undefined` leaves untouched. */
    websites?: string[];
    profilePictureHandle?: string;
}

/**
 * Body for `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/register`.
 *
 * `pin` is the 6-digit 2FA pin Meta requires to re-bind a phone number to
 * its WABA. The Rust handler hard-codes `messaging_product: "whatsapp"` so
 * the wire payload matches Meta's `POST /{phone-number-id}/register` shape.
 */
export interface RegisterBody {
    pin: string;
}

/**
 * Body for `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/request-verification-code`.
 *
 * Mirrors the Meta `POST /{phone-number-id}/request_code` payload. `method`
 * is the delivery channel for the OTP; `language` is a BCP-47 tag (Meta
 * historically only honors `"en"`-class codes here, but the field is plumbed
 * through verbatim).
 */
export interface RequestVerificationCodeBody {
    method: 'SMS' | 'VOICE';
    language: string;
}

/** Body for `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/verify-code`. */
export interface VerifyCodeBody {
    code: string;
}

/** Body for `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/two-step-pin`. */
export interface SetTwoStepPinBody {
    pin: string;
}

/**
 * Body for `POST /v1/wachat/config/projects/:id/widget-settings`.
 *
 * Mirrors `WhatsAppWidgetSettings` from `src/lib/definitions.ts` — the
 * payload the in-app widget generator persists onto the project doc under
 * `widgetSettings`. Optional `stats` is intentionally omitted: the legacy
 * server action never wrote it (analytics live on a different path), and
 * sending it from the form would clobber server-managed counters.
 */
export interface SaveWidgetSettingsBody {
    phoneNumber: string;
    prefilledMessage: string;
    position: 'bottom-right' | 'bottom-left';
    buttonColor: string;
    headerTitle: string;
    headerSubtitle: string;
    headerAvatarUrl: string;
    welcomeMessage: string;
    ctaText: string;
    borderRadius: number;
    padding: number;
    textColor: string;
    buttonTextColor: string;
}

/**
 * Body for `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/qr-codes`.
 *
 * `generateQrImage` is the Meta-side image format hint; the legacy server
 * action hard-coded `"SVG"` — exposing it here lets future callers opt into
 * `"PNG"` without an API change.
 */
export interface CreateQrCodeBody {
    prefilledMessage: string;
    generateQrImage?: 'SVG' | 'PNG';
}

/** Body for `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/qr-codes/:code`. */
export interface UpdateQrCodeBody {
    prefilledMessage: string;
}

/**
 * Body for `POST /v1/wachat/config/projects/:id/webhooks/subscribe`.
 *
 * The user-scoped Meta access token must accompany the request because
 * subscribing a WABA to an app on Meta's side requires a user/system token
 * with `whatsapp_business_management` — the project-level long-lived token
 * is not always sufficient. The Rust handler forwards the token to Meta and
 * never persists it.
 */
export interface SubscribeBody {
    appId: string;
    userAccessToken: string;
}

/**
 * Body for `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/display-name`.
 *
 * Mirrors `wachat_config::display_name::DisplayNameBody`. The Rust handler
 * forwards `displayName` to Meta's phone-number node as `new_display_name`,
 * then records a local `PENDING_REVIEW` marker on the project doc — the review
 * outcome is asynchronous, so poll {@link getDisplayNameStatus} for the live
 * state. An empty/whitespace-only name is rejected server-side with a typed
 * `Validation` error.
 */
export interface SetDisplayNameBody {
    displayName: string;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * Single QR-code record returned by Meta for a phone number.
 *
 * Field shape mirrors Meta's `/message_qrdls` resource — the Rust handler
 * passes it through after auth/scope checks. Extra fields Meta may add in
 * the future are tolerated via the `[k: string]` index.
 */
export interface QrCode {
    code: string;
    prefilled_message?: string;
    deep_link_url?: string;
    qr_image_url?: string;
    [k: string]: unknown;
}

/** Result of `GET /v1/wachat/config/projects/:id/webhook-subscription`. */
export interface SubscriptionStatus {
    isActive: boolean;
}

/**
 * Result of `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/display-name`.
 *
 * Mirrors `wachat_config::display_name::DisplayNameOutcome`. `status` is the
 * local pending marker the Rust side just persisted (`"PENDING_REVIEW"`).
 */
export interface DisplayNameOutcome {
    phoneNumberId: string;
    requestedName: string;
    status: string;
}

/**
 * Result of `GET /v1/wachat/config/projects/:id/phone-numbers/:pnid/display-name/status`.
 *
 * Mirrors `wachat_config::display_name::DisplayNameStatus`. Every Graph-sourced
 * field is `serde(skip_serializing_if = "Option::is_none")` on the Rust side,
 * so each is genuinely optional over the wire:
 * - `verifiedName` — Meta's current verified display name, if any.
 * - `nameStatus` — review state of the *current* name (`APPROVED` / `PENDING_REVIEW` / …).
 * - `newNameStatus` — review state of an *in-flight* name change, when one exists.
 * - `requestedName` — the name we last asked Meta to apply (from the project doc).
 */
export interface DisplayNameStatus {
    phoneNumberId: string;
    verifiedName?: string;
    nameStatus?: string;
    newNameStatus?: string;
    requestedName?: string;
}

/**
 * Result of `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/flows-encryption/generate`.
 *
 * Mirrors `wachat_config::display_name::GenerateKeysOutcome`. Only the SPKI
 * `publicKey` PEM crosses the wire — the private half is persisted on the
 * project doc and never serialized back out. `metaStatus` is `"NOT_UPLOADED"`
 * right after keygen (call {@link uploadFlowsEncryption} to push it to Meta).
 */
export interface GenerateFlowsKeysOutcome {
    phoneNumberId: string;
    /** SPKI PEM (`-----BEGIN PUBLIC KEY-----`). */
    publicKey: string;
    /** `"NOT_UPLOADED"` | `"UPLOADED"` | `"FAILED"`. */
    metaStatus: string;
}

/**
 * Result of `POST /v1/wachat/config/projects/:id/phone-numbers/:pnid/flows-encryption/upload`.
 *
 * Mirrors `wachat_config::display_name::UploadKeyOutcome`. `metaStatus` is
 * `"UPLOADED"` on success; a Meta-side failure returns a typed error (and flips
 * the persisted status to `"FAILED"` best-effort) rather than this shape.
 */
export interface UploadFlowsKeyOutcome {
    phoneNumberId: string;
    /** `"UPLOADED"` | `"FAILED"`. */
    metaStatus: string;
}

/**
 * One entry from Meta's `GET /me/businesses` response. Mirrors
 * `wachat_config::waba_setup::Business` — only `id` is guaranteed; `name`
 * is best-effort for diagnostics. Used by the OAuth-linked WABA flow to
 * seed `businessId` for catalog features.
 */
export interface Business {
    id: string;
    name?: string;
}

/** Result of `GET /v1/wachat/config/me/businesses`. */
export interface BusinessesResponse {
    data: Business[];
}

/** Result of `GET /v1/wachat/config/waba/:wabaId/details`. */
export interface WabaDetails {
    name: string;
}

/** Per-project failure record from `subscribeAllWebhooks`. */
export interface SubscribeFailure {
    projectId: string;
    error: string;
}

/**
 * Result of `POST /v1/wachat/config/webhooks/subscribe-all`.
 *
 * `attempted == succeeded + failed.length`. Skipped projects (missing
 * `wabaId` / `appId` / `accessToken`) count as failed with a human-readable
 * skip reason in `error`.
 */
export interface SubscribeAllOutcome {
    attempted: number;
    succeeded: number;
    failed: SubscribeFailure[];
}

/**
 * Result of `POST /v1/wachat/config/projects/:id/phone-numbers/sync`.
 *
 * Mirrors `wachat_phone_sync::SyncOutcome` — the Rust side reports how many
 * phone-number rows it pulled from Meta and overwrote on the project doc.
 */
export interface SyncNumbersOutcome {
    fetched: number;
}

// ---------------------------------------------------------------------------
// Query helper — keeps `?waba_id=…` strings off the call sites.
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, v);
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatConfigApi = {
    // ----------- /projects/* (read + manual setup) -----------

    getPublicProject: (projectId: string) =>
        rustFetch<PublicProject>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/public`,
        ),

    manualSetup: (body: ManualSetupBody) =>
        rustFetch<PublicProject>(`${BASE}/projects/manual-setup`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /**
     * `GET /v1/wachat/config/projects/by-waba/:wabaId` — resolve a WABA
     * id to the calling user's project id. Replaces the residual
     * `db.collection('projects').findOne({ wabaId })` lookups in the
     * legacy webhook server actions.
     */
    getProjectByWaba: (wabaId: string) =>
        rustFetch<ProjectByWabaResponse>(
            `${BASE}/projects/by-waba/${encodeURIComponent(wabaId)}`,
        ),

    // ----------- /projects/:id/phone-numbers/* (sync + profile) -----------

    syncPhoneNumbers: (projectId: string) =>
        rustFetch<SyncNumbersOutcome>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/sync`,
            { method: 'POST' },
        ),

    updatePhoneProfile: (
        projectId: string,
        phoneNumberId: string,
        body: UpdateProfileBody,
    ) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/profile`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    // ----------- /projects/:id/phone-numbers/:pnid/display-name (Wave E) -----------

    /**
     * `POST .../phone-numbers/:pnid/display-name` — submit a display-name
     * change to Meta and persist a `PENDING_REVIEW` marker. Returns the local
     * pending outcome; poll {@link getDisplayNameStatus} for the live review
     * state. A missing project access token degrades to a typed `BadRequest`
     * on the Rust side (no crash) so unconfigured projects surface gracefully.
     */
    setDisplayName: (
        projectId: string,
        phoneNumberId: string,
        body: SetDisplayNameBody,
    ) =>
        rustFetch<DisplayNameOutcome>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/display-name`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    /**
     * `GET .../phone-numbers/:pnid/display-name/status` — read the live
     * display-name review status from Meta (verified name + current/pending
     * review states), alongside the locally-recorded requested name.
     */
    getDisplayNameStatus: (projectId: string, phoneNumberId: string) =>
        rustFetch<DisplayNameStatus>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/display-name/status`,
        ),

    // ----------- /projects/:id/phone-numbers/:pnid/flows-encryption (Wave E) -----------

    /**
     * `POST .../phone-numbers/:pnid/flows-encryption/generate` — generate an
     * RSA-2048 keypair, store the private half on the project doc, and return
     * the SPKI public-key PEM. Status starts at `NOT_UPLOADED`.
     */
    generateFlowsEncryption: (projectId: string, phoneNumberId: string) =>
        rustFetch<GenerateFlowsKeysOutcome>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/flows-encryption/generate`,
            { method: 'POST' },
        ),

    /**
     * `POST .../phone-numbers/:pnid/flows-encryption/upload` — upload the
     * stored public key to Meta (`whatsapp_business_encryption`) and flip the
     * persisted status to `UPLOADED`. Requires {@link generateFlowsEncryption}
     * to have run first (otherwise the Rust side returns a typed `BadRequest`).
     */
    uploadFlowsEncryption: (projectId: string, phoneNumberId: string) =>
        rustFetch<UploadFlowsKeyOutcome>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/flows-encryption/upload`,
            { method: 'POST' },
        ),

    // ----------- /webhooks/* + /projects/:id/webhooks/* -----------

    getWebhookSubscription: (projectId: string, wabaId: string) =>
        rustFetch<SubscriptionStatus>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/webhook-subscription${qs({ waba_id: wabaId })}`,
        ),

    subscribeAllWebhooks: () =>
        rustFetch<SubscribeAllOutcome>(`${BASE}/webhooks/subscribe-all`, {
            method: 'POST',
        }),

    subscribeWebhook: (projectId: string, body: SubscribeBody) =>
        rustFetch<SubscriptionStatus>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/webhooks/subscribe`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    // ----------- /projects/:id/phone-numbers/:pnid/* (registration) -----------

    registerPhone: (
        projectId: string,
        phoneNumberId: string,
        body: RegisterBody,
    ) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/register`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    requestVerificationCode: (
        projectId: string,
        phoneNumberId: string,
        body: RequestVerificationCodeBody,
    ) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/request-verification-code`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    verifyCode: (
        projectId: string,
        phoneNumberId: string,
        body: VerifyCodeBody,
    ) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/verify-code`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    deregisterPhone: (projectId: string, phoneNumberId: string) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/deregister`,
            { method: 'POST' },
        ),

    setTwoStepPin: (
        projectId: string,
        phoneNumberId: string,
        body: SetTwoStepPinBody,
    ) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/two-step-pin`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    // ----------- /projects/:id/phone-numbers/:pnid/qr-codes/* -----------

    listQrCodes: (projectId: string, phoneNumberId: string) =>
        rustFetch<{ qrCodes: QrCode[] }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/qr-codes`,
        ),

    createQrCode: (
        projectId: string,
        phoneNumberId: string,
        body: CreateQrCodeBody,
    ) =>
        rustFetch<QrCode>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/qr-codes`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    updateQrCode: (
        projectId: string,
        phoneNumberId: string,
        code: string,
        body: UpdateQrCodeBody,
    ) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/qr-codes/${encodeURIComponent(code)}`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    deleteQrCode: (
        projectId: string,
        phoneNumberId: string,
        code: string,
    ) =>
        rustFetch<{ ok: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/qr-codes/${encodeURIComponent(code)}`,
            { method: 'DELETE' },
        ),

    // ----------- /projects/:id/widget-settings -----------

    saveWidgetSettings: (projectId: string, body: SaveWidgetSettingsBody) =>
        rustFetch<{ success: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/widget-settings`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    // ----------- /me/businesses + /waba/:wabaId/* (pre-project setup) -----------

    /**
     * `GET /v1/wachat/config/me/businesses` — proxies to Meta
     * `GET /me/businesses`. Used by the OAuth-linked WABA flow to seed
     * `businessId` when `includeCatalog=true`. The accessToken travels in
     * the query string because at call time the project doc may not exist
     * yet (the BFF therefore can't read it from Mongo).
     */
    getMeBusinesses: (accessToken: string) =>
        rustFetch<BusinessesResponse>(
            `${BASE}/me/businesses${qs({ accessToken })}`,
        ),

    /**
     * `GET /v1/wachat/config/waba/:wabaId/details` — proxies to Meta
     * `GET /{wabaId}?fields=name`. Returns the WABA's display name so the
     * OAuth-linked setup flow can seed the new project's `name` field.
     */
    getWabaDetails: (wabaId: string, accessToken: string) =>
        rustFetch<WabaDetails>(
            `${BASE}/waba/${encodeURIComponent(wabaId)}/details${qs({ accessToken })}`,
        ),

    /**
     * `POST /v1/wachat/config/waba/:wabaId/name` — proxies to Meta
     * `POST /{wabaId}` with `{ name }`. Renames the WABA on Meta's side.
     * The accessToken travels in the JSON body so it doesn't end up in
     * server access logs.
     */
    updateWabaName: (wabaId: string, accessToken: string, name: string) =>
        rustFetch<Record<string, unknown>>(
            `${BASE}/waba/${encodeURIComponent(wabaId)}/name`,
            {
                method: 'POST',
                body: JSON.stringify({ accessToken, name }),
            },
        ),
};

export type WachatConfigApi = typeof wachatConfigApi;
