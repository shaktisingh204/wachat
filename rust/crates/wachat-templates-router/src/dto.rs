//! Wire DTOs (HTTP request / response shapes) that the router speaks.
//!
//! These wrap the engines' typed inputs/outputs into JSON-friendly shapes
//! a TypeScript / curl client can talk to without depending on internal
//! Rust types (e.g. `bson::oid::ObjectId` -> hex string,
//! `wachat_templates_mutate::HeaderMedia::Bytes` is impossible to send
//! over JSON, so the bulk-create endpoint accepts URL-only header media).

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use wachat_types::{Template, TemplateCategory};

// ---------------------------------------------------------------------------
// Common query strings
// ---------------------------------------------------------------------------

/// `?project_id=<hex>` — used by every per-project endpoint.
#[derive(Debug, Clone, Deserialize)]
pub struct ProjectIdQuery {
    pub project_id: String,
}

/// `?project_id=<hex>&name=<template-name>` — used by `DELETE /by-name`.
#[derive(Debug, Clone, Deserialize)]
pub struct DeleteByNameQuery {
    pub project_id: String,
    pub name: String,
}

// ---------------------------------------------------------------------------
// `POST /sync`
// ---------------------------------------------------------------------------

/// Request body for `POST /sync` and other bare-project actions.
#[derive(Debug, Clone, Deserialize)]
pub struct SyncRequest {
    pub project_id: String,
}

/// Response body for `POST /sync`.
#[derive(Debug, Clone, Serialize)]
pub struct SyncResponse {
    pub fetched: usize,
    pub upserted: usize,
    pub orphaned: usize,
}

// ---------------------------------------------------------------------------
// `POST /cron/sync-all`
// ---------------------------------------------------------------------------

/// Per-project outcome row in the cron multi-project sync response.
#[derive(Debug, Clone, Serialize)]
pub struct CronSyncProjectOutcome {
    pub project_id: String,
    pub fetched: usize,
    pub upserted: usize,
    pub orphaned: usize,
    /// Populated when the per-project sync errored. The other fields are
    /// zeroed in that case.
    pub error: Option<String>,
}

/// Response body for `POST /cron/sync-all` — one row per project we
/// attempted, plus aggregate counters for quick log scraping.
#[derive(Debug, Clone, Serialize)]
pub struct CronSyncAllResponse {
    pub projects_total: usize,
    pub projects_succeeded: usize,
    pub projects_failed: usize,
    pub projects_skipped: usize,
    pub fetched: usize,
    pub upserted: usize,
    pub results: Vec<CronSyncProjectOutcome>,
}

/// `?token=<CRON_SECRET>` — fallback auth for the cron endpoint when the
/// caller can't set headers (e.g. some scheduler setups).
#[derive(Debug, Clone, Deserialize, Default)]
pub struct CronTokenQuery {
    #[serde(default)]
    pub token: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /` — create
// ---------------------------------------------------------------------------

/// Wire-friendly create-template payload.
///
/// Mirrors `wachat_templates_mutate::CreateTemplateRequest` but accepts a
/// project id (the engine takes `&Project` directly) and a URL-only
/// header media field (bytes-from-multipart is the upload route, not
/// this JSON one).
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTemplateBody {
    pub project_id: String,
    pub name: String,
    pub language: String,
    pub category: TemplateCategory,
    pub body: String,
    #[serde(default)]
    pub body_examples: Vec<String>,
    #[serde(default)]
    pub footer: Option<String>,
    /// Wire string: `NONE | TEXT | IMAGE | VIDEO | DOCUMENT | AUDIO`.
    pub header_format: wachat_templates_mutate::HeaderFormat,
    #[serde(default)]
    pub header_text: Option<String>,
    #[serde(default)]
    pub header_example: Option<String>,
    /// Optional remote URL for media headers. Multipart uploads land on
    /// a dedicated endpoint, not this JSON route.
    #[serde(default)]
    pub header_media_url: Option<String>,
    #[serde(default)]
    pub buttons: Vec<wachat_templates_mutate::TemplateButton>,
    #[serde(default = "default_true")]
    pub allow_category_change: bool,
}

fn default_true() -> bool {
    true
}

// ---------------------------------------------------------------------------
// `POST /bulk` — bulk create
// ---------------------------------------------------------------------------

/// `POST /bulk` request body. The engine supports multiple templates per
/// call; on the wire we accept a project id + an array of create payloads.
#[derive(Debug, Clone, Deserialize)]
pub struct BulkCreateBody {
    pub project_id: String,
    pub templates: Vec<CreateTemplateBody>,
}

/// `POST /bulk` response — created templates and per-name failures.
#[derive(Debug, Clone, Serialize)]
pub struct BulkCreateResponse {
    pub created: Vec<Template>,
    pub failed: Vec<BulkFailure>,
}

/// One failed item in a bulk create.
#[derive(Debug, Clone, Serialize)]
pub struct BulkFailure {
    pub name: String,
    pub message: String,
}

// ---------------------------------------------------------------------------
// `POST /flow` — flow-button template create
// ---------------------------------------------------------------------------

/// Wire-friendly flow-template payload. Mirrors
/// `wachat_templates_mutate::CreateFlowTemplateRequest` plus a project id.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateFlowTemplateBody {
    pub project_id: String,
    pub template_name: String,
    pub language: String,
    pub category: TemplateCategory,
    pub body_text: String,
    pub button_text: String,
    pub flow_id: String,
}

// ---------------------------------------------------------------------------
// `POST /:id/edit` — edit
// ---------------------------------------------------------------------------

/// Wire-friendly edit payload. Every field is optional (Meta accepts
/// partial edits).
#[derive(Debug, Clone, Deserialize)]
pub struct EditTemplateBody {
    pub project_id: String,
    /// Meta-side template id — required, used as the URL path segment in
    /// `POST {version}/{metaTemplateId}`.
    pub meta_template_id: String,
    #[serde(default)]
    pub category: Option<TemplateCategory>,
    #[serde(default)]
    pub header_format: Option<wachat_templates_mutate::HeaderFormat>,
    #[serde(default)]
    pub header_text: Option<String>,
    #[serde(default)]
    pub header_media_url: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub body_examples: Vec<String>,
    #[serde(default)]
    pub footer: Option<String>,
    #[serde(default)]
    pub buttons: Option<Vec<wachat_templates_mutate::TemplateButton>>,
}

// ---------------------------------------------------------------------------
// `POST /:id/send` — send template message
// ---------------------------------------------------------------------------

/// Wire-friendly send payload. The path `:id` is the template id; the
/// body carries the recipient and substitution variables.
#[derive(Debug, Clone, Deserialize)]
pub struct SendTemplateBody {
    pub project_id: String,
    pub recipient_phone: String,
    /// Caller-supplied substitution variables — opaque map used by
    /// `wachat_templates_engine::Variables`.
    #[serde(default)]
    pub variables: serde_json::Value,
    /// Optional pre-uploaded Meta media id (for media-header templates).
    #[serde(default)]
    pub media_id: Option<String>,
}

/// `POST /:id/send` response — Mongo log id (hex) and Meta `wamid`.
#[derive(Debug, Clone, Serialize)]
pub struct SendResponse {
    pub message_log_id: String,
    pub wamid: String,
}

// ---------------------------------------------------------------------------
// `POST /library` — save library template
// ---------------------------------------------------------------------------

/// `POST /library` response — id of the inserted row (hex).
#[derive(Debug, Clone, Serialize)]
pub struct SaveLibraryResponse {
    pub id: String,
}

// ---------------------------------------------------------------------------
// `POST /library/:id/apply` — apply library template to N projects
// ---------------------------------------------------------------------------

/// `POST /library/:id/apply` request body — list of target project ids
/// (hex).
#[derive(Debug, Clone, Deserialize)]
pub struct ApplyLibraryBody {
    pub target_project_ids: Vec<String>,
}

/// `POST /library/:id/apply` response — counts the engine returns.
#[derive(Debug, Clone, Serialize)]
pub struct ApplyLibraryResponse {
    pub applied: usize,
    pub skipped: usize,
}

// ---------------------------------------------------------------------------
// Generic `{ ok: true }` envelope
// ---------------------------------------------------------------------------

/// Generic success envelope used by endpoints that don't return data
/// (e.g. `DELETE`s).
#[derive(Debug, Clone, Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

impl OkResponse {
    pub fn ok() -> Self {
        Self { ok: true }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Render an `ObjectId` to its hex string for JSON responses. Routers
/// always serialize ids as hex on the wire — `bson::oid::ObjectId`'s
/// default serde representation depends on the format and is not stable
/// for us.
pub fn oid_hex(oid: &ObjectId) -> String {
    oid.to_hex()
}
