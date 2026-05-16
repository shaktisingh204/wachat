//! On-disk shape of a `crm_assets` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmAsset {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Tenant-unique identifier, e.g. `"LAP-001"`.
    pub asset_tag: String,
    pub name: String,

    /// `"laptop"` | `"phone"` | `"monitor"` | `"badge"` | `"keys"` |
    /// `"vehicle"` | `"other"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brand: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub purchase_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub purchase_price: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warranty_expiry: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_assignee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_assignee_name: Option<String>,

    /// `"new"` | `"good"` | `"fair"` | `"poor"` | `"damaged"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,

    /// `"available"` | `"assigned"` | `"in_repair"` | `"retired"` |
    /// `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
