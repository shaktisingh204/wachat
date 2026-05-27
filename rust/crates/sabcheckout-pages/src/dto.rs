//! Request DTOs for sabcheckout-pages.

use serde::{Deserialize, Serialize};

use crate::types::{CheckoutItem, RequiredField, SabcheckoutPage};

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
pub struct CreatePageInput {
    pub slug: String,
    pub display_name: String,
    #[serde(default)]
    pub headline: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub theme_json: Option<serde_json::Value>,
    #[serde(default)]
    pub logo_file_id: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub items: Vec<CheckoutItem>,
    #[serde(default)]
    pub require_fields: Vec<RequiredField>,
    #[serde(default)]
    pub success_url: Option<String>,
    #[serde(default)]
    pub cancel_url: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePageInput {
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub headline: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub theme_json: Option<serde_json::Value>,
    #[serde(default)]
    pub logo_file_id: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub items: Option<Vec<CheckoutItem>>,
    #[serde(default)]
    pub require_fields: Option<Vec<RequiredField>>,
    #[serde(default)]
    pub success_url: Option<String>,
    #[serde(default)]
    pub cancel_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePageResponse {
    pub id: String,
    pub entity: SabcheckoutPage,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePageResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicPageView {
    pub id: String,
    /// The owner's `userId`, so the public session-create handler can
    /// bind the new session to the right tenant.
    pub user_id: String,
    pub page: SabcheckoutPage,
}
