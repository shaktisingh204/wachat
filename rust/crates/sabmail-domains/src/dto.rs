//! Request DTOs for `/v1/sabmail/domains`.

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
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDomainInput {
    pub domain: String,
    #[serde(default)]
    pub mailbox_quota: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDomainInput {
    #[serde(default)]
    pub mx_status: Option<String>,
    #[serde(default)]
    pub spf_status: Option<String>,
    #[serde(default)]
    pub dmarc_status: Option<String>,
    #[serde(default)]
    pub dkim_selector: Option<String>,
    #[serde(default)]
    pub dkim_public_key: Option<String>,
    #[serde(default)]
    pub dkim_status: Option<String>,
    #[serde(default)]
    pub mailbox_quota: Option<u32>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDomainResponse {
    pub id: String,
    pub entity: crate::types::SabmailDomain,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDomainResponse {
    pub deleted: bool,
}
