//! Request DTOs.

use serde::{Deserialize, Serialize};

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
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Scope-only query for `GET`/`PATCH`/`DELETE` by id. `projectId` is
/// required on SabCRM (project) mounts and ignored on legacy mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGiftCardInput {
    /// SabCRM (project) mounts only — required tenant scope.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    pub value: f64,
    #[serde(default)]
    pub issued_to: Option<String>,
    #[serde(default)]
    pub issued_to_email: Option<String>,
    #[serde(default)]
    pub expiry_date: Option<String>,
    #[serde(default)]
    pub transferable: Option<bool>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGiftCardInput {
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub balance: Option<f64>,
    #[serde(default)]
    pub issued_to: Option<String>,
    #[serde(default)]
    pub issued_to_email: Option<String>,
    #[serde(default)]
    pub expiry_date: Option<String>,
    #[serde(default)]
    pub transferable: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGiftCardResponse {
    pub id: String,
    pub entity: crate::types::CrmGiftCard,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteGiftCardResponse {
    pub deleted: bool,
}
