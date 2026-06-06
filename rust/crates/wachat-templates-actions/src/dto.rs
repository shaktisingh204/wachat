//! Wire DTOs for the templates-actions facade.
//!
//! Every response shape matches the Next.js Server Action contract — i.e.
//! a `useActionState` reducer payload of `{ message?, error?, … }`. The
//! TS shim layer does not have to reshape anything.

use serde::{Deserialize, Serialize};
use wachat_templates_categories::SaveLibraryTemplateReq;
use wachat_templates_mutate::{HeaderFormat, TemplateButton};
use wachat_types::{Template, TemplateCategory};

// ---------------------------------------------------------------------------
// Query strings
// ---------------------------------------------------------------------------

/// `?project_id=<hex>` — used by `GET /list`.
///
/// Accepts both snake_case (`project_id`, what the TS client sends) and
/// camelCase (`projectId`) so the endpoint is forgiving of either style.
/// We deliberately do NOT put `rename_all = "camelCase"` at the struct
/// level here — that would silently flip the primary to `projectId` and
/// break the existing `project_id=…` callers.
#[derive(Debug, Clone, Deserialize)]
pub struct ProjectIdQuery {
    #[serde(alias = "projectId")]
    pub project_id: String,
}

// ---------------------------------------------------------------------------
// Generic action-state envelope (`{ message?, error? }`).
// ---------------------------------------------------------------------------

/// Mirror of the Next.js action-state pattern:
/// ```ts
/// type CreateTemplateState = { message?: string; error?: string }
/// ```
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionState {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl ActionState {
    pub fn ok(msg: impl Into<String>) -> Self {
        Self {
            message: Some(msg.into()),
            error: None,
        }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        Self {
            message: None,
            error: Some(msg.into()),
        }
    }
}

// ---------------------------------------------------------------------------
// Reusable wire-create body (mirrors wachat-templates-router::dto::CreateTemplateBody
// but redefined locally to avoid coupling).
// ---------------------------------------------------------------------------

/// Wire-create payload — matches the canonical router's `CreateTemplateBody`
/// 1:1 so a future codegen pass can dedupe.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireCreate {
    pub project_id: String,
    pub name: String,
    pub language: String,
    pub category: TemplateCategory,
    pub body: String,
    #[serde(default)]
    pub body_examples: Vec<String>,
    #[serde(default)]
    pub footer: Option<String>,
    pub header_format: HeaderFormat,
    #[serde(default)]
    pub header_text: Option<String>,
    #[serde(default)]
    pub header_example: Option<String>,
    #[serde(default)]
    pub header_media_url: Option<String>,
    #[serde(default)]
    pub buttons: Vec<TemplateButton>,
    #[serde(default = "default_true")]
    pub allow_category_change: bool,
}

fn default_true() -> bool {
    true
}

// ---------------------------------------------------------------------------
// `POST /sync` — `handleSyncTemplates`
// ---------------------------------------------------------------------------

/// Body for `POST /sync`. Mirrors the Server Action `handleSyncTemplates`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncBody {
    pub project_id: String,
}

/// Response for `POST /sync` — TS shape:
/// `{ message?: string, error?: string, count?: number }`.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncActionResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<usize>,
}

// ---------------------------------------------------------------------------
// `POST /create` — `handleCreateTemplate`
// ---------------------------------------------------------------------------

/// Body for `POST /create`.
pub type CreateBody = WireCreate;

// ---------------------------------------------------------------------------
// `POST /bulk-create` — `handleBulkCreateTemplate`
// ---------------------------------------------------------------------------

/// Body for `POST /bulk-create`. Carries the field set of a single create
/// plus the list of project ids to write into.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCreateBody {
    pub project_ids: Vec<String>,
    pub name: String,
    pub language: String,
    pub category: TemplateCategory,
    pub body: String,
    #[serde(default)]
    pub body_examples: Vec<String>,
    #[serde(default)]
    pub footer: Option<String>,
    pub header_format: HeaderFormat,
    #[serde(default)]
    pub header_text: Option<String>,
    #[serde(default)]
    pub header_example: Option<String>,
    #[serde(default)]
    pub header_media_url: Option<String>,
    #[serde(default)]
    pub buttons: Vec<TemplateButton>,
    #[serde(default = "default_true")]
    pub allow_category_change: bool,
}

/// Response for `POST /bulk-create` — TS shape is `{ message?, error? }`,
/// but the TS builds the user-facing message from `applied`/`skipped` so
/// we expose those here too. The TS shim re-builds the exact message.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCreateActionResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applied: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub successes: Option<usize>,
}

// ---------------------------------------------------------------------------
// `POST /create-flow` — `handleCreateFlowTemplate`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFlowBody {
    pub project_id: String,
    pub flow_id: String,
    pub template_name: String,
    pub language: String,
    pub category: TemplateCategory,
    pub body_text: String,
    pub button_text: String,
}

/// Response carries the freshly created template (so the TS can use
/// `r.name` in the message string verbatim).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFlowActionResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /library/save` — `saveLibraryTemplate`
// ---------------------------------------------------------------------------

/// Body for `POST /library/save` — re-export of the engine DTO.
pub type LibrarySaveBody = SaveLibraryTemplateReq;

// ---------------------------------------------------------------------------
// `POST /library/{id}/apply` — `handleApplyTemplateToProjects`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyBody {
    pub target_project_ids: Vec<String>,
}

/// Response for `POST /library/{id}/apply` — exact TS shape:
/// `{ success: boolean, error?: string, applied?: number, skipped?: number }`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyActionResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applied: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<usize>,
}

// ---------------------------------------------------------------------------
// `POST /edit` — `handleEditTemplate`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditBody {
    pub project_id: String,
    pub meta_template_id: String,
    #[serde(default)]
    pub category: Option<TemplateCategory>,
    #[serde(default)]
    pub header_format: Option<HeaderFormat>,
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
    pub buttons: Option<Vec<TemplateButton>>,
}

// ---------------------------------------------------------------------------
// `POST /delete-by-name` — `handleDeleteTemplate`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteByNameBody {
    pub project_id: String,
    pub template_name: String,
    #[serde(default)]
    pub meta_template_id: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /delete-by-id` — `handleDeleteTemplateById`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteByIdBody {
    pub project_id: String,
    pub meta_template_id: String,
}

// ---------------------------------------------------------------------------
// `GET /list` response — full Template documents
// ---------------------------------------------------------------------------

pub type TemplatesList = Vec<Template>;

// ---------------------------------------------------------------------------
// `POST /multilang/clone` — create one copy of a source template per
// target language via Meta.
// ---------------------------------------------------------------------------

/// Body for `POST /multilang/clone`.
///
/// Exactly one of `source_template_id` / `source_template_name` must be
/// provided to identify the source; `target_languages` lists the Meta
/// locale codes (`en_US`, `hi`, `pt_BR`, …) to create copies in.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiLangCloneBody {
    pub project_id: String,
    #[serde(default)]
    pub source_template_id: Option<String>,
    #[serde(default)]
    pub source_template_name: Option<String>,
    #[serde(default)]
    pub target_languages: Vec<String>,
}

/// Per-language clone outcome — `status` is one of `created`, `failed`,
/// or `skipped`; `error` carries the reason for non-`created` rows.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneOutcome {
    pub language: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Meta-assigned template id on success.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta_id: Option<String>,
}

impl CloneOutcome {
    /// Build a `failed` outcome with a reason.
    pub fn failed(language: impl Into<String>, error: impl Into<String>) -> Self {
        Self {
            language: language.into(),
            status: "failed".to_owned(),
            error: Some(error.into()),
            meta_id: None,
        }
    }
}

/// Response for `POST /multilang/clone` — the per-language outcome array
/// plus convenience counts and an echo of the resolved source.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiLangCloneResult {
    pub source_name: String,
    pub source_language: String,
    pub created: usize,
    pub failed: usize,
    pub outcomes: Vec<CloneOutcome>,
}
