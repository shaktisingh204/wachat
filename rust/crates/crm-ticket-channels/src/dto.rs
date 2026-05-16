//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmTicketChannel;

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
    #[serde(default)]
    pub channel_type: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChannelInput {
    pub name: String,
    pub channel_type: String,
    #[serde(default)]
    pub inbox_email: Option<String>,
    #[serde(default)]
    pub webhook_url: Option<String>,
    #[serde(default)]
    pub assigned_agent_group: Option<String>,
    #[serde(default)]
    pub default_priority: Option<String>,
    #[serde(default)]
    pub default_sla_id: Option<String>,
    #[serde(default)]
    pub auto_assign: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub settings: Option<Document>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChannelInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub channel_type: Option<String>,
    #[serde(default)]
    pub inbox_email: Option<String>,
    #[serde(default)]
    pub webhook_url: Option<String>,
    #[serde(default)]
    pub assigned_agent_group: Option<String>,
    #[serde(default)]
    pub default_priority: Option<String>,
    #[serde(default)]
    pub default_sla_id: Option<String>,
    #[serde(default)]
    pub auto_assign: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub settings: Option<Document>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChannelResponse {
    pub id: String,
    pub entity: CrmTicketChannel,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteChannelResponse {
    pub deleted: bool,
}
