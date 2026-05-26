//! Assignment history. One row per assignment change on a conversation.
//!
//! The current assignee lives on [`crate::conversation::SabChatConversation`];
//! this collection is the audit trail used by routing reports.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Mongo collection: `sabchat_assignments`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SabChatAssignment {
    #[serde(rename = "_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,

    #[schema(value_type = String)]
    pub tenant_id: ObjectId,
    #[schema(value_type = String)]
    pub conversation_id: ObjectId,

    /// Previous assignee, `None` if conversation was unassigned.
    #[serde(default)]
    #[schema(value_type = String)]
    pub prev_assignee_id: Option<ObjectId>,

    /// New assignee, `None` if cleared.
    #[serde(default)]
    #[schema(value_type = String)]
    pub new_assignee_id: Option<ObjectId>,

    /// `round_robin` | `manual` | `skill` | `sticky` | `escalation` |
    /// `unassigned`. Kept as a free string to allow new strategies without
    /// migrating this enum.
    pub reason: String,

    /// Actor who performed the assignment (agent doing manual assign,
    /// system for round-robin, etc.).
    #[serde(default)]
    #[schema(value_type = String)]
    pub actor_id: Option<ObjectId>,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
}
