//! Request DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub location_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePostInput {
    pub location_id: String,
    pub body: String,
    #[serde(default)]
    pub provider_ids: Vec<String>,
    #[serde(default)]
    pub media_file_ids: Vec<String>,
    /// Epoch millis. If null, post is `draft`/published immediately depending on `status`.
    #[serde(default)]
    pub schedule_at_ms: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePostInput {
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub provider_ids: Option<Vec<String>>,
    #[serde(default)]
    pub media_file_ids: Option<Vec<String>>,
    #[serde(default)]
    pub schedule_at_ms: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
    #[serde(default)]
    pub mark_published: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePostResponse {
    pub id: String,
    pub entity: crate::types::SabpublishPost,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePostResponse {
    pub deleted: bool,
}
