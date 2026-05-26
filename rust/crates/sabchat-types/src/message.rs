//! Message log. One row per inbound / outbound message on a conversation.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::content::{Attachment, ContentBlock};

/// Who sent the message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SenderType {
    /// End-user / visitor / customer.
    Visitor,
    /// Human agent.
    Agent,
    /// Automated bot (rule, AI, flow).
    Bot,
    /// System note (assignment change, label change, …).
    System,
}

/// Inbound (visitor → us) or Outbound (us → visitor). Derived from
/// `sender_type` at write time and cached here for cheap querying.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum MessageDirection {
    Inbound,
    Outbound,
}

/// One persisted message. Mongo collection: `sabchat_messages`.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SabChatMessage {
    #[serde(rename = "_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,

    #[schema(value_type = String)]
    pub tenant_id: ObjectId,
    #[schema(value_type = String)]
    pub conversation_id: ObjectId,
    #[schema(value_type = String)]
    pub inbox_id: ObjectId,
    #[schema(value_type = String)]
    pub contact_id: ObjectId,

    pub sender_type: SenderType,
    /// Agent id, bot id, or contact id depending on `sender_type`. None for
    /// `System`.
    #[serde(default)]
    #[schema(value_type = String)]
    pub sender_id: Option<ObjectId>,

    pub direction: MessageDirection,

    /// Content payload. One block per message; carousels nest internally.
    pub content: ContentBlock,

    /// Pre-resolved attachments lifted out of the block for fast indexing.
    #[serde(default)]
    pub attachments: Vec<Attachment>,

    /// Channel-specific opaque metadata (Meta message id, WAMID, Telegram
    /// update id, …). Used for idempotency + provider receipts.
    #[serde(default)]
    pub provider_metadata: serde_json::Value,

    /// `private` notes are visible to agents only, not visitors. Used for
    /// internal mentions.
    #[serde(default)]
    pub private: bool,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
}
