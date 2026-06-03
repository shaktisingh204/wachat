use crate::types::{OrderAddress, OrderLineItem, OrderTotals};
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
    pub storefront_id: Option<String>,
    #[serde(default)]
    pub payment_status: Option<String>,
    #[serde(default)]
    pub fulfillment_status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderInput {
    pub storefront_id: String,
    #[serde(default)]
    pub customer_id: Option<String>,
    pub line_items: Vec<OrderLineItem>,
    pub totals: OrderTotals,
    #[serde(default)]
    pub shipping_address: OrderAddress,
    #[serde(default)]
    pub billing_address: OrderAddress,
    #[serde(default)]
    pub payment_ref: Option<String>,
    #[serde(default)]
    pub payment_provider: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrderInput {
    #[serde(default)]
    pub payment_status: Option<String>,
    #[serde(default)]
    pub fulfillment_status: Option<String>,
    #[serde(default)]
    pub payment_ref: Option<String>,
    #[serde(default)]
    pub shipping_address: Option<OrderAddress>,
    #[serde(default)]
    pub billing_address: Option<OrderAddress>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderResponse {
    pub id: String,
    pub entity: crate::types::SabshopOrder,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteOrderResponse {
    pub deleted: bool,
}
