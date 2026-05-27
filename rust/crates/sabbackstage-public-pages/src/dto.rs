//! Request DTOs for sabbackstage-public-pages.

use serde::{Deserialize, Serialize};

use crate::types::SabbackstagePublicPage;

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
    pub event_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePublicPageInput {
    pub event_id: String,
    pub slug: String,
    pub headline: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub theme_json: Option<serde_json::Value>,
    #[serde(default)]
    pub hero_image_file_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePublicPageInput {
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub headline: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub theme_json: Option<serde_json::Value>,
    #[serde(default)]
    pub hero_image_file_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePublicPageResponse {
    pub id: String,
    pub entity: SabbackstagePublicPage,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePublicPageResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabbackstagePublicPage>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicPageView {
    /// Tenant binding — set so the public order flow can resolve
    /// the right `userId`.
    pub user_id: String,
    pub event_id: String,
    pub page: SabbackstagePublicPage,
}
