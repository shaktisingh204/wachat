//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::SipAcl;

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
pub struct CreateAclInput {
    pub name: String,
    #[serde(default)]
    pub action: Option<String>,
    pub cidrs: Vec<String>,
    #[serde(default)]
    pub applies_to: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAclInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub cidrs: Option<Vec<String>>,
    #[serde(default)]
    pub applies_to: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAclResponse {
    pub id: String,
    pub entity: SipAcl,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAclResponse {
    pub deleted: bool,
}
