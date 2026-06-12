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
    /// "pending" | "approved" | "rejected" | "all"
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub warehouse_id: Option<String>,
    #[serde(default)]
    pub product_id: Option<String>,
    /// Inclusive lower bound on `date` (ISO-8601).
    #[serde(default)]
    pub date_from: Option<String>,
    /// Exclusive upper bound on `date` (ISO-8601).
    #[serde(default)]
    pub date_to: Option<String>,
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

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineInput {
    pub product_id: String,
    #[serde(default)]
    pub product_name: Option<String>,
    #[serde(default)]
    pub qty_before: Option<f64>,
    #[serde(default)]
    pub qty_after: Option<f64>,
    #[serde(default)]
    pub delta: Option<f64>,
    #[serde(default)]
    pub batch: Option<String>,
    #[serde(default)]
    pub serial: Option<String>,
    #[serde(default)]
    pub cost_per_unit: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStockAdjustmentInput {
    /// SabCRM suite scope — required on project-scoped mounts.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub adjustment_number: Option<String>,
    /// ISO-8601 date. Defaults to "now" if omitted.
    #[serde(default)]
    pub date: Option<String>,
    pub reason: String,
    #[serde(default)]
    pub reference_number: Option<String>,
    pub warehouse_id: String,
    pub product_id: String,
    pub quantity: f64,
    #[serde(default)]
    pub cost_per_unit: Option<f64>,
    #[serde(default)]
    pub lines: Vec<LineInput>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStockAdjustmentInput {
    #[serde(default)]
    pub adjustment_number: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub reference_number: Option<String>,
    #[serde(default)]
    pub warehouse_id: Option<String>,
    #[serde(default)]
    pub product_id: Option<String>,
    #[serde(default)]
    pub quantity: Option<f64>,
    #[serde(default)]
    pub cost_per_unit: Option<f64>,
    #[serde(default)]
    pub lines: Option<Vec<LineInput>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalInput {
    /// "approve" | "reject".
    pub decision: String,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStockAdjustmentResponse {
    pub id: String,
    pub entity: crate::types::CrmStockAdjustment,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStockAdjustmentResponse {
    pub deleted: bool,
}
