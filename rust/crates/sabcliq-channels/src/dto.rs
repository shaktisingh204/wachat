//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::SabcliqChannel;

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
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub archived: Option<bool>,
    /// Hex `ObjectId` — restrict to channels whose `memberUserIds` includes this user.
    #[serde(default)]
    pub member_user_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChannelInput {
    pub workspace_id: String,
    pub name: String,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub topic: Option<String>,
    #[serde(default)]
    pub member_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub pinned: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChannelInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub topic: Option<String>,
    #[serde(default)]
    pub member_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub archived: Option<bool>,
    #[serde(default)]
    pub pinned: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChannelResponse {
    pub id: String,
    pub entity: SabcliqChannel,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteChannelResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcliqChannel>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
