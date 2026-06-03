use crate::types::{CartLineItem, CartTotals};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub storefront_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCartInput {
    pub storefront_id: String,
    #[serde(default)]
    pub customer_id: Option<String>,
    #[serde(default)]
    pub guest_session_id: Option<String>,
    #[serde(default)]
    pub line_items: Vec<CartLineItem>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub coupon_code: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCartInput {
    #[serde(default)]
    pub line_items: Option<Vec<CartLineItem>>,
    #[serde(default)]
    pub totals: Option<CartTotals>,
    #[serde(default)]
    pub coupon_code: Option<String>,
    #[serde(default)]
    pub customer_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCartResponse {
    pub id: String,
    pub entity: crate::types::SabshopCart,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCartResponse {
    pub deleted: bool,
}
