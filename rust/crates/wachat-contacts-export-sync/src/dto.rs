//! Wire-format DTOs for the wachat contacts export + sync endpoints.
//!
//! Everything is `#[serde(rename_all = "camelCase")]` so the JSON the
//! Next.js shim sends (and the query strings the browser builds) line up
//! 1:1 with the TS surface on `/wachat/contacts`.
//!
//! The export endpoint streams raw CSV (no DTO — see [`ExportQuery`] for
//! the filter shape); the sync endpoints share a common response
//! envelope ([`SyncResponse`]).

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `GET /export` — stream all matching contacts as CSV
// ---------------------------------------------------------------------------

/// Query string for `GET /export`. Mirrors the contacts-page filter set
/// (`projectId`, optional `phoneNumberId`, optional `tagIds`). The
/// response is streamed CSV, so there is no JSON response DTO.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExportQuery {
    /// Required — hex `ObjectId` string identifying the project scope.
    pub project_id: String,
    /// Optional phone-number scope. A single project can have multiple
    /// connected numbers; empty / missing disables the filter.
    #[serde(default)]
    pub phone_number_id: Option<String>,
    /// Optional comma-separated list of tag hex `ObjectId` strings. The
    /// browser builds `?tagIds=a,b,c`; empty / missing disables the
    /// filter. (Matches the `GET /v1/contacts` query convention.)
    #[serde(default)]
    pub tag_ids: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /sync/vcard` — parse a vCard and bulk-upsert contacts
// ---------------------------------------------------------------------------

/// Body for `POST /sync/vcard`. The device "Sync Contacts (vCard)"
/// source uploads a single `.vcf` blob; we parse `FN` (display name) +
/// `TEL` (phone) pairs server-side and bulk-upsert them into `contacts`
/// keyed on `{ waId, projectId }`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VcardSyncBody {
    /// Required — hex `ObjectId` string identifying the project scope.
    pub project_id: String,
    /// Required — the phone-number id the imported contacts belong to.
    pub phone_number_id: String,
    /// Raw vCard 2.1 / 3.0 / 4.0 text (one or many `BEGIN:VCARD` blocks).
    pub vcard: String,
}

// ---------------------------------------------------------------------------
// `POST /sync/google` + `POST /sync/shopify` — gated external syncs
// ---------------------------------------------------------------------------

/// Body for `POST /sync/google` and `POST /sync/shopify`. Both require
/// stored OAuth / integration credentials on the project; the handlers
/// reject with `400 Bad Request` ("Google/Shopify not connected") when
/// those are absent.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationSyncBody {
    /// Required — hex `ObjectId` string identifying the project scope.
    pub project_id: String,
    /// Required — the phone-number id the imported contacts belong to.
    pub phone_number_id: String,
}

// ---------------------------------------------------------------------------
// Shared sync response envelope
// ---------------------------------------------------------------------------

/// Response envelope shared by every `POST /sync/*` endpoint. Mirrors
/// the contacts import shape so the Next.js shim can reuse its existing
/// `{ message }` toast wiring.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponse {
    /// Human-readable summary (e.g. "Sync complete. 12 imported. 3 skipped.").
    pub message: String,
    /// Rows upserted (inserted or updated).
    pub imported: u64,
    /// Rows skipped (missing name / phone, unparseable).
    pub skipped: u64,
}
