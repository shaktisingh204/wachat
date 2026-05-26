//! Request DTOs for the storefront router.

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
pub struct CreateStorefrontInput {
    pub slug: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub theme_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStorefrontInput {
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub theme_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub custom_css: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub favicon_url: Option<String>,
    #[serde(default)]
    pub hero_image_url: Option<String>,
    #[serde(default)]
    pub hero_title: Option<String>,
    #[serde(default)]
    pub hero_subtitle: Option<String>,
    #[serde(default)]
    pub shipping_zone_ids: Option<Vec<String>>,
    #[serde(default)]
    pub tax_rule_ids: Option<Vec<String>>,
    #[serde(default)]
    pub featured_product_ids: Option<Vec<String>>,
    #[serde(default)]
    pub featured_collection_ids: Option<Vec<String>>,
    #[serde(default)]
    pub published_product_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStorefrontResponse {
    pub id: String,
    pub entity: crate::types::SabshopStorefront,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStorefrontResponse {
    pub deleted: bool,
}
