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
    #[serde(skip_serializing_if = "Option::is_none", rename = "broadcastId")]
    pub broadcast_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BroadcastRow {
    pub _id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub name: String,
    pub status: String,
    pub audience: Value,
    pub message: Value,
    pub stats: Value,
    #[serde(skip_serializing_if = "Option::is_none", rename = "scheduledAt")]
    pub scheduled_at: Option<DateTime<Utc>>,
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
    pub broadcasts: Vec<BroadcastRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateBody {
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub name: String,
    pub audience: Value,
    pub message: Value,
    #[serde(default, rename = "scheduledAt")]
    pub scheduled_at: Option<DateTime<Utc>>,
}
