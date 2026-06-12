//! On-disk shape of a `crm_production_orders` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProductionComponent {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_id: Option<ObjectId>,
    pub item_name: String,
    pub qty: f64,
    pub unit: String,
    #[serde(default)]
    pub scrap_pct: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost_per_unit: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmProductionOrder {
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

    pub order_no: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bom_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bom_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finished_good_id: Option<ObjectId>,
    pub finished_good_name: String,

    pub planned_qty: f64,
    #[serde(default)]
    pub actual_yield: f64,
    #[serde(default)]
    pub scrap: f64,
    pub unit: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub planned_start: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub planned_end: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub machine_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub machine_operator: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub machine_operator_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    /// `"planned"` | `"in_progress"` | `"complete"` | `"cancelled"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(default)]
    pub components: Vec<ProductionComponent>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub labour_cost: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overhead_cost: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub material_cost: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_cost: Option<f64>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
