//! Wire DTOs for the `telegram-chats` router.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "messageId")]
    pub message_id: Option<i64>,
}

// ---------------------------------------------------------------------------
//  Chat row
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ChatRow {
    pub _id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    #[serde(rename = "type")]
    pub chat_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastName")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastMessagePreview")]
    pub last_message_preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastMessageAt")]
    pub last_message_at: Option<DateTime<Utc>>,
    #[serde(rename = "unreadCount")]
    pub unread_count: i64,
    #[serde(skip_serializing_if = "Option::is_none", rename = "isOptedOut")]
    pub is_opted_out: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListChatsQuery {
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListChatsResp {
    pub chats: Vec<ChatRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Message row
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MessageRow {
    pub _id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    #[serde(rename = "messageId")]
    pub message_id: i64,
    pub direction: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fromUserId")]
    pub from_user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fromUsername")]
    pub from_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "replyToMessageId")]
    pub reply_to_message_id: Option<i64>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListMessagesQuery {
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListMessagesResp {
    pub messages: Vec<MessageRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Send text body
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SendTextBody {
    pub text: String,
    #[serde(default, rename = "replyToMessageId")]
    pub reply_to_message_id: Option<i64>,
    #[serde(default, rename = "businessConnectionId")]
    pub business_connection_id: Option<String>,
    #[serde(default, rename = "parseMode")]
    pub parse_mode: Option<String>,
}
