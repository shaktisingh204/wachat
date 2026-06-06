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
// `GET /v1/contacts/kanban` — getKanbanData (contacts-domain board)
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/contacts/kanban`. Mirrors the native
/// `getKanbanData(projectId)` argument plus an optional `phoneNumberId`
/// scope so a single project with several connected numbers can show a
/// per-number board.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct KanbanQuery {
    /// Required — hex `ObjectId` string identifying the project scope.
    pub project_id: String,
    /// Optional phone-number scope (a project can connect multiple
    /// numbers). Empty / missing means "all numbers in the project".
    #[serde(default)]
    pub phone_number_id: Option<String>,
}

/// One kanban column. `id` is the stable status slug the move handler
/// (`PATCH /{id}/status`) writes back; `title` is the human label the
/// board renders. `contacts` are the raw stored contact documents
/// (ObjectIds → hex, dates → ISO 8601) so the existing board, which
/// already understands the `Contact` shape (`_id`, `name`, `waId`,
/// `unreadCount`, `lastMessage`, `lastMessageTimestamp`,
/// `assignedAgentId`, `status`), can drive it unchanged.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct KanbanColumn {
    /// Stable status slug — the value `PATCH /{id}/status` persists.
    pub id: String,
    /// Human-facing column label (currently identical to `id`).
    pub title: String,
    #[schema(value_type = Vec<Object>)]
    pub contacts: Vec<Value>,
}

/// Response body for `GET /v1/contacts/kanban`. The board reads
/// `columns[].contacts`; the column ordering mirrors the native
/// `getKanbanData` (default statuses first, then any custom
/// `kanbanStatuses` saved on the project, deduped).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct KanbanResponse {
    pub columns: Vec<KanbanColumn>,
}

// ---------------------------------------------------------------------------
// `POST /v1/contacts/kanban/statuses` — saveKanbanStatuses
// ---------------------------------------------------------------------------

/// Body for `POST /v1/contacts/kanban/statuses`. Mirrors the native
/// `saveKanbanStatuses(projectId, statuses)` — the caller sends the full
/// list of column names currently on the board; the default statuses
/// (`new`, `open`, `resolved`) are stripped before persisting so only
/// the user-added custom lists land in `projects.kanbanStatuses`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SaveKanbanStatusesBody {
    /// Required — hex `ObjectId` string identifying the project scope.
    pub project_id: String,
    /// Full list of column names on the board (defaults + custom).
    #[serde(default)]
    pub statuses: Vec<String>,
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
