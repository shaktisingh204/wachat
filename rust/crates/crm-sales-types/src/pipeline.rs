//! §1.9 Sales Pipelines / Forms / Analytics — DTOs.
//!
//! ## Pipelines
//! Today the TS port stores pipelines as embedded subdocs on the user
//! (`users.crmPipelines[]`). The DTO here models the standalone shape
//! that the §13.6 lookup registry already references — when the
//! collection is broken out, the same struct serializes verbatim.
//!
//! ## Forms
//! Public lead-capture forms with theming + redirect + captcha + custom
//! fields. Submission events post to `submit_webhook` and create a Lead
//! with the submitted field values.
//!
//! ## Analytics
//! The §1.9 spec lists analytics last; report shapes live with their
//! consumers (a future `crm-reports` crate). No DTOs here.

use bson::oid::ObjectId;
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ===================== Pipeline ===================== */

/// Visibility of the pipeline. Drives who sees it in pickers and Cmd-K.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PipelineVisibility {
    /// Only the owner.
    Private,
    /// Visible to the owner's team.
    Team,
    /// Visible to every user in the workspace.
    #[default]
    Workspace,
}

/// One stage of a pipeline. Composite id used by §13 lookups is
/// `pipelineId:stageId` — both ids live on the parent doc and this
/// struct, so callers can build the composite without a join.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stage {
    pub id: ObjectId,
    pub label: String,
    /// Tailwind / CSS color token. Free-form so themes can introduce
    /// new tokens without a crate edit ("zinc-500", "#22c55e", …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Win-probability weight (0-100). Reports use this to compute
    /// weighted forecast.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub probability_pct: Option<u8>,
    /// Render order in the kanban view (ascending).
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pipeline {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    pub stages: Vec<Stage>,
    /// Stage id picked when a new lead/deal is created without an
    /// explicit stage. Must match one of `stages[*].id`.
    pub default_stage_id: ObjectId,
    /// Reasons surfaced when a deal is marked Won or Lost. Free-form
    /// strings so vocabulary is tenant-configurable.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub win_loss_reasons: Vec<String>,
    /// Owner user — distinct from `crm-core::Identity::user_id` (the
    /// tenant root) when a workspace has multiple sales managers.
    pub owner_id: ObjectId,
    #[serde(default)]
    pub visibility: PipelineVisibility,
}

/* ===================== Lead Form ===================== */

/// Form-field types the public lead form supports. Subset of the
/// custom-field type vocabulary in `src/lib/worksuite/meta-types.ts` —
/// public forms exclude `entity_ref` because public submitters can't
/// pick existing CRM records.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FormFieldType {
    Text,
    Textarea,
    Email,
    Phone,
    Number,
    Date,
    Select,
    Checkbox,
    Url,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormField {
    /// Stable key used in submission payloads. Must be unique within
    /// the form.
    pub key: String,
    pub label: String,
    pub field_type: FormFieldType,
    #[serde(default, skip_serializing_if = "is_false")]
    pub required: bool,
    /// Options for `Select`-typed fields. Ignored for other types.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub help_text: Option<String>,
}

/// Theming knobs for the public-facing form page.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormTheme {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brand_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background_file_id: Option<ObjectId>,
    /// "light" / "dark" / "system". Free-form so brands can ship custom
    /// modes (e.g. "high-contrast").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
}

/// Captcha provider. `None` = no captcha (small risk of spam).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaptchaProvider {
    #[default]
    None,
    Recaptcha,
    Hcaptcha,
    Turnstile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeadForm {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub label: String,
    pub fields: Vec<FormField>,
    #[serde(default)]
    pub theme: FormTheme,
    /// Where to send the visitor after a successful submit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub redirect_url: Option<String>,
    #[serde(default)]
    pub captcha: CaptchaProvider,
    /// Optional outbound webhook URL — fired for every submission so
    /// downstream systems (Slack, Sheets, custom CRMs) can react.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub submit_webhook: Option<String>,
    /// Pipeline + stage to seed new Leads created from this form.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_pipeline_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_stage_id: Option<ObjectId>,
    /// Whether the form is publicly accessible.
    #[serde(default = "true_default", skip_serializing_if = "is_true")]
    pub published: bool,
}

fn is_false(b: &bool) -> bool {
    !*b
}

fn is_true(b: &bool) -> bool {
    *b
}

fn true_default() -> bool {
    true
}
