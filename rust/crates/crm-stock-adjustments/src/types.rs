//! On-disk shape of a `crm_stock_adjustments` document. Mirrors the TS
//! `CrmStockAdjustment` interface in `src/lib/definitions.ts`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStockAdjustmentLine {
    pub product_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub product_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qty_before: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qty_after: Option<f64>,
    /// Convenience: qty_after − qty_before. Optional; computed on the
    /// client where possible.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delta: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub serial: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost_per_unit: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmStockAdjustment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// SabCRM suite scope — stamped on documents created through the
    /// project-scoped `/v1/sabcrm/supply/*` mount; absent on legacy rows.
    #[serde(
        rename = "projectId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub project_id: Option<ObjectId>,

    /// Auto-generated, human-friendly identifier (e.g. ADJ-0001).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adjustment_number: Option<String>,
    pub date: BsonDateTime,
    /// Free-form for forward compat. Common values: "Stock Received",
    /// "Inventory Count", "Damage", "Theft", "Loss", "Return", "Other",
    /// "Correction", "Found", "Transfer In", "Transfer Out".
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_number: Option<String>,
    pub warehouse_id: ObjectId,
    pub product_id: ObjectId,
    /// Positive for addition, negative for reduction.
    pub quantity: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost_per_unit: Option<f64>,
    /// Per-line breakdown for multi-item adjustments.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lines: Vec<CrmStockAdjustmentLine>,

    /// `"pending"` | `"approved"` | `"rejected"`. Defaults to "pending".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_by_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approval_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
