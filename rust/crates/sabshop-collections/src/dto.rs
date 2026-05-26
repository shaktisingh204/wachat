use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)] pub page: Option<u32>,
    #[serde(default)] pub limit: Option<u32>,
    #[serde(default)] pub q: Option<String>,
    #[serde(default)] pub storefront_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCollectionInput {
    pub storefront_id: String,
    pub name: String,
    pub slug: String,
    #[serde(default)] pub description: Option<String>,
    #[serde(default)] pub image_url: Option<String>,
    #[serde(default)] pub product_ids: Vec<String>,
    #[serde(default)] pub rules: Option<Value>,
    #[serde(default)] pub published: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCollectionInput {
    #[serde(default)] pub name: Option<String>,
    #[serde(default)] pub slug: Option<String>,
    #[serde(default)] pub description: Option<String>,
    #[serde(default)] pub image_url: Option<String>,
    #[serde(default)] pub product_ids: Option<Vec<String>>,
    #[serde(default)] pub rules: Option<Value>,
    #[serde(default)] pub published: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCollectionResponse {
    pub id: String,
    pub entity: crate::types::SabshopCollection,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCollectionResponse { pub deleted: bool }
