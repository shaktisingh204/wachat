//! On-disk shape of a `crm_warehouses` document. Mirrors the TS
//! `CrmWarehouse` interface in `src/lib/definitions.ts`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmWarehouse {
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
    pub name: String,

    /// Short human-friendly code (e.g. WH-01). Unique-per-user when set.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    /// `"main"` | `"branch"` | `"franchise"` | `"3pl"` | `"virtual"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[serde(rename = "type")]
    pub kind: Option<String>,
    /// `"active"` | `"inactive"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pincode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capacity_units: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capacity_sqft: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub climate_controlled: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub archived: Option<bool>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
