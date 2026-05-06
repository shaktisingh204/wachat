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
    #[serde(skip_serializing_if = "Option::is_none", rename = "webhookRegisteredAt")]
    pub webhook_registered_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "webhookInfo")]
    pub webhook_info: Option<WebhookInfoView>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "canJoinGroups")]
    pub can_join_groups: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "canReadAllGroupMessages")]
    pub can_read_all_group_messages: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "supportsInlineQueries")]
    pub supports_inline_queries: Option<bool>,

    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
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
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastErrorDate")]
    pub last_error_date: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/bots?projectId=…
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListBotsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListBotsResp {
    pub bots: Vec<BotRow>,
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
