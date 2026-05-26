//! Conversation = one running thread on one inbox with one contact.
//!
//! Status / priority / labels / assignment / SLA all live here. Messages are
//! a separate collection keyed by `conversation_id`.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Lifecycle status. Chatwoot-parity vocabulary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ConversationStatus {
    Open,
    Pending,
    Resolved,
    Snoozed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ConversationPriority {
    Low,
    Medium,
    High,
    Urgent,
}

/// SLA timers attached to a conversation. Each clock is the wall-clock
/// deadline for the corresponding event.
#[derive(Debug, Clone, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SlaPolicy {
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub first_response_due_at: Option<DateTime<Utc>>,
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub next_response_due_at: Option<DateTime<Utc>>,
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub resolution_due_at: Option<DateTime<Utc>>,
    /// Has any clock already breached? Cached for cheap inbox filters.
    #[serde(default)]
    pub breached: bool,
}

/// One conversation. Mongo collection: `sabchat_conversations`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SabChatConversation {
    #[serde(rename = "_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,

    #[schema(value_type = String)]
    pub tenant_id: ObjectId,
    #[schema(value_type = String)]
    pub inbox_id: ObjectId,
    #[schema(value_type = String)]
    pub contact_id: ObjectId,

    pub status: ConversationStatus,

    #[serde(default = "default_priority")]
    pub priority: ConversationPriority,

    /// Assigned agent, if any.
    #[serde(default)]
    #[schema(value_type = String)]
    pub assignee_id: Option<ObjectId>,

    /// Owning team, if any.
    #[serde(default)]
    #[schema(value_type = String)]
    pub team_id: Option<ObjectId>,

    #[serde(default)]
    pub labels: Vec<String>,

    /// Snooze release time, if `status == Snoozed`.
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub snooze_until: Option<DateTime<Utc>>,

    #[serde(default)]
    pub sla: SlaPolicy,

    /// Last message timestamp for inbox sort order.
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub last_message_at: Option<DateTime<Utc>>,

    /// Short text preview of the last message for inbox row display.
    #[serde(default)]
    pub last_message_preview: Option<String>,

    /// Agent-side unread count. Visitor-side unread is tracked on the widget.
    #[serde(default)]
    pub unread_count: u32,

    /// Free-form custom attributes per conversation (driver: tenant rules /
    /// SabFlow). Kept opaque.
    #[serde(default)]
    pub custom_attrs: serde_json::Value,

    /// First-response timestamp (used by SLA reports). Set once by the first
    /// outbound agent/bot message.
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub first_response_at: Option<DateTime<Utc>>,

    /// Resolution timestamp.
    #[serde(default, with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional")]
    pub resolved_at: Option<DateTime<Utc>>,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}

fn default_priority() -> ConversationPriority {
    ConversationPriority::Medium
}
