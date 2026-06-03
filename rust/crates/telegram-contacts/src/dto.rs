//! Request / response shapes for the Telegram Contacts slice. All
//! field names use camelCase on the wire so the Next.js client can
//! consume them without remapping.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "contactId")]
    pub contact_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Contact row
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct ContactRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId", skip_serializing_if = "Option::is_none")]
    pub bot_id: Option<String>,
    /// Telegram chat id (i64). For manual contacts without a chat,
    /// we store `0` so the dedupe index can still be applied.
    #[serde(rename = "chatId")]
    pub chat_id: i64,
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName", skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(rename = "languageCode", skip_serializing_if = "Option::is_none")]
    pub language_code: Option<String>,
    #[serde(rename = "phoneNumber", skip_serializing_if = "Option::is_none")]
    pub phone_number: Option<String>,
    #[serde(rename = "isBot")]
    pub is_bot: bool,
    #[serde(rename = "isPremium")]
    pub is_premium: bool,
    #[serde(rename = "isVerified")]
    pub is_verified: bool,
    pub tags: Vec<String>,
    pub notes: String,
    #[serde(rename = "customFields")]
    pub custom_fields: HashMap<String, String>,
    #[serde(rename = "assignedAgentId", skip_serializing_if = "Option::is_none")]
    pub assigned_agent_id: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "lastInteractionAt",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_interaction_at: Option<DateTime<Utc>>,
    pub source: String,
    pub blocked: bool,
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

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub tag: Option<String>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
    #[serde(default, rename = "hasPhone")]
    pub has_phone: Option<bool>,
    #[serde(default)]
    pub blocked: Option<bool>,
    #[serde(default, rename = "assignedAgentId")]
    pub assigned_agent_id: Option<String>,
    #[serde(default, rename = "lastInteractionAfter")]
    pub last_interaction_after: Option<String>,
    #[serde(default, rename = "lastInteractionBefore")]
    pub last_interaction_before: Option<String>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub contacts: Vec<ContactRow>,
    pub total: i64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "contactId")]
    pub contact_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default, rename = "chatId")]
    pub chat_id: Option<i64>,
    #[serde(default, rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(default, rename = "lastName")]
    pub last_name: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
    #[serde(default, rename = "phoneNumber")]
    pub phone_number: Option<String>,
    #[serde(default, rename = "isBot")]
    pub is_bot: Option<bool>,
    #[serde(default, rename = "isPremium")]
    pub is_premium: Option<bool>,
    #[serde(default, rename = "isVerified")]
    pub is_verified: Option<bool>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default, rename = "customFields")]
    pub custom_fields: Option<HashMap<String, String>>,
    #[serde(default, rename = "assignedAgentId")]
    pub assigned_agent_id: Option<String>,
    #[serde(default)]
    pub blocked: Option<bool>,
    #[serde(default)]
    pub source: Option<String>,
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize)]
pub struct DetailResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact: Option<ContactRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct BulkIdsBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct BulkResultResp {
    pub success: bool,
    pub affected: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BulkTagBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub ids: Vec<String>,
    #[serde(default)]
    pub add: Option<Vec<String>>,
    #[serde(default)]
    pub remove: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BulkAssignBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub ids: Vec<String>,
    #[serde(default, rename = "assignedAgentId")]
    pub assigned_agent_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Sync from chats
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct SyncFromChatsBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct SyncFromChatsResp {
    pub success: bool,
    pub inserted: i64,
    pub updated: i64,
    pub scanned: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ImportBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    pub csv: String,
    /// "append" (default) or "replace".
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ImportResp {
    pub success: bool,
    pub inserted: i64,
    pub updated: i64,
    pub skipped: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct SegmentRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub filter: serde_json::Value,
    #[serde(rename = "memberCount")]
    pub member_count: i64,
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

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListSegmentsResp {
    pub segments: Vec<SegmentRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateSegmentBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Free-form filter shape; we persist as JSON and re-hydrate to a
    /// `ListQuery` when evaluating.
    pub filter: serde_json::Value,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct SegmentAckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none", rename = "segmentId")]
    pub segment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SegmentContactsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct SegmentContactsResp {
    pub contacts: Vec<ContactRow>,
    #[serde(rename = "nextCursor", skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    pub total: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LanguageCount {
    pub code: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TagCount {
    pub tag: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DayPoint {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AnalyticsResp {
    pub total: i64,
    #[serde(rename = "newInRange")]
    pub new_in_range: i64,
    pub churned: i64,
    #[serde(rename = "topTags")]
    pub top_tags: Vec<TagCount>,
    pub languages: Vec<LanguageCount>,
    #[serde(rename = "byDay")]
    pub by_day: Vec<DayPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Resolve (internal — webhook hook)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ResolveBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: i64,
    #[serde(default, rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(default, rename = "lastName")]
    pub last_name: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
    #[serde(default, rename = "isBot")]
    pub is_bot: Option<bool>,
    #[serde(default, rename = "isPremium")]
    pub is_premium: Option<bool>,
    #[serde(default, rename = "isVerified")]
    pub is_verified: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ResolveResp {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact: Option<ContactRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
