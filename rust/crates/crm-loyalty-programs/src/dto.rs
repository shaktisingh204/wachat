//! Request DTOs.

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
pub struct LoyaltyTierInput {
    pub name: String,
    pub threshold: f64,
    pub multiplier: f64,
    #[serde(default)]
    pub perks: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLoyaltyProgramInput {
    pub name: String,
    pub points_per_currency_unit: f64,
    pub redemption_ratio: f64,
    #[serde(default)]
    pub expiry_days: Option<i32>,
    #[serde(default)]
    pub min_redemption_points: Option<i32>,
    #[serde(default)]
    pub welcome_bonus: Option<i32>,
    #[serde(default)]
    pub tiers: Vec<LoyaltyTierInput>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLoyaltyProgramInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub points_per_currency_unit: Option<f64>,
    #[serde(default)]
    pub redemption_ratio: Option<f64>,
    #[serde(default)]
    pub expiry_days: Option<i32>,
    #[serde(default)]
    pub min_redemption_points: Option<i32>,
    #[serde(default)]
    pub welcome_bonus: Option<i32>,
    #[serde(default)]
    pub tiers: Option<Vec<LoyaltyTierInput>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLoyaltyProgramResponse {
    pub id: String,
    pub entity: crate::types::CrmLoyaltyProgram,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteLoyaltyProgramResponse {
    pub deleted: bool,
}
