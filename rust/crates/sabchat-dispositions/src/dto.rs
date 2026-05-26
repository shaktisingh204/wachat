//! Wire-format DTOs for the SabChat dispositions endpoints.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` so the
//! payloads match the camelCase JSON used by the Next.js side. Stored
//! documents are returned as `serde_json::Value` (rendered via
//! [`sabnode_db::document_to_clean_json`]) so the router stays out of
//! the way as document shapes evolve — same pattern used by the sister
//! `sabchat-teams` / `wachat-contacts` crates.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /` — create
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/dispositions` — create a disposition.
///
/// `code` is the stable machine identifier (kebab-case / snake_case) the
/// app stores on conversations; `label` is the human-readable name shown
/// in the UI. `parent_code` makes the catalog tree-able.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDispositionBody {
    /// Stable machine identifier — written to `customAttrs.disposition.code`
    /// on the conversation. Unique per tenant.
    pub code: String,
    /// Human-readable label rendered in the agent UI.
    pub label: String,
    /// Optional parent `code` for nested catalogs (e.g.
    /// `sale_won` > `sale_won.upsell`).
    #[serde(default)]
    pub parent_code: Option<String>,
    /// Optional UI swatch — hex string, kept opaque server-side.
    #[serde(default)]
    pub color: Option<String>,
    /// If `true`, the apply endpoint rejects requests that omit a note
    /// with a 422.
    #[serde(default)]
    pub required_note: bool,
    /// Catalog sort order. Lower values render first.
    #[serde(default)]
    pub sort_order: i32,
}

/// Response for `POST /v1/sabchat/dispositions`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDispositionResponse {
    pub disposition_id: String,
    pub code: String,
}

// ---------------------------------------------------------------------------
// `GET /` — list
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/dispositions`. Both filters are
/// optional — omitting them returns every disposition in the tenant
/// catalog (active and soft-deleted).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDispositionsQuery {
    /// Optional `active` filter (`true` / `false`). Soft-deleted rows
    /// have `active = false`; omitting the filter returns both.
    #[serde(default)]
    pub active: Option<bool>,
    /// Optional `parentCode` filter. Pass the literal string `null` (or
    /// an empty string) to list root-level rows (`parentCode == null`).
    #[serde(default)]
    pub parent_code: Option<String>,
}

/// Response body for `GET /v1/sabchat/dispositions`. Returns the raw
/// stored documents (with ObjectIds rendered as hex strings and dates
/// as ISO 8601) so the UI can consume them directly.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDispositionsResponse {
    #[schema(value_type = Vec<Object>)]
    pub dispositions: Vec<Value>,
}

// ---------------------------------------------------------------------------
// `GET /{id}` — get
// ---------------------------------------------------------------------------

/// Response body for `GET /v1/sabchat/dispositions/{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetDispositionResponse {
    #[schema(value_type = Object)]
    pub disposition: Value,
}

// ---------------------------------------------------------------------------
// `PATCH /{id}` — update
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/sabchat/dispositions/{id}`. Every field is
/// optional — only provided fields are `$set`. Passing an empty string
/// for `parentCode` / `color` explicitly clears the field (`null`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDispositionBody {
    #[serde(default)]
    pub label: Option<String>,
    /// Empty string clears (`null`); a non-empty value sets.
    #[serde(default)]
    pub parent_code: Option<String>,
    /// Empty string clears (`null`); a non-empty value sets.
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub required_note: Option<bool>,
    #[serde(default)]
    pub active: Option<bool>,
    #[serde(default)]
    pub sort_order: Option<i32>,
}

// ---------------------------------------------------------------------------
// `POST /apply/{conversationId}` — apply
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/dispositions/apply/{conversationId}`.
///
/// * `code` must reference an existing, active disposition in the
///   calling tenant.
/// * `note` is required when the disposition's `required_note` flag is
///   set; missing in that case yields `422 Validation`.
/// * `alsoResolve = true` flips the conversation to `status = "resolved"`
///   and stamps `resolvedAt = now` in the same write — and emits a
///   `conversation_resolved` audit event.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApplyDispositionBody {
    pub code: String,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub also_resolve: bool,
}

/// Response for the apply endpoint. Returns the disposition pointer that
/// was just written to the conversation, so the caller can render it
/// without a follow-up read.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApplyDispositionResponse {
    pub disposition: DispositionPointer,
}

/// Slim "pointer" persisted on the conversation under
/// `customAttrs.disposition`. The full disposition document lives in
/// `sabchat_dispositions`; only this stub travels with the conversation.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DispositionPointer {
    pub code: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    /// Hex ObjectId of the agent who applied the disposition.
    pub set_by: String,
    pub set_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// `GET /stats` — disposition_stats
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/dispositions/stats`. Both endpoints
/// of the window are optional and inclusive; omitting them returns
/// counts across all time. Dates are ISO 8601 (e.g.
/// `2026-05-01T00:00:00Z`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DispositionStatsQuery {
    #[serde(default)]
    pub from: Option<DateTime<Utc>>,
    #[serde(default)]
    pub to: Option<DateTime<Utc>>,
}

/// One row of the stats response.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DispositionStatRow {
    pub code: String,
    pub label: String,
    pub count: u64,
}

/// Response body for `GET /v1/sabchat/dispositions/stats` — one row per
/// disposition code seen on a conversation resolved in the window.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DispositionStatsResponse {
    pub stats: Vec<DispositionStatRow>,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by every PATCH / DELETE endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
