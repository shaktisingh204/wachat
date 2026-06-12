//! Request DTOs.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::types::{CrmForm, CrmFormField};

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
    /// SabCRM project scope — required on the `/v1/sabcrm/forms` mount,
    /// ignored on the legacy `userId` mount.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Scope-only query for the single-document routes (`GET`/`PATCH`/`DELETE`
/// `/{formId}`). Mirrors `crm_invoices::dto::ScopeQuery`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFormInput {
    pub name: String,
    /// SabCRM project scope — required (in the body) on the
    /// `/v1/sabcrm/forms` mount, ignored on the legacy mount.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub fields: Option<Vec<CrmFormField>>,
    #[serde(default)]
    pub settings: Option<JsonValue>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFormInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub fields: Option<Vec<CrmFormField>>,
    #[serde(default)]
    pub settings: Option<JsonValue>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFormResponse {
    pub id: String,
    pub entity: CrmForm,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFormResponse {
    pub deleted: bool,
}
