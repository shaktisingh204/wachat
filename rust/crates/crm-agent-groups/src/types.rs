//! On-disk shape of a `crm_agent_groups` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_member_count() -> i64 {
    0
}

fn default_is_active() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmAgentGroup {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Display name. Unique per tenant amongst non-archived rows.
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,

    /// User/agent ids that belong to this group.
    #[serde(default)]
    pub member_ids: Vec<ObjectId>,
    /// Cached size of `member_ids`. Kept in sync on create/update.
    #[serde(default = "default_member_count")]
    pub member_count: i64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_id: Option<ObjectId>,

    /// `"round_robin"` | `"load_balanced"` | `"manual"` | `"sticky"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignment_strategy: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub business_hours_id: Option<ObjectId>,

    #[serde(default = "default_is_active")]
    pub is_active: bool,

    /// `"active"` | `"archived"`. Soft-delete sets this to `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
