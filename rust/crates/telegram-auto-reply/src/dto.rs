//! Wire shapes for the telegram-auto-reply BFF.
//!
//! Multi-tenant rule-based auto-reply engine. Every row is scoped to
//! `{ projectId, botId | null }` — a null bot id means the rule applies
//! to every bot in the project.

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
    #[serde(skip_serializing_if = "Option::is_none", rename = "ruleId")]
    pub rule_id: Option<String>,
}

// ---------------------------------------------------------------------------
//  Rule row (returned by list/get)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct Cooldown {
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "perChatSeconds"
    )]
    pub per_chat_seconds: Option<i64>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "perRuleSeconds"
    )]
    pub per_rule_seconds: Option<i64>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "perDayLimit"
    )]
    pub per_day_limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RuleRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId", skip_serializing_if = "Option::is_none")]
    pub bot_id: Option<String>,
    pub name: String,
    /// `"enabled"` | `"disabled"`.
    pub status: String,
    pub priority: i64,
    pub trigger: Value,
    pub conditions: Vec<Value>,
    pub actions: Vec<Value>,
    pub cooldown: Cooldown,
    #[serde(rename = "runCount")]
    pub run_count: i64,
    #[serde(rename = "errorCount")]
    pub error_count: i64,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "lastRunAt",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_run_at: Option<DateTime<Utc>>,
    #[serde(rename = "fired7d")]
    pub fired_7d: i64,
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
//  List / pagination
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
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
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListResp {
    pub rules: Vec<RuleRow>,
    pub total: i64,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Create / update body
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpsertBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    /// `null` = applies to every bot in the project.
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    pub name: String,
    /// `"enabled"` | `"disabled"` (defaults to `"enabled"`).
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<i64>,
    pub trigger: Value,
    #[serde(default)]
    pub conditions: Vec<Value>,
    #[serde(default)]
    pub actions: Vec<Value>,
    #[serde(default)]
    pub cooldown: Option<Cooldown>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct GetQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

// ---------------------------------------------------------------------------
//  Enable / disable
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ScopedBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

// ---------------------------------------------------------------------------
//  Test runner
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, Serialize, ToSchema)]
pub struct SimulatedMessage {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "hasMedia")]
    pub has_media: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "isGroup")]
    pub is_group: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "fromUserId"
    )]
    pub from_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "senderTag")]
    pub sender_tag: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "senderRole"
    )]
    pub sender_role: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "languageCode"
    )]
    pub language_code: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "isFirstMessage"
    )]
    pub is_first_message: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TestBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "simulatedMessage")]
    pub simulated_message: SimulatedMessage,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct EvalStep {
    pub stage: String,
    pub label: String,
    pub passed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct TestResp {
    pub matched: bool,
    #[serde(rename = "actionsThatWouldFire")]
    pub actions_that_would_fire: Vec<Value>,
    pub steps: Vec<EvalStep>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Reorder
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ReorderBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "orderedIds")]
    pub ordered_ids: Vec<String>,
}

// ---------------------------------------------------------------------------
//  Runs (fire log)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RunRow {
    pub _id: String,
    #[serde(rename = "ruleId")]
    pub rule_id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId", skip_serializing_if = "Option::is_none")]
    pub bot_id: Option<String>,
    #[serde(rename = "chatId", skip_serializing_if = "Option::is_none")]
    pub chat_id: Option<String>,
    #[serde(rename = "triggerSummary")]
    pub trigger_summary: String,
    #[serde(rename = "actionsCount")]
    pub actions_count: i64,
    pub status: String,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "firedAt"
    )]
    pub fired_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct RunsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct RunsResp {
    pub runs: Vec<RunRow>,
    #[serde(rename = "nextCursor", skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Match (internal — webhook handler entry point)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
pub struct MatchUpdate {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default, rename = "hasMedia")]
    pub has_media: Option<bool>,
    #[serde(default, rename = "isGroup")]
    pub is_group: Option<bool>,
    #[serde(default, rename = "chatId")]
    pub chat_id: Option<String>,
    #[serde(default, rename = "fromUserId")]
    pub from_user_id: Option<String>,
    #[serde(default, rename = "senderTag")]
    pub sender_tag: Option<String>,
    #[serde(default, rename = "senderRole")]
    pub sender_role: Option<String>,
    #[serde(default, rename = "languageCode")]
    pub language_code: Option<String>,
    #[serde(default, rename = "isFirstMessage")]
    pub is_first_message: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct MatchBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(default)]
    pub update: MatchUpdate,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MatchedRule {
    #[serde(rename = "ruleId")]
    pub rule_id: String,
    pub name: String,
    pub priority: i64,
    pub actions: Vec<Value>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct MatchResp {
    pub matched: Vec<MatchedRule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Conflicts
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ConflictsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ConflictPair {
    #[serde(rename = "ruleAId")]
    pub rule_a_id: String,
    #[serde(rename = "ruleAName")]
    pub rule_a_name: String,
    #[serde(rename = "ruleBId")]
    pub rule_b_id: String,
    #[serde(rename = "ruleBName")]
    pub rule_b_name: String,
    pub reason: String,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ConflictsResp {
    pub pairs: Vec<ConflictPair>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
