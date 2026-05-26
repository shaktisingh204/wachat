use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)] pub page: Option<u32>,
    #[serde(default)] pub limit: Option<u32>,
    #[serde(default)] pub storefront_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCheckoutInput {
    pub cart_id: String,
    pub storefront_id: String,
    #[serde(default)] pub step: Option<String>,
    #[serde(default)] pub payload: Option<Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckoutInput {
    #[serde(default)] pub step: Option<String>,
    #[serde(default)] pub payload: Option<Value>,
    #[serde(default)] pub order_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCheckoutResponse {
    pub id: String,
    pub entity: crate::types::SabshopCheckout,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCheckoutResponse { pub deleted: bool }
