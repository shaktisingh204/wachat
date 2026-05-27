//! Request DTOs for sabbackstage-orders.

use serde::{Deserialize, Serialize};

use crate::types::{OrderItem, OrderTotals, SabbackstageOrder};

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

/// Public-create input. The Rust handler resolves `userId` from the
/// `eventId`'s row in `crm_events`, so the public caller does not
/// need to authenticate.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCreateOrderInput {
    pub event_id: String,
    pub buyer_name: String,
    pub buyer_email: String,
    #[serde(default)]
    pub buyer_phone: Option<String>,
    pub items: Vec<OrderItemInput>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderItemInput {
    pub type_id: String,
    pub qty: i32,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrderInput {
    #[serde(default)]
    pub buyer_name: Option<String>,
    #[serde(default)]
    pub buyer_email: Option<String>,
    #[serde(default)]
    pub buyer_phone: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub payment_ref: Option<String>,
    #[serde(default)]
    pub items: Option<Vec<OrderItem>>,
    #[serde(default)]
    pub totals: Option<OrderTotals>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmOrderInput {
    pub payment_ref: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderResponse {
    pub id: String,
    pub entity: SabbackstageOrder,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteOrderResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabbackstageOrder>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
