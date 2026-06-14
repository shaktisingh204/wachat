//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::SipDomain;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"disabled"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDomainInput {
    pub domain: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub record_calls: Option<bool>,
    #[serde(default)]
    pub default_application_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDomainInput {
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub record_calls: Option<bool>,
    #[serde(default)]
    pub default_application_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDomainResponse {
    pub id: String,
    pub entity: SipDomain,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDomainResponse {
    pub deleted: bool,
}
