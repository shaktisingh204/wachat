//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmFormSubmission;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    /// Filter to a single form's submissions.
    #[serde(default)]
    pub form_id: Option<String>,
    /// SabCRM project scope — required on the `/v1/sabcrm/form-submissions`
    /// mount, ignored on the legacy `userId` mount.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Scope-only query for the single-document routes (`GET`/`PATCH`/`DELETE`
/// `/{submissionId}`). Mirrors `crm_invoices::dto::ScopeQuery`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubmissionInput {
    pub form_id: String,
    /// SabCRM project scope — required (in the body) on the
    /// `/v1/sabcrm/form-submissions` mount, ignored on the legacy mount.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub data: Option<Document>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub ip_address: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub referrer: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubmissionInput {
    #[serde(default)]
    pub data: Option<Document>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub ip_address: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub referrer: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub processed_at: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubmissionResponse {
    pub id: String,
    pub entity: CrmFormSubmission,
}

/// Body for the UNauthenticated public submit endpoint
/// (`POST /v1/sabcrm/form-submissions/public/{publicId}`). The tenant is
/// resolved from the form document itself — the caller never supplies it.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSubmitInput {
    /// Raw field-name → value blob from the rendered form.
    #[serde(default)]
    pub data: Option<Document>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub referrer: Option<String>,
}

/// Response for the public submit endpoint — mirrors the legacy
/// `handleFormSubmission` return shape (success message + optional
/// redirect URL from the form's post-submit settings).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSubmitResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redirect_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSubmissionResponse {
    pub deleted: bool,
}
