use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

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

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RuleRow {
    pub _id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub name: String,
    pub trigger: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    #[serde(rename = "caseSensitive")]
    pub case_sensitive: bool,
    #[serde(rename = "matchMode")]
    pub match_mode: String,
    pub response: Value,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    pub priority: i64,
    #[serde(rename = "insideBusinessHoursOnly")]
    pub inside_business_hours_only: bool,
    pub hits: i64,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListQuery {
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListResp {
    pub rules: Vec<RuleRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpsertBody {
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(default, rename = "ruleId")]
    pub rule_id: Option<String>,
    pub name: String,
    pub trigger: Value,
    #[serde(default)]
    pub pattern: Option<String>,
    #[serde(default, rename = "caseSensitive")]
    pub case_sensitive: Option<bool>,
    #[serde(default, rename = "matchMode")]
    pub match_mode: Option<String>,
    pub response: Value,
    #[serde(default, rename = "isActive")]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub priority: Option<i64>,
    #[serde(default, rename = "insideBusinessHoursOnly")]
    pub inside_business_hours_only: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ToggleBody {
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct DeleteQuery {
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}
