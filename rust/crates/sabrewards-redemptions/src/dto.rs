//! Request DTOs for `/v1/sabrewards/redemptions`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub member_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRedemptionInput {
    pub member_id: String,
    pub catalog_item_id: String,
    pub points: i64,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRedemptionStatusInput {
    /// `"fulfilled"` or `"cancelled"`. `"pending"` is the create default
    /// and not an allowed transition target.
    pub status: String,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRedemptionResponse {
    pub id: String,
    pub entity: crate::types::RewardsRedemption,
}
