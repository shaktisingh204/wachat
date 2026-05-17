//! On-disk shape of a `crm_task_categories` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTaskCategory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Display name. Unique per tenant among non-archived categories.
    pub name: String,

    /// Optional parent category (forms a tree). Cycles are guarded against
    /// in the handler.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,

    /// Hex string (e.g. `"#FF8800"`) or zoru token name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Icon identifier (lucide name, emoji, or zoru icon token).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Sort order in lists (ascending). Default 0.
    #[serde(default)]
    pub display_order: i32,

    /// Soft on/off toggle. Distinct from `status` archival.
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"archived"`. Archive = soft delete.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
