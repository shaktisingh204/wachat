//! On-disk shape of a `crm_ticket_channels` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTicketChannel {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    /// `"email"` | `"web"` | `"phone"` | `"whatsapp"` | `"chat"` | `"social"` | `"api"`.
    pub channel_type: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inbox_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub webhook_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_agent_group: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_priority: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_sla_id: Option<ObjectId>,

    #[serde(default)]
    pub auto_assign: bool,
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// `"active"` | `"archived"`.
    pub status: String,

    /// Flexible per-channel configuration (channel-specific fields).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<Document>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
