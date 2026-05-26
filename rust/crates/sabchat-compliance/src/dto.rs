//! Wire-format DTOs for the SabChat compliance endpoints.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to
//! match the JSON the Next.js shim sends. Stored documents are returned
//! as `serde_json::Value` so the router stays out of the way when
//! callers evolve the document shape — same approach the audit / inbox
//! crates take.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults / limits
// ---------------------------------------------------------------------------

/// Hard cap on the page size for `GET /dsr` and `GET /retention`. Keeps
/// the dashboard's "show all" mode bounded even if the caller passes a
/// silly `limit`.
pub const MAX_LIMIT: i64 = 200;

/// Default page size when `limit` is missing or zero.
pub const DEFAULT_LIMIT: i64 = 50;

fn default_limit() -> i64 {
    DEFAULT_LIMIT
}

// ===========================================================================
// Data subject requests
// ===========================================================================

/// Body for `POST /dsr` — record a new pending data-subject request.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDsrBody {
    /// Target contact (hex `ObjectId`). Must belong to the caller's tenant.
    pub contact_id: String,
    /// Either `"export"` or `"delete"`. Anything else is rejected with
    /// `422` so callers can't sneak unknown verbs into the queue.
    pub kind: String,
    /// Optional free-form actor label (email / agent id) — recorded on
    /// the request row for downstream audit. Defaults to the JWT subject
    /// when absent.
    #[serde(default)]
    pub requested_by: Option<String>,
}

/// Response for `POST /dsr` — the freshly-created row's id + status.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDsrResponse {
    pub id: String,
    pub status: String,
}

/// Query string for `GET /dsr` — paginated list with optional status
/// filter. Cursor pagination over `_id`, newest first.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDsrQuery {
    /// Optional status filter (`pending`, `running`, `done`, `failed`).
    #[serde(default)]
    pub status: Option<String>,
    /// Page size. Clamped to `[1, MAX_LIMIT]` server-side.
    #[serde(default = "default_limit")]
    pub limit: i64,
    /// Cursor — hex `ObjectId` of the last row from the previous page.
    /// Pass `nextCursor` from the previous response.
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response for `GET /dsr` — request rows + the cursor for the next
/// page (`None` when the page is short).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDsrResponse {
    #[schema(value_type = Vec<Object>)]
    pub requests: Vec<Value>,
    #[serde(default)]
    pub next_cursor: Option<String>,
}

/// Response for `POST /dsr/{id}/run` — the terminal status + (for
/// exports) the id of the row in `sabchat_dsr_exports` holding the
/// aggregated payload.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunDsrResponse {
    pub id: String,
    pub status: String,
    #[serde(default)]
    pub payload_id: Option<String>,
}

// ===========================================================================
// Retention rules
// ===========================================================================

/// Body for `POST /retention` — create a new retention rule.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRetentionRuleBody {
    /// One of `messages` | `conversations` | `events` | `audit_log`.
    /// Anything else fails validation.
    pub target: String,
    /// Rows older than this many days are pruned by the next sweep.
    pub older_than_days: i64,
    /// Defaults to `true`. Inactive rules are kept for audit but
    /// skipped by the sweep.
    #[serde(default = "default_true")]
    pub active: bool,
}

fn default_true() -> bool {
    true
}

/// Body for `PATCH /retention/{id}` — partial update. Every field is
/// optional; only present fields land in the `$set` document.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRetentionRuleBody {
    #[serde(default)]
    pub target: Option<String>,
    #[serde(default)]
    pub older_than_days: Option<i64>,
    #[serde(default)]
    pub active: Option<bool>,
}

/// Response wrapping a single retention rule row.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RetentionRuleResponse {
    #[schema(value_type = Object)]
    pub rule: Value,
}

/// Response for `GET /retention` — every rule (no pagination, the row
/// count is small in practice; tenants have one rule per `target` at
/// most).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRetentionRulesResponse {
    #[schema(value_type = Vec<Object>)]
    pub rules: Vec<Value>,
}

/// One entry in the `POST /retention/sweep` response — the rule id and
/// how many rows the sweep removed for that target.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SweepEntry {
    pub rule_id: String,
    pub deleted: u64,
}

// ===========================================================================
// PII utility
// ===========================================================================

/// Body for `POST /redact-text` — single string in, masked string out.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RedactTextBody {
    pub text: String,
}

/// Response for `POST /redact-text`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RedactTextResponse {
    pub redacted: String,
}

// ===========================================================================
// Shared success envelope
// ===========================================================================

/// `{ success: true }` shape returned by DELETE + PATCH endpoints.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
