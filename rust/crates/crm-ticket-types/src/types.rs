//! On-disk shape of a `crm_ticket_types` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// A ticket type record. One tenant owns many of these; the (tenant, name)
/// pair is unique among non-archived rows. `is_default` marks the row picked
/// up when a new ticket is created without an explicit type — at most one
/// default exists per tenant (enforced by demoting peers on write).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTicketType {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Display name — unique per tenant among non-archived rows.
    /// Examples: `"Bug"`, `"Feature"`, `"Question"`, `"Incident"`.
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    /// Default priority applied to new tickets of this type (e.g. `"low"`,
    /// `"normal"`, `"high"`, `"urgent"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_priority: Option<String>,
    /// Default SLA policy to bind to new tickets of this type.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_sla_id: Option<ObjectId>,
    /// Default ticket group/queue for new tickets of this type.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_group_id: Option<ObjectId>,

    /// Field names that must be filled before a ticket of this type can be
    /// saved (e.g. `["stepsToReproduce", "browser"]`).
    #[serde(default)]
    pub required_fields: Vec<String>,

    /// Toggle to soft-disable a type without archiving it.
    #[serde(default = "default_true")]
    pub is_active: bool,
    /// At most one default per tenant. Enforced at write time.
    #[serde(default)]
    pub is_default: bool,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_true() -> bool {
    true
}
