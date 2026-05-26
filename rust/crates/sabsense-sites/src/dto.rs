//! Request / response DTOs for `pagesense-sites`.

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
    /// `"active"` | `"archived"` | `"all"`. Defaults to `"active"`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSiteInput {
    pub name: String,
    pub domain: String,
    #[serde(default)]
    pub screenshot_url: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSiteInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub domain: Option<String>,
    #[serde(default)]
    pub screenshot_url: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
    /// Force a new snippet key rotation.
    #[serde(default)]
    pub rotate_snippet_key: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSiteResponse {
    pub id: String,
    pub entity: crate::types::PagesenseSite,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSiteResponse {
    pub deleted: bool,
}

/// Public lookup used by the `/api/pagesense/ingest` Next.js route to
/// validate the snippet key before forwarding events. Returned with no
/// auth required other than a matching key; intentionally minimal.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetKeyLookupResponse {
    pub site_id: String,
    pub user_id: String,
    pub domain: String,
    pub is_active: bool,
}
