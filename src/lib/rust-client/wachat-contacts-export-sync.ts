/**
 * Client for the Wachat **contacts export + sync** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/contacts-export-sync` by
 * the `wachat-contacts-export-sync` crate. These back the "Export CSV"
 * button and the "Sync Contacts" dialog on `/wachat/contacts`:
 *
 *   GET  /export        → stream ALL matching contacts as CSV (local)
 *   POST /sync/vcard    → parse a vCard + bulk-upsert contacts (local)
 *   POST /sync/google   → Google Contacts sync — gated (external seam)
 *   POST /sync/shopify  → Shopify Customers sync — gated (external seam)
 *
 * The sync endpoints return a JSON {@link SyncResponse} envelope; the
 * export endpoint streams raw CSV (no JSON body), so it is exposed here as
 * a pure **path builder** (`exportPath`) and consumed through the thin
 * `/api/wachat/contacts/export` route, which forwards the stream verbatim.
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/contacts-export-sync';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — every Rust handler uses
// `serde(rename_all = "camelCase")`, so the wire shapes are camelCase).
// ---------------------------------------------------------------------------

/**
 * Filter for `GET /export`. Mirrors the contacts-page filter set. Empty /
 * undefined optional fields disable the corresponding filter.
 */
export interface ContactsExportFilter {
    /** Required — hex `ObjectId` string identifying the project scope. */
    projectId: string;
    /** Optional phone-number scope (a project can have multiple numbers). */
    phoneNumberId?: string;
    /** Optional tag hex `ObjectId` strings; serialized to `?tagIds=a,b,c`. */
    tagIds?: string[];
}

/**
 * Body for `POST /sync/vcard` — the device "Sync Contacts (vCard)" source.
 * The raw `.vcf` text is parsed server-side into `FN`/`TEL` pairs.
 */
export interface VcardSyncBody {
    /** Required — hex `ObjectId` string identifying the project scope. */
    projectId: string;
    /** Required — the phone-number id the imported contacts belong to. */
    phoneNumberId: string;
    /** Raw vCard 2.1 / 3.0 / 4.0 text (one or many `BEGIN:VCARD` blocks). */
    vcard: string;
}

/**
 * Body for `POST /sync/google` and `POST /sync/shopify`. Both require
 * stored OAuth / integration credentials; with none present (the current
 * state) the Rust handler rejects with `400 Bad Request`
 * ("Google/Shopify not connected").
 */
export interface IntegrationSyncBody {
    /** Required — hex `ObjectId` string identifying the project scope. */
    projectId: string;
    /** Required — the phone-number id the imported contacts belong to. */
    phoneNumberId: string;
}

/**
 * Response envelope shared by every `POST /sync/*` endpoint. Mirrors the
 * contacts-import shape so the existing `{ message }` toast wiring reuses.
 */
export interface SyncResponse {
    /** Human-readable summary (e.g. "Sync complete. 12 imported. 3 skipped."). */
    message: string;
    /** Rows upserted (inserted or updated). */
    imported: number;
    /** Rows skipped (missing name / phone, unparseable). */
    skipped: number;
}

// ---------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------

/**
 * Build the relative Rust path for `GET /export`, encoding every query
 * value. The `/api/wachat/contacts/export` route forwards this verbatim
 * via `rustFetchAsUser` so the CSV stream survives untouched (a plain
 * `rustFetch` would try to `JSON.parse` the CSV body and throw).
 */
function exportPath(filter: ContactsExportFilter): string {
    const params = new URLSearchParams();
    params.set('projectId', filter.projectId);
    if (filter.phoneNumberId) {
        params.set('phoneNumberId', filter.phoneNumberId);
    }
    const tagIds = (filter.tagIds ?? []).filter(Boolean);
    if (tagIds.length > 0) {
        params.set('tagIds', tagIds.join(','));
    }
    return `${BASE}/export?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatContactsExportSyncApi = {
    /** Relative Rust path for the CSV export (consumed by the API route). */
    exportPath,

    /** `POST /sync/vcard` — parse a vCard blob + bulk-upsert contacts. */
    syncVcard: (body: VcardSyncBody) =>
        rustFetch<SyncResponse>(`${BASE}/sync/vcard`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `POST /sync/google` — gated Google Contacts sync. */
    syncGoogle: (body: IntegrationSyncBody) =>
        rustFetch<SyncResponse>(`${BASE}/sync/google`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `POST /sync/shopify` — gated Shopify Customers sync. */
    syncShopify: (body: IntegrationSyncBody) =>
        rustFetch<SyncResponse>(`${BASE}/sync/shopify`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

export type WachatContactsExportSyncApi = typeof wachatContactsExportSyncApi;
