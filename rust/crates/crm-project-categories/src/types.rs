//! On-disk shape of a `crm_project_categories` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmProjectCategory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Display name. Unique per tenant among non-archived categories.
    pub name: String,

    /// Short code / external slug. Free-form.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    /// Hex string (e.g. "#FF8800") or zoru token name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Icon identifier (lucide name, emoji, or zoru icon token).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Optional parent enabling a single-level (or arbitrary-depth) tree.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,

    /// Sortable order for UI display. Defaults to 0.
    #[serde(default)]
    pub display_order: i32,

    /// Soft on/off toggle. Distinct from `status` archival.
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// Denormalized count of projects currently filed under this category.
    #[serde(default)]
    pub projects_count: i64,

    /// `"active"` | `"archived"`. Archive = soft delete.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
