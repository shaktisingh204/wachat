//! Wire DTOs (HTTP request / response shapes) the broadcast router speaks.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to match
//! the JSON shape the TS client sends. Mongo documents are returned as
//! `serde_json::Value` so the router stays out of the way when callers
//! evolve the document shape — the same approach the legacy TS code took
//! with `JSON.parse(JSON.stringify(...))`.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Pagination + simple envelopes
// ---------------------------------------------------------------------------

/// `?page=&limit=` query for paginated list endpoints.
///
/// Both fields default to the same values the TS server actions used so
/// callers that don't pass them get identical behaviour.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
}

fn default_page() -> u64 {
    1
}
fn default_limit() -> u64 {
    20
}

/// `?page=&limit=&statusFilter=` query — used by the per-broadcast
/// attempts list. `statusFilter` mirrors the legacy semantics:
/// any value other than `"ALL"` (or the absent value) is matched
/// exactly against `broadcast_contacts.status`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttemptsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_attempts_limit")]
    pub limit: u64,
    #[serde(default)]
    pub status_filter: Option<String>,
}

fn default_attempts_limit() -> u64 {
    50
}

/// `?statusFilter=` query for `attempts/export`. No pagination — the
/// export path is meant to drain the whole filtered set into a CSV/XLSX.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttemptsExportQuery {
    #[serde(default)]
    pub status_filter: Option<String>,
}

/// `{ broadcasts, total }` — list-shape envelope.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastListResponse {
    pub broadcasts: Vec<Value>,
    pub total: u64,
}

/// `{ attempts, total }` — list-shape envelope for the attempts page.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttemptsListResponse {
    pub attempts: Vec<Value>,
    pub total: u64,
}

/// Result envelope for actions that historically returned
/// `{ message?, error? }` in the TS (`handleStart*`, `handleStop`,
/// `handleRequeue`). Errors flow through `ApiError` instead of an
/// in-band `error` string, so this envelope only carries the success
/// message — the TS shim wraps thrown `RustApiError` back into the
/// `{ error }` shape its callers expect.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}

// ---------------------------------------------------------------------------
// Per-contact record sent into `broadcast_contacts`
// ---------------------------------------------------------------------------

/// A single recipient row written into the `broadcast_contacts`
/// collection. Mirrors the shape `parseContactFile` produced in TS:
/// `phone` + `name` + a free-form `variables` map carrying every column
/// from the source CSV (used by the worker for body-variable
/// substitution).
///
/// `phone` is required — the TS code threw if it was missing.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactRecord {
    pub phone: String,
    #[serde(default)]
    pub name: Option<String>,
    /// Per-row template variables. Open-ended JSON so the worker can
    /// resolve any `{{varN}}` placeholder by column name.
    #[serde(default)]
    pub variables: Value,
}

// ---------------------------------------------------------------------------
// `POST /start` — handleStartBroadcast
// ---------------------------------------------------------------------------

/// Body for `POST /v1/wachat/broadcast/start`.
///
/// The TS server action took multipart `FormData`. We accept the
/// **already-parsed** JSON payload here:
///
///   * CSV / XLSX is parsed by the TS shim and forwarded as `contacts`.
///   * Header / carousel media is uploaded to Meta by the TS shim and
///     forwarded as `components` with the resolved `media id` already
///     baked in.
///
/// Tag-driven audiences are resolved server-side because they do **not**
/// require any out-of-band file I/O — `tagIds` are a pure Mongo lookup.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartBroadcastBody {
    pub project_id: String,
    pub phone_number_id: String,

    /// `template` or `flow`.
    pub broadcast_type: BroadcastKind,

    /// Required when `broadcast_type == "template"`.
    #[serde(default)]
    pub template_id: Option<String>,

    /// Required when `broadcast_type == "flow"`.
    #[serde(default)]
    pub flow_id: Option<String>,

    /// `file` (contacts pre-parsed from CSV) or `tags` (resolved here).
    pub audience_type: AudienceType,

    /// Set when `audience_type == "file"` — the parsed contact rows.
    #[serde(default)]
    pub contacts: Vec<ContactRecord>,

    /// Set when `audience_type == "tags"`. Hex `ObjectId` strings.
    #[serde(default)]
    pub tag_ids: Vec<String>,

    /// File name to record on the broadcast doc. For `tags` audiences
    /// the TS used the literal `"Audience Tag"`, which the shim should
    /// continue to pass through.
    pub file_name: String,

    /// Optional override for messages-per-second. Falls back to the
    /// project default; finally to `BROADCAST_DEFAULT_MPS` in the
    /// worker.
    #[serde(default)]
    pub messages_per_second: Option<u32>,

    /// Whether the broadcast worker should also create CRM contacts for
    /// every recipient. Defaults to `false` — the TS form defaulted to
    /// "no" to avoid polluting CRM.
    #[serde(default)]
    pub create_contacts: bool,

    /// Pre-resolved template `components` array (with header media ids
    /// already substituted in by the TS shim). Forwarded verbatim onto
    /// the broadcast document so the worker doesn't need to refetch the
    /// template.
    #[serde(default)]
    pub components: Vec<Value>,

    /// Optional `globalBodyVars` map — copied from the form when the
    /// user typed a static value into a body variable input.
    #[serde(default)]
    pub global_body_vars: Option<Value>,

    /// Used when `broadcast_type == "flow"`. Mirrors the legacy
    /// `flowConfig` shape (`header / body / footer / cta`).
    #[serde(default)]
    pub flow_config: Option<Value>,

    /// Display name + meta id of the flow being sent (for the audit
    /// trail — the worker reads `flowMetaId` to talk to Meta).
    #[serde(default)]
    pub flow_name: Option<String>,
    #[serde(default)]
    pub flow_meta_id: Option<String>,
}

/// Discriminator for `broadcastType`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BroadcastKind {
    Template,
    Flow,
}

impl BroadcastKind {
    pub fn as_str(self) -> &'static str {
        match self {
            BroadcastKind::Template => "template",
            BroadcastKind::Flow => "flow",
        }
    }
}

/// Discriminator for `audienceType`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudienceType {
    File,
    Tags,
}

impl AudienceType {
    pub fn as_str(self) -> &'static str {
        match self {
            AudienceType::File => "file",
            AudienceType::Tags => "tags",
        }
    }
}

// ---------------------------------------------------------------------------
// `POST /bulk-start` — handleBulkBroadcast
// ---------------------------------------------------------------------------

/// Body for `POST /v1/wachat/broadcast/bulk-start`.
///
/// Each project picks its own slice of `contacts` (the TS code split the
/// list evenly across project ids). We push that splitting decision
/// **down** to Rust so the call shape stays simple — the TS client sends
/// the full parsed CSV plus the project list and we partition.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkBroadcastBody {
    /// Hex `ObjectId` strings.
    pub project_ids: Vec<String>,
    pub template_name: String,
    pub language: String,
    pub file_name: String,
    pub contacts: Vec<ContactRecord>,
}

// ---------------------------------------------------------------------------
// `POST /api-start` — handleStartApiBroadcast
// ---------------------------------------------------------------------------

/// Body for `POST /v1/wachat/broadcast/api-start`.
///
/// Mirrors the public API endpoint in `app/api/v1/broadcasts/start-bulk`
/// — variable mappings are passed through to the broadcast doc so the
/// worker can still resolve column-to-variable mappings the same way it
/// did before.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiBroadcastBody {
    pub project_id: String,
    pub phone_number_id: String,
    pub template_id: String,
    pub contacts: Vec<ContactRecord>,
    #[serde(default)]
    pub variable_mappings: Option<Value>,
}

// ---------------------------------------------------------------------------
// `POST /{broadcast_id}/requeue` — handleRequeueBroadcast
// ---------------------------------------------------------------------------

/// Body for `POST /v1/wachat/broadcast/{broadcast_id}/requeue`.
///
/// The legacy form had `requeueScope = ALL | FAILED`, plus an optional
/// new `templateId` and optional `headerImageUrl`. We mirror that here
/// so the call is a 1:1 replacement.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequeueBroadcastBody {
    /// `ALL` (default) or `FAILED`.
    #[serde(default = "default_requeue_scope")]
    pub requeue_scope: String,
    /// Optional override — if absent, the original broadcast's
    /// `templateId` is reused.
    #[serde(default)]
    pub template_id: Option<String>,
    /// Optional header image URL forwarded to the new broadcast doc.
    #[serde(default)]
    pub header_image_url: Option<String>,
}

fn default_requeue_scope() -> String {
    "ALL".to_owned()
}

// ---------------------------------------------------------------------------
// `POST /admin/requeue-stuck` — cron sweep
// ---------------------------------------------------------------------------

/// Result envelope for the stuck-broadcast sweep. Mirrors the JSON the
/// legacy TS cron at `/api/cron/send-broadcasts` returned so the Next
/// route can stay shape-compatible after migration.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequeueStuckResponse {
    /// Human-readable summary, e.g. `"Re-enqueued 3 of 5 stuck broadcast(s)."`.
    pub message: String,
    /// How many of the candidates were successfully re-enqueued.
    pub enqueued: u64,
    /// How many candidate documents were inspected.
    pub considered: u64,
    /// Per-broadcast error strings, present only when at least one
    /// re-enqueue failed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<String>>,
}
