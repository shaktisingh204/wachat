use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

pub const MAX_LIMIT: i64 = 200;
fn default_limit() -> i64 {
    50
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsQuery {
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub auth_user_id: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsResponse {
    #[schema(value_type = Vec<Object>)]
    pub items: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IssueSessionBody {
    pub auth_user_id: String,
    pub project_id: String,
    pub token_hash: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    #[serde(default)]
    pub ip: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
}
