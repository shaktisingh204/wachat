//! Wire DTOs for the `telegram-bots` router.
//!
//! Mirrors the `{ success?, error?, message?, … }` envelope convention
//! used by the existing TS server actions in
//! `src/app/actions/telegram.actions.ts`. Bot rows returned to the
//! client expose the safe-to-share fields only — bot tokens and webhook
//! secrets stay server-side.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  Generic ack envelope
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "botId")]
    pub bot_id: Option<String>,
}

// ---------------------------------------------------------------------------
//  Bot row (safe view — no token / secret)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BotRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    /// Telegram numeric bot id (the digits before the `:` in the token).
    #[serde(rename = "botId")]
    pub bot_id: i64,
    pub username: String,
    pub name: String,
    #[serde(rename = "isActive")]
    pub is_active: bool,

    #[serde(skip_serializing_if = "Option::is_none", rename = "webhookUrl")]
    pub webhook_url: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "webhookRegisteredAt"
    )]
    pub webhook_registered_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "webhookInfo")]
    pub webhook_info: Option<WebhookInfoView>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "canJoinGroups")]
    pub can_join_groups: Option<bool>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "canReadAllGroupMessages"
    )]
    pub can_read_all_group_messages: Option<bool>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "supportsInlineQueries"
    )]
    pub supports_inline_queries: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "hasMainWebApp")]
    pub has_main_web_app: Option<bool>,

    /// `"active" | "disconnected" | "error"` — derived from `isActive`
    /// plus the latest webhook error (if any).
    pub status: String,

    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastSeenAt"
    )]
    pub last_seen_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "latencyMs")]
    pub latency_ms: Option<i64>,

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

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct WebhookInfoView {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "pendingUpdateCount")]
    pub pending_update_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastErrorMessage")]
    pub last_error_message: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastErrorDate"
    )]
    pub last_error_date: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "maxConnections")]
    pub max_connections: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "ipAddress")]
    pub ip_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "allowedUpdates")]
    pub allowed_updates: Option<Vec<String>>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "hasCustomCertificate"
    )]
    pub has_custom_certificate: Option<bool>,
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/bots?projectId=…
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListBotsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListBotsResp {
    pub bots: Vec<BotRow>,
    pub total: i64,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/bots/{bot_id}
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct GetBotResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bot: Option<BotRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/bots  — connect a new bot
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ConnectBotBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub token: String,
}

// ---------------------------------------------------------------------------
//  Bot info (getMe refresh)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct BotInfoResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bot: Option<BotRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Commands
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BotCommandDto {
    pub command: String,
    pub description: String,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetCommandsBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub commands: Vec<BotCommandDto>,
    #[serde(default)]
    pub scope: Option<serde_json::Value>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct DeleteCommandsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct GetCommandsQuery {
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct CommandsResp {
    pub commands: Vec<BotCommandDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Name / description / short description
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetNameBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetDescriptionBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub description: String,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetShortDescriptionBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "shortDescription")]
    pub short_description: String,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
}

// ---------------------------------------------------------------------------
//  Menu button
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct MenuButtonResp {
    #[serde(skip_serializing_if = "Option::is_none", rename = "menuButton")]
    pub menu_button: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetMenuButtonBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "menuButton")]
    pub menu_button: serde_json::Value,
}

// ---------------------------------------------------------------------------
//  Default administrator rights
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct AdminRightsDto {
    #[serde(default, rename = "isAnonymous")]
    pub is_anonymous: bool,
    #[serde(default, rename = "canManageChat")]
    pub can_manage_chat: bool,
    #[serde(default, rename = "canDeleteMessages")]
    pub can_delete_messages: bool,
    #[serde(default, rename = "canManageVideoChats")]
    pub can_manage_video_chats: bool,
    #[serde(default, rename = "canRestrictMembers")]
    pub can_restrict_members: bool,
    #[serde(default, rename = "canPromoteMembers")]
    pub can_promote_members: bool,
    #[serde(default, rename = "canChangeInfo")]
    pub can_change_info: bool,
    #[serde(default, rename = "canInviteUsers")]
    pub can_invite_users: bool,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "canPostMessages"
    )]
    pub can_post_messages: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "canEditMessages"
    )]
    pub can_edit_messages: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "canPinMessages"
    )]
    pub can_pin_messages: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "canManageTopics"
    )]
    pub can_manage_topics: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "canPostStories"
    )]
    pub can_post_stories: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "canEditStories"
    )]
    pub can_edit_stories: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "canDeleteStories"
    )]
    pub can_delete_stories: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct AdminRightsQuery {
    #[serde(default, rename = "forChannels")]
    pub for_channels: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AdminRightsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rights: Option<AdminRightsDto>,
    #[serde(rename = "forChannels")]
    pub for_channels: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetAdminRightsBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "forChannels")]
    pub for_channels: bool,
    #[serde(default)]
    pub rights: Option<AdminRightsDto>,
}

// ---------------------------------------------------------------------------
//  Health check
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct HealthResp {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "latencyMs")]
    pub latency_ms: Option<i64>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastSeenAt"
    )]
    pub last_seen_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
//  Bulk disconnect
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct BulkDisconnectBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct BulkDisconnectResp {
    pub success: bool,
    pub disconnected: i64,
    pub failed: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  CSV export
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ExportQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}
