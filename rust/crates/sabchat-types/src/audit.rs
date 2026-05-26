//! Append-only audit log for the SabChat module.
//!
//! Every mutation that needs a paper trail (status change, assignment,
//! label add/remove, message edit, contact merge, …) writes one event here.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Coarse action taxonomy. Keep the string discriminants stable.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    ConversationCreated,
    ConversationStatusChanged,
    ConversationAssigned,
    ConversationLabeled,
    ConversationUnlabeled,
    ConversationSnoozed,
    ConversationResolved,
    ConversationReopened,
    MessageSent,
    MessageEdited,
    MessageDeleted,
    ContactCreated,
    ContactMerged,
    ContactUpdated,
    InboxCreated,
    InboxUpdated,
    InboxDeleted,
}

/// One immutable audit event. Mongo collection: `sabchat_audit_log`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SabChatAuditEvent {
    #[serde(rename = "_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,

    #[schema(value_type = String)]
    pub tenant_id: ObjectId,

    /// Affected conversation, if applicable.
    #[serde(default)]
    #[schema(value_type = String)]
    pub conversation_id: Option<ObjectId>,

    /// Affected contact, if applicable.
    #[serde(default)]
    #[schema(value_type = String)]
    pub contact_id: Option<ObjectId>,

    /// Affected inbox, if applicable.
    #[serde(default)]
    #[schema(value_type = String)]
    pub inbox_id: Option<ObjectId>,

    pub action: AuditAction,

    /// `agent` | `bot` | `system` | `visitor`.
    pub actor_type: String,

    /// Actor id if known.
    #[serde(default)]
    #[schema(value_type = String)]
    pub actor_id: Option<ObjectId>,

    /// Pre-change snapshot of relevant fields. Opaque JSON.
    #[serde(default)]
    pub before: serde_json::Value,

    /// Post-change snapshot. Opaque JSON.
    #[serde(default)]
    pub after: serde_json::Value,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
}
