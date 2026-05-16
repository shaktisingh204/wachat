//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmAnnouncement;

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
    pub category: Option<String>,
    #[serde(default)]
    pub audience: Option<String>,
    #[serde(default)]
    pub pinned: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAnnouncementInput {
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub audience: Option<String>,
    #[serde(default)]
    pub audience_ids: Option<Vec<String>>,
    #[serde(default)]
    pub publish_at: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub pinned: Option<bool>,
    #[serde(default)]
    pub allow_comments: Option<bool>,
    #[serde(default)]
    pub require_acknowledgement: Option<bool>,
    #[serde(default)]
    pub banner_url: Option<String>,
    #[serde(default)]
    pub author_id: Option<String>,
    #[serde(default)]
    pub author_name: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAnnouncementInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub audience: Option<String>,
    #[serde(default)]
    pub audience_ids: Option<Vec<String>>,
    #[serde(default)]
    pub publish_at: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub pinned: Option<bool>,
    #[serde(default)]
    pub allow_comments: Option<bool>,
    #[serde(default)]
    pub require_acknowledgement: Option<bool>,
    #[serde(default)]
    pub acknowledgement_count: Option<i64>,
    #[serde(default)]
    pub view_count: Option<i64>,
    #[serde(default)]
    pub banner_url: Option<String>,
    #[serde(default)]
    pub author_id: Option<String>,
    #[serde(default)]
    pub author_name: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAnnouncementResponse {
    pub id: String,
    pub entity: CrmAnnouncement,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAnnouncementResponse {
    pub deleted: bool,
}
