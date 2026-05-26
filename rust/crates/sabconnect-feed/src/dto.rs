//! Request / response DTOs for the SabConnect feed.

use serde::{Deserialize, Serialize};

use crate::types::SabConnectFeedItem;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// Filter by kind (`post`, `announcement`, `recognition`, `event`).
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub group_id: Option<String>,
    #[serde(default)]
    pub author_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFeedItemInput {
    pub author_id: String,
    #[serde(default)]
    pub author_name: Option<String>,
    #[serde(default)]
    pub author_avatar_url: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    pub body: String,
    #[serde(default)]
    pub attachment_ids: Option<Vec<String>>,
    #[serde(default)]
    pub ref_id: Option<String>,
    #[serde(default)]
    pub group_id: Option<String>,
    #[serde(default)]
    pub pinned_until: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFeedItemInput {
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub attachment_ids: Option<Vec<String>>,
    #[serde(default)]
    pub pinned_until: Option<String>,
    #[serde(default)]
    pub reaction_count: Option<i64>,
    #[serde(default)]
    pub comment_count: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFeedItemResponse {
    pub id: String,
    pub entity: SabConnectFeedItem,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFeedItemResponse {
    pub deleted: bool,
}
