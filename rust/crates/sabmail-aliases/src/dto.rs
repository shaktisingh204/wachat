//! Request DTOs for `/v1/sabmail/aliases`.

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
    pub domain_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAliasInput {
    pub domain_id: String,
    pub source_address: String,
    #[serde(default)]
    pub target_account_ids: Vec<String>,
    #[serde(default)]
    pub external_targets: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAliasInput {
    #[serde(default)]
    pub source_address: Option<String>,
    #[serde(default)]
    pub target_account_ids: Option<Vec<String>>,
    #[serde(default)]
    pub external_targets: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAliasResponse {
    pub id: String,
    pub entity: crate::types::SabmailAlias,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAliasResponse {
    pub deleted: bool,
}
