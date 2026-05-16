//! On-disk shape of a `crm_ticket_tags` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTicketTag {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Display name. Unique per tenant among non-archived tags.
    pub name: String,
    /// Optional URL-safe slug (lower-kebab). Free-form; not enforced unique.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Hex string (e.g. "#FF8800") or zoru token name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Icon identifier (lucide name, emoji, or zoru icon token).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    /// Soft on/off toggle. Distinct from `status` archival.
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"archived"`. Archive = soft delete.
    pub status: String,

    /// Denormalized count of tickets currently carrying this tag.
    #[serde(default)]
    pub tickets_count: i64,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
