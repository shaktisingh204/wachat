//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::SipTrunk;

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
    #[serde(default)]
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTrunkInput {
    pub name: String,
    pub sip_server: String,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub port: Option<i32>,
    #[serde(default)]
    pub transport: Option<String>,
    #[serde(default)]
    pub auth_username: Option<String>,
    #[serde(default)]
    pub auth_password_ref: Option<String>,
    #[serde(default)]
    pub from_domain: Option<String>,
    #[serde(default)]
    pub from_user: Option<String>,
    #[serde(default)]
    pub register: Option<bool>,
    #[serde(default)]
    pub inbound_enabled: Option<bool>,
    #[serde(default)]
    pub outbound_enabled: Option<bool>,
    #[serde(default)]
    pub codecs: Option<Vec<String>>,
    #[serde(default)]
    pub max_channels: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTrunkInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub sip_server: Option<String>,
    #[serde(default)]
    pub port: Option<i32>,
    #[serde(default)]
    pub transport: Option<String>,
    #[serde(default)]
    pub auth_username: Option<String>,
    #[serde(default)]
    pub auth_password_ref: Option<String>,
    #[serde(default)]
    pub from_domain: Option<String>,
    #[serde(default)]
    pub from_user: Option<String>,
    #[serde(default)]
    pub register: Option<bool>,
    #[serde(default)]
    pub inbound_enabled: Option<bool>,
    #[serde(default)]
    pub outbound_enabled: Option<bool>,
    #[serde(default)]
    pub codecs: Option<Vec<String>>,
    #[serde(default)]
    pub max_channels: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTrunkResponse {
    pub id: String,
    pub entity: SipTrunk,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTrunkResponse {
    pub deleted: bool,
}
