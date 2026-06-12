//! On-disk shape of a `crm_boms` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmBomComponent {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_id: Option<ObjectId>,
    pub item_name: String,
    pub qty: f64,
    pub unit: String,
    #[serde(default)]
    pub scrap_pct: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub optional: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost_per_unit: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmBom {
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

    pub bom_no: String,
    pub finished_good_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finished_good_id: Option<ObjectId>,
    pub output_qty: f64,
    pub unit: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_date: Option<BsonDateTime>,
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    /// `"draft"` | `"active"` | `"obsolete"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active: Option<bool>,

    #[serde(default)]
    pub components: Vec<CrmBomComponent>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub labour_cost: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overhead_cost: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_cost: Option<f64>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
