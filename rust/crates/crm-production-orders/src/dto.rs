//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{CrmProductionOrder, ProductionComponent};

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
    pub bom_id: Option<String>,
    /// SabCRM suite scope — required on `/v1/sabcrm/supply/*` mounts,
    /// ignored on the legacy `userId` mount.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Query for single-document routes (`GET`/`PATCH`/`DELETE /{id}`) —
/// carries the SabCRM `projectId` on project-scoped mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductionOrderInput {
    /// SabCRM suite scope — required on project-scoped mounts.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub order_no: Option<String>,
    #[serde(default)]
    pub bom_ref: Option<String>,
    #[serde(default)]
    pub bom_id: Option<String>,
    #[serde(default)]
    pub finished_good_id: Option<String>,
    pub finished_good_name: String,
    pub planned_qty: f64,
    pub unit: String,
    #[serde(default)]
    pub planned_start: Option<String>,
    #[serde(default)]
    pub planned_end: Option<String>,
    #[serde(default)]
    pub machine_id: Option<String>,
    #[serde(default)]
    pub machine_operator: Option<String>,
    #[serde(default)]
    pub machine_operator_id: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub components: Vec<ProductionComponent>,
    #[serde(default)]
    pub labour_cost: Option<f64>,
    #[serde(default)]
    pub overhead_cost: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProductionOrderInput {
    #[serde(default)]
    pub order_no: Option<String>,
    #[serde(default)]
    pub bom_ref: Option<String>,
    #[serde(default)]
    pub bom_id: Option<String>,
    #[serde(default)]
    pub finished_good_id: Option<String>,
    #[serde(default)]
    pub finished_good_name: Option<String>,
    #[serde(default)]
    pub planned_qty: Option<f64>,
    #[serde(default)]
    pub actual_yield: Option<f64>,
    #[serde(default)]
    pub scrap: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub planned_start: Option<String>,
    #[serde(default)]
    pub planned_end: Option<String>,
    #[serde(default)]
    pub machine_id: Option<String>,
    #[serde(default)]
    pub machine_operator: Option<String>,
    #[serde(default)]
    pub machine_operator_id: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub components: Option<Vec<ProductionComponent>>,
    #[serde(default)]
    pub labour_cost: Option<f64>,
    #[serde(default)]
    pub overhead_cost: Option<f64>,
    #[serde(default)]
    pub material_cost: Option<f64>,
    #[serde(default)]
    pub total_cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductionOrderResponse {
    pub id: String,
    pub entity: CrmProductionOrder,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProductionOrderResponse {
    pub deleted: bool,
}
