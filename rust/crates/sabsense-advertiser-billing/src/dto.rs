//! Request DTOs for sabsense-advertiser-billing.

use serde::{Deserialize, Serialize};

use crate::types::SabsenseAdvertiserBilling;

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
pub struct CreateItemInput {
    pub amount_minor: i64,
    pub currency: String,
    pub billing_cycle: String,
    pub status: String,

}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemInput {
    #[serde(default)]
    pub amount_minor: Option<i64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub billing_cycle: Option<String>,
    #[serde(default)]
    pub status: Option<String>,

}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemResponse {
    pub id: String,
    pub entity: SabsenseAdvertiserBilling,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteItemResponse {
    pub deleted: bool,
}
