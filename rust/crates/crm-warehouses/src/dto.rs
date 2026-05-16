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
    /// `"active"` | `"inactive"` | `"archived"` | `"all"`. Defaults to non-archived.
    #[serde(default)]
    pub status: Option<String>,
    /// Filter by kind ("main" | "branch" | "franchise" | "3pl" | "virtual").
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWarehouseInput {
    pub name: String,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub pincode: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub manager_id: Option<String>,
    #[serde(default)]
    pub manager_name: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub capacity_units: Option<f64>,
    #[serde(default)]
    pub capacity_sqft: Option<f64>,
    #[serde(default)]
    pub climate_controlled: Option<bool>,
    #[serde(default)]
    pub is_default: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWarehouseInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub pincode: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub manager_id: Option<String>,
    #[serde(default)]
    pub manager_name: Option<String>,
    #[serde(default)]
    pub gstin: Option<String>,
    #[serde(default)]
    pub capacity_units: Option<f64>,
    #[serde(default)]
    pub capacity_sqft: Option<f64>,
    #[serde(default)]
    pub climate_controlled: Option<bool>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub archived: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWarehouseResponse {
    pub id: String,
    pub entity: crate::types::CrmWarehouse,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteWarehouseResponse {
    pub deleted: bool,
}
