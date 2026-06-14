//! Wire-format DTOs for the SabChat **collaboration** endpoints.
//!
//! Every body uses `#[serde(rename_all = "camelCase")]` for TS round-tripping.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Scheduled messages (send-later)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleMessageBody {
    pub conversation_id: String,
    pub text: String,
    /// When to send. Stored as a UTC instant; the cron drains due rows.
    pub send_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledListQuery {
    pub conversation_id: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListScheduledResponse {
    #[schema(value_type = Vec<Object>)]
    pub scheduled: Vec<Value>,
}

// ---------------------------------------------------------------------------
// Side conversations
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSideBody {
    pub parent_conversation_id: String,
    pub subject: String,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSideMessageBody {
    pub body: String,
    #[serde(default)]
    pub author_name: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SideListQuery {
    pub parent_conversation_id: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListSideResponse {
    #[schema(value_type = Vec<Object>)]
    pub side_conversations: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListSideMessagesResponse {
    #[schema(value_type = Vec<Object>)]
    pub messages: Vec<Value>,
}

// ---------------------------------------------------------------------------
// Conversation links
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateLinkBody {
    pub a_id: String,
    pub b_id: String,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LinksQuery {
    pub conversation_id: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListLinksResponse {
    #[schema(value_type = Vec<Object>)]
    pub links: Vec<Value>,
}

// ---------------------------------------------------------------------------
// Generic
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IdResponse {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResponse {
    pub message: String,
}
