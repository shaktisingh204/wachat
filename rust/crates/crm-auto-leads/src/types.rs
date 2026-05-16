//! On-disk shape of a `crm_auto_lead_rules` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmAutoLeadRule {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,

    /// Free-form condition blob. Legacy single-condition shape (source, keyword,
    /// leadSource) collapses into a single-element vec; richer multi-condition
    /// rules supply more entries. Stored as raw BSON to remain forward-compat.
    #[serde(default)]
    pub conditions: Vec<Document>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assign_to_user_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assign_to_team: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_order: Option<i32>,

    #[serde(default = "default_active")]
    pub is_active: bool,

    /// `"active"` | `"paused"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_active() -> bool {
    true
}
