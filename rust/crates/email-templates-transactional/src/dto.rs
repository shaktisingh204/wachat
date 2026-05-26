//! Wire DTOs for the transactional templates router.
//!
//! Distinct from the marketing-template crate: a transactional template
//! is **key-addressable** (the consuming code sends by `key`, not `_id`)
//! and declares an explicit `vars` schema so the dispatch site can
//! validate the merge payload before render.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

fn default_page() -> u64 { 1 }
fn default_limit() -> u64 { 20 }

// ---------------------------------------------------------------------------
// Variable schema
// ---------------------------------------------------------------------------

/// One declared merge variable on a transactional template — used both
/// for editor docs and runtime validation. `kind` mirrors a stripped
/// JSON-Schema shape (string / number / boolean / date) — anything more
/// exotic is encoded with `kind: "string"` plus a `pattern` hint.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VarSchemaEntry {
    pub name: String,
    pub kind: VarKind,
    #[serde(default)]
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VarKind {
    String,
    Number,
    Boolean,
    Date,
}

// ---------------------------------------------------------------------------
// List + CRUD bodies
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionalTemplatesQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    /// Free-form keyword match against `name`/`key`.
    #[serde(default)]
    pub q: Option<String>,
    /// Filter by archive state. Defaults to non-archived only.
    #[serde(default)]
    pub archived: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransactionalTemplateBody {
    /// Human-readable name (shown in lists). Required.
    pub name: String,
    /// Stable lookup key — used by sender code paths to address the
    /// template ("order_confirmation", "password_reset", "otp"). Must
    /// be unique per `userId`.
    pub key: String,
    pub subject: String,
    #[serde(default)]
    pub preheader: Option<String>,
    pub html_body: String,
    #[serde(default)]
    pub text_body: Option<String>,
    #[serde(default)]
    pub from_name: Option<String>,
    #[serde(default)]
    pub from_email: Option<String>,
    #[serde(default)]
    pub reply_to: Option<String>,
    #[serde(default)]
    pub vars: Vec<VarSchemaEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTransactionalTemplateBody {
    #[serde(default)]
    pub name: Option<String>,
    /// Note: changing `key` is allowed but emits a `keyHistory` entry so
    /// dispatchers that still address the old key surface a clear error.
    #[serde(default)]
    pub key: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub preheader: Option<String>,
    #[serde(default)]
    pub html_body: Option<String>,
    #[serde(default)]
    pub text_body: Option<String>,
    #[serde(default)]
    pub from_name: Option<String>,
    #[serde(default)]
    pub from_email: Option<String>,
    #[serde(default)]
    pub reply_to: Option<String>,
    #[serde(default)]
    pub vars: Option<Vec<VarSchemaEntry>>,
    #[serde(default)]
    pub archived: Option<bool>,
}

/// `POST /{id}/test-send` — render with `vars` and dispatch to the
/// supplied recipient list via the same `email-sender` queue used by
/// the campaigns crate.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestSendBody {
    pub to_emails: Vec<String>,
    #[serde(default)]
    pub vars: Value,
}

/// `POST /{id}/preview` — render-only. Returns the merged HTML + subject
/// so the UI can show a live preview while editing.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewBody {
    #[serde(default)]
    pub vars: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
    pub subject: String,
    pub html: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// Names of declared vars that were referenced in the body but
    /// missing from the `vars` payload. Empty when nothing's missing.
    #[serde(default)]
    pub missing_vars: Vec<String>,
}

// ---------------------------------------------------------------------------
// Persisted entity (returned as serde_json::Value from list/get to keep
// the router decoupled from schema evolution — matches `email-campaigns`).
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionalTemplateDoc {
    #[serde(rename = "_id")]
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub key: String,
    pub subject: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preheader: Option<String>,
    pub html_body: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_body: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<String>,
    #[serde(default)]
    pub vars: Vec<VarSchemaEntry>,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub key_history: Vec<String>,
    #[serde(default = "default_version")]
    pub version: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn default_version() -> u32 { 1 }
