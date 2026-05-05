/**
 * Client for the user-scoped QR-code maker on the Rust BFF.
 *
 * Mirrors `/v1/qr-codes/*` (NOT `/v1/wachat/config/.../qr-codes/*` — that's
 * Meta's `/message_qrdls` for WhatsApp messaging, a different system). The
 * routes here back the legacy `qr-code.actions.ts` server actions that drive
 * `/dashboard/qr-code-maker`:
 *
 *   GET    /v1/qr-codes/                → listQrCodes
 *   POST   /v1/qr-codes/                → createQrCode
 *   POST   /v1/qr-codes/delete-many     → deleteManyQrCodes
 *   DELETE /v1/qr-codes/{id}            → deleteQrCode
 *
 * Server-only — uses the shared JWT-issuing fetcher so the AuthUser's
 * `user_id` becomes the Mongo `userId` filter on the Rust side. There is no
 * project scope here: saved QR codes are owned by the user, not a project.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/qr-codes';

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/**
 * Body for `POST /v1/qr-codes/`. Mirrors `qr_codes::store::CreateBody` —
 * camelCase over the wire because the Rust struct uses
 * `serde(rename_all = "camelCase")`.
 *
 * `data` and `config` are passed through verbatim as JSON; the Rust side
 * stores them as embedded BSON documents so the legacy reader (which used
 * `JSON.parse(JSON.stringify(...))` for serialization) keeps working.
 */
export interface QrCodeCreateBody {
    name: string;
    /** One of `url` | `text` | `email` | `phone` | `sms` | `wifi`. */
    dataType: string;
    /** Free-form payload. For `url` types this is `{ url: "..." }`. */
    data: Record<string, unknown>;
    /** Visual config: `{ color, bgColor, eccLevel, size }`. */
    config: Record<string, unknown>;
    tagIds?: string[];
    isDynamic?: boolean;
}

/** Body for `POST /v1/qr-codes/delete-many`. */
export interface QrCodeDeleteManyBody {
    ids: string[];
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * Result of `POST /v1/qr-codes/`. Matches the legacy server-action contract
 * (`{ message?, error?, qrCodeUrl? }`) so call sites don't change.
 */
export interface QrCodeCreateResult {
    message?: string;
    error?: string;
    qrCodeUrl?: string;
}

/** Result of `POST /v1/qr-codes/delete-many`. */
export interface QrCodeDeleteManyResult {
    success: boolean;
    deleted?: number;
    error?: string;
}

/** Result of `DELETE /v1/qr-codes/{id}`. */
export interface QrCodeDeleteOneResult {
    success: boolean;
    error?: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const qrCodesApi = {
    list: <T = unknown>() => rustFetch<T[]>(`${BASE}/`),

    create: (body: QrCodeCreateBody) =>
        rustFetch<QrCodeCreateResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteMany: (body: QrCodeDeleteManyBody) =>
        rustFetch<QrCodeDeleteManyResult>(`${BASE}/delete-many`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<QrCodeDeleteOneResult>(
            `${BASE}/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};

export type QrCodesApi = typeof qrCodesApi;
