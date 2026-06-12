//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{CrmBom, CrmBomComponent};

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
    pub finished_good_id: Option<String>,
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
pub struct CreateBomInput {
    pub bom_no: String,
    /// SabCRM suite scope — required on project-scoped mounts.
    #[serde(default)]
    pub project_id: Option<String>,
    pub finished_good_name: String,
    #[serde(default)]
    pub finished_good_id: Option<String>,
    pub output_qty: f64,
    pub unit: String,
    #[serde(default)]
    pub effective_date: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub components: Vec<CrmBomComponent>,
    #[serde(default)]
    pub labour_cost: Option<f64>,
    #[serde(default)]
    pub overhead_cost: Option<f64>,
    #[serde(default)]
    pub total_cost: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBomInput {
    #[serde(default)]
    pub bom_no: Option<String>,
    #[serde(default)]
    pub finished_good_name: Option<String>,
    #[serde(default)]
    pub finished_good_id: Option<String>,
    #[serde(default)]
    pub output_qty: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub effective_date: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
    #[serde(default)]
    pub components: Option<Vec<CrmBomComponent>>,
    #[serde(default)]
    pub labour_cost: Option<f64>,
    #[serde(default)]
    pub overhead_cost: Option<f64>,
    #[serde(default)]
    pub total_cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBomResponse {
    pub id: String,
    pub entity: CrmBom,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteBomResponse {
    pub deleted: bool,
}
