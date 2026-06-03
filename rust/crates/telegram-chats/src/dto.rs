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
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastMessageAt"
    )]
    pub last_message_at: Option<DateTime<Utc>>,
    #[serde(rename = "unreadCount")]
    pub unread_count: i64,
    #[serde(skip_serializing_if = "Option::is_none", rename = "isOptedOut")]
    pub is_opted_out: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "memberCount")]
    pub member_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "pinnedMessageId")]
    pub pinned_message_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "photoUrl")]
    pub photo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<serde_json::Value>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListChatsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub q: Option<String>,
    /// `private | group | supergroup | channel`
    #[serde(default, rename = "type")]
    pub chat_type: Option<String>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListChatsResp {
    pub chats: Vec<ChatRow>,
    #[serde(default)]
    pub total: i64,
    #[serde(default, rename = "hasMore")]
    pub has_more: bool,
    #[serde(default)]
    pub page: i64,
    #[serde(default, rename = "pageSize")]
    pub page_size: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Message row (extended)
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
    #[serde(skip_serializing_if = "Option::is_none", rename = "mediaKind")]
    pub media_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "mediaFileId")]
    pub media_file_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "mediaUrl")]
    pub media_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "sabFileId")]
    pub sab_file_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fromUserId")]
    pub from_user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fromUsername")]
    pub from_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fromName")]
    pub from_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "replyToMessageId")]
    pub reply_to_message_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "replyToText")]
    pub reply_to_text: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(rename = "isDeleted")]
    pub is_deleted: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "editedAt"
    )]
    pub edited_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "readAt"
    )]
    pub read_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "sentAt"
    )]
    pub sent_at: Option<DateTime<Utc>>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListMessagesQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListMessagesResp {
    pub messages: Vec<MessageRow>,
    #[serde(default, rename = "hasMore")]
    pub has_more: bool,
    #[serde(
        default,
        rename = "nextCursor",
        skip_serializing_if = "Option::is_none"
    )]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Send body — text or media
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SendMessageBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(default)]
    pub text: Option<String>,
    /// `photo | video | document | audio | voice`
    #[serde(default, rename = "mediaKind")]
    pub media_kind: Option<String>,
    /// SabFile node id (preferred — the server resolves the URL).
    #[serde(default, rename = "sabFileId")]
    pub sab_file_id: Option<String>,
    /// SabFile public URL. Use this when sabFileId isn't available (the
    /// SabFile picker already gives the caller a URL).
    #[serde(default, rename = "sabFileUrl")]
    pub sab_file_url: Option<String>,
    #[serde(default, rename = "sabFileName")]
    pub sab_file_name: Option<String>,
    #[serde(default, rename = "sabFileMime")]
    pub sab_file_mime: Option<String>,
    #[serde(default)]
    pub caption: Option<String>,
    #[serde(default, rename = "replyToMessageId")]
    pub reply_to_message_id: Option<i64>,
    #[serde(default, rename = "parseMode")]
    pub parse_mode: Option<String>,
    #[serde(default, rename = "disableNotification")]
    pub disable_notification: Option<bool>,
    #[serde(default, rename = "disableWebPagePreview")]
    pub disable_web_page_preview: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct SendMessageResp {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "messageId")]
    pub message_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row: Option<MessageRow>,
}

// ---------------------------------------------------------------------------
//  Edit / delete / forward / copy / pin
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct EditMessageBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub caption: Option<String>,
    #[serde(default, rename = "parseMode")]
    pub parse_mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectBotQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ForwardBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "toChatId")]
    pub to_chat_id: String,
    #[serde(default, rename = "disableNotification")]
    pub disable_notification: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CopyBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "toChatId")]
    pub to_chat_id: String,
    #[serde(default)]
    pub caption: Option<String>,
    #[serde(default, rename = "parseMode")]
    pub parse_mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct PinBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(default, rename = "disableNotification")]
    pub disable_notification: Option<bool>,
}

// ---------------------------------------------------------------------------
//  Chat action (typing)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ChatActionBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub action: String,
}

// ---------------------------------------------------------------------------
//  Get chat
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ChatResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat: Option<ChatRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ChatMemberResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Cross-chat search
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SearchQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default, rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SearchHit {
    #[serde(flatten)]
    pub message: MessageRow,
    #[serde(skip_serializing_if = "Option::is_none", rename = "chatTitle")]
    pub chat_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "chatType")]
    pub chat_type: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct SearchResp {
    pub messages: Vec<SearchHit>,
    #[serde(default, rename = "hasMore")]
    pub has_more: bool,
    #[serde(
        default,
        rename = "nextCursor",
        skip_serializing_if = "Option::is_none"
    )]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Legacy text body (kept so the existing `/bot/chat/messages` POST route
//  still compiles — handlers still use it for the v1 send-text path).
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
