//! On-disk shape of a `crm_slas` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmSla {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,

    /// `"low"` | `"medium"` | `"high"` | `"urgent"`.
    pub priority: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,

    pub first_response_minutes: i64,
    pub resolution_minutes: i64,

    #[serde(default)]
    pub business_hours_only: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub escalate_to: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub escalate_after_minutes: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"active"` | `"archived"`.
    pub status: String,
    #[serde(default = "default_active")]
    pub active: bool,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_active() -> bool {
    true
}
