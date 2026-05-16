//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmCurrency;

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
    #[serde(default)]
    pub is_base: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCurrencyInput {
    pub code: String,
    pub name: String,
    #[serde(default)]
    pub symbol: Option<String>,
    #[serde(default)]
    pub decimal_places: Option<i32>,
    #[serde(default)]
    pub exchange_rate: Option<f64>,
    #[serde(default)]
    pub is_base: Option<bool>,
    #[serde(default)]
    pub display_format: Option<String>,
    #[serde(default)]
    pub thousand_separator: Option<String>,
    #[serde(default)]
    pub decimal_separator: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCurrencyInput {
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub symbol: Option<String>,
    #[serde(default)]
    pub decimal_places: Option<i32>,
    #[serde(default)]
    pub exchange_rate: Option<f64>,
    #[serde(default)]
    pub is_base: Option<bool>,
    #[serde(default)]
    pub display_format: Option<String>,
    #[serde(default)]
    pub thousand_separator: Option<String>,
    #[serde(default)]
    pub decimal_separator: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCurrencyResponse {
    pub id: String,
    pub entity: CrmCurrency,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCurrencyResponse {
    pub deleted: bool,
}
