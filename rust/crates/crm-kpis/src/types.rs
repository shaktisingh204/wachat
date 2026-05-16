//! On-disk shape of a `crm_kpis` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmKpi {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Free-form target expression (e.g. `"95%"`, `"$10000"`, `"500"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,

    /// Unit of measure (`"%"`, `"$"`, `"count"`, custom).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,

    /// Cadence — `"monthly"` | `"quarterly"` | `"annual"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frequency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,

    /// Relative weight in performance review aggregation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
