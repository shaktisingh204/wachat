//! DTOs for the Telegram Broadcasts router.
//!
//! Wire shapes mirror the TS client in
//! `src/lib/rust-client/telegram-broadcasts.ts`. Keys are camelCase to
//! match the rest of the SabNode API surface.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  Generic ack
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "broadcastId")]
    pub broadcast_id: Option<String>,
}

// ---------------------------------------------------------------------------
//  Broadcast row (returned by list/get)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BroadcastRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub name: String,
    pub status: String,
    pub audience: Value,
    pub message: Value,
    #[serde(default)]
    pub media: Value,
    #[serde(default, rename = "inlineKeyboard")]
    pub inline_keyboard: Value,
    /// Legacy counters under `stats` — kept for backwards compat.
    pub stats: Value,
    /// New canonical counter bag (queued/sent/failed/skipped).
    pub counters: Value,
    #[serde(skip_serializing_if = "Option::is_none", rename = "errorSummary")]
    pub error_summary: Option<Value>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "scheduledAt"
    )]
    pub scheduled_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "startedAt"
    )]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "completedAt"
    )]
    pub completed_at: Option<DateTime<Utc>>,
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
//  Queries
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListResp {
    pub broadcasts: Vec<BroadcastRow>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "nextCursor")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct GetResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub broadcast: Option<BroadcastRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Create / update
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub name: String,
    pub audience: Value,
    pub message: Value,
    #[serde(default)]
    pub media: Option<Value>,
    #[serde(default, rename = "inlineKeyboard")]
    pub inline_keyboard: Option<Value>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "scheduledAt"
    )]
    pub scheduled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize, ToSchema, Default)]
pub struct UpdateBody {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub audience: Option<Value>,
    #[serde(default)]
    pub message: Option<Value>,
    #[serde(default)]
    pub media: Option<Value>,
    #[serde(default, rename = "inlineKeyboard")]
    pub inline_keyboard: Option<Value>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "scheduledAt"
    )]
    pub scheduled_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
//  Schedule / cancel / test
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ScheduleBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "scheduledAt"
    )]
    pub scheduled_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ProjectScopedBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TestSendBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: i64,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ProjectScopedQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

// ---------------------------------------------------------------------------
//  Deliveries
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct DeliveryRow {
    pub _id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "errorCode")]
    pub error_code: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "sentAt"
    )]
    pub sent_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct DeliveriesResp {
    pub deliveries: Vec<DeliveryRow>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "nextCursor")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct DeliveriesQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
}

// ---------------------------------------------------------------------------
//  Analytics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct AnalyticsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub from: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub to: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AnalyticsErrorRow {
    pub code: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AnalyticsDayRow {
    pub day: String,
    pub sent: i64,
    pub failed: i64,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AnalyticsResp {
    #[serde(rename = "totalBroadcasts")]
    pub total_broadcasts: i64,
    #[serde(rename = "totalSent")]
    pub total_sent: i64,
    #[serde(rename = "totalFailed")]
    pub total_failed: i64,
    #[serde(rename = "successRate")]
    pub success_rate: f64,
    #[serde(rename = "topErrors")]
    pub top_errors: Vec<AnalyticsErrorRow>,
    #[serde(rename = "byDay")]
    pub by_day: Vec<AnalyticsDayRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
