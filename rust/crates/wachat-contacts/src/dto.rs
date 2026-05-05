//! Wire-format DTOs for the wachat contacts endpoints.
//!
//! Mirrors the FormData / function-argument shapes in
//! `src/app/actions/contact.actions.ts`. Every body / query uses
//! `#[serde(rename_all = "camelCase")]` to match the JSON the TS shim
//! sends.
//!
//! Stored documents are returned as `serde_json::Value` so the router
//! stays out of the way when callers evolve the document shape — the
//! same approach the legacy TS code took with
//! `JSON.parse(JSON.stringify(...))`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/// Page size constant kept in lockstep with the legacy TS
/// `CONTACTS_PER_PAGE = 20`.
pub const CONTACTS_PER_PAGE: i64 = 20;

fn default_page() -> u64 {
    1
}

// ---------------------------------------------------------------------------
// `POST /v1/contacts` — handleAddNewContact
// ---------------------------------------------------------------------------

/// Body for `POST /v1/contacts` — mirrors the `FormData` shape the TS
/// `handleAddNewContact` expected. The TS shim is responsible for
/// flattening multipart form fields into this JSON payload.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddContactBody {
    pub project_id: String,
    pub phone_number_id: String,
    pub name: String,
    /// E.164 country code (digits and `+` allowed; we strip non-digits).
    pub country_code: String,
    /// Local subscriber number (digits + spaces / dashes allowed).
    pub phone: String,
    /// Optional list of hex `ObjectId` strings for tag attachment.
    #[serde(default)]
    pub tag_ids: Vec<String>,
}

/// Response envelope for `POST /v1/contacts`. The legacy TS returned
/// `{ message?, contactId? }` on success — we mirror that 1:1 so the
/// shim's own `{ message?, error? }` envelope can pass it through.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddContactResponse {
    pub message: String,
    pub contact_id: String,
}

// ---------------------------------------------------------------------------
// `GET /v1/contacts` — getContactsPageData
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/contacts`. Mirrors the
/// `getContactsPageData(projectId, phoneNumberId?, page?, search?, tagIds?)`
/// argument set.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListContactsQuery {
    /// Required — hex `ObjectId` string identifying the project scope.
    pub project_id: String,
    /// Optional phone-number scope (a single project can have multiple
    /// connected numbers).
    #[serde(default)]
    pub phone_number_id: Option<String>,
    /// 1-indexed page (matches the TS default of 1).
    #[serde(default = "default_page")]
    pub page: u64,
    /// Case-insensitive substring match against `name` and `waId`.
    #[serde(default)]
    pub search: Option<String>,
    /// Optional comma-separated list of tag hex `ObjectId` strings. The
    /// TS server action accepted `tagIds: string[]`; over the wire we
    /// flatten to a single comma-delimited string so the URL stays
    /// readable. Empty / missing values disable the filter.
    #[serde(default)]
    pub tag_ids: Option<String>,
}

/// Response body for `GET /v1/contacts`. Returns the raw stored
/// documents (with ObjectIds rendered as hex strings and dates as ISO
/// 8601) so the caller can drive existing UI that already understands
/// the `Contact` shape.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListContactsResponse {
    #[schema(value_type = Vec<Object>)]
    pub contacts: Vec<Value>,
    pub total: u64,
}

// ---------------------------------------------------------------------------
// `POST /v1/contacts/import` — handleImportContacts
// ---------------------------------------------------------------------------

/// Body for `POST /v1/contacts/import`. The legacy TS server action
/// took a multipart `File` and ran `papaparse`. We push CSV parsing
/// **out** to the TS shim so the wire payload stays JSON — the shim
/// forwards an array of pre-parsed rows.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ImportContactsBody {
    pub project_id: String,
    pub phone_number_id: String,
    /// Pre-parsed rows from the source CSV / XLSX. Each row is a free-
    /// form JSON object — `phone` and `name` are the canonical fields;
    /// every other key flows into `variables` on the upserted contact.
    #[serde(default)]
    pub contacts: Vec<Value>,
}

/// Response envelope for `POST /v1/contacts/import`. Mirrors the TS
/// "Import complete. {imported} contacts imported/updated. {skipped}
/// rows skipped." string verbatim under `message`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ImportContactsResponse {
    pub message: String,
    pub imported: u64,
    pub skipped: u64,
}

// ---------------------------------------------------------------------------
// `PATCH /v1/contacts/:id` — handleUpdateContactDetails
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/contacts/:id`. Either field is optional: the TS
/// only `$set`s the fields that were provided.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContactDetailsBody {
    /// Optional name update.
    #[serde(default)]
    pub name: Option<String>,
    /// Optional free-form variables map.
    #[serde(default)]
    pub variables: Option<Value>,
}

// ---------------------------------------------------------------------------
// `PATCH /v1/contacts/:id/status` — handleUpdateContactStatus
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/contacts/:id/status`. Setting
/// `assignedAgentId` to `None` clears the assignment (mirrors the TS
/// `else { updateDoc.assignedAgentId = null; }`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContactStatusBody {
    pub status: String,
    #[serde(default)]
    pub assigned_agent_id: Option<String>,
}

// ---------------------------------------------------------------------------
// `PATCH /v1/contacts/:id/tags` — updateContactTags
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/contacts/:id/tags`. The TS function takes a
/// `string[]` and `$set`s `tagIds` to the cast `ObjectId[]`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContactTagsBody {
    /// Hex `ObjectId` strings.
    #[serde(default)]
    pub tag_ids: Vec<String>,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by every PATCH / DELETE endpoint
/// — matches the legacy TS server-action return type.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
