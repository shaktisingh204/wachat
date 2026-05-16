//! On-disk shape of a `crm_ticket_groups` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTicketGroup {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Display name. Unique per tenant among non-archived groups.
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Optional parent group enabling a single-level (or arbitrary-depth) tree.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_group_id: Option<ObjectId>,

    /// Default assignee resolved when a ticket lands in this group with no
    /// explicit owner.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_assignee_id: Option<ObjectId>,

    /// Default SLA policy applied to tickets in this group.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_sla_id: Option<ObjectId>,

    /// Hex string (e.g. "#FF8800") or zoru token name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Icon identifier (lucide name, emoji, or zoru icon token).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    /// Soft on/off toggle. Distinct from `status` archival.
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// Denormalized count of tickets currently filed under this group.
    #[serde(default)]
    pub tickets_count: i64,

    /// `"active"` | `"archived"`. Archive = soft delete.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
