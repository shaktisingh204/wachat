//! Request DTOs for `/v1/sabrewards/programs`.

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
pub struct CreateRewardsProgramInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Hex string of a `crm_loyalty_programs._id` if reusing its tier engine.
    #[serde(default)]
    pub tier_engine_ref: Option<String>,
    #[serde(default)]
    pub points_expire_after_days: Option<i32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRewardsProgramInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub tier_engine_ref: Option<String>,
    #[serde(default)]
    pub points_expire_after_days: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRewardsProgramResponse {
    pub id: String,
    pub entity: crate::types::RewardsProgram,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRewardsProgramResponse {
    pub deleted: bool,
}
