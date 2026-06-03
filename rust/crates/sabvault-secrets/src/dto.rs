//! Request DTOs for sabvault-secrets.

use serde::{Deserialize, Serialize};

use crate::types::SabvaultSecret;

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
pub struct CreateSabvaultSecretInput {
    pub name: String,
    pub interval_unit: String,
    #[serde(default)]
    pub interval_count: Option<i32>,
    pub amount_minor: i64,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub trial_days: Option<i32>,
    #[serde(default)]
    pub setup_fee_minor: Option<i64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSabvaultSecretInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub interval_unit: Option<String>,
    #[serde(default)]
    pub interval_count: Option<i32>,
    #[serde(default)]
    pub amount_minor: Option<i64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub trial_days: Option<i32>,
    #[serde(default)]
    pub setup_fee_minor: Option<i64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSabvaultSecretResponse {
    pub id: String,
    pub entity: SabvaultSecret,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSabvaultSecretResponse {
    pub deleted: bool,
}
