use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

pub const MAX_LIMIT: i64 = 200;
fn default_limit() -> i64 { 50 }

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListEntriesQuery {
    pub project_id: String,
    #[serde(default)] pub key_prefix: Option<String>,
    #[serde(default = "default_limit")] pub limit: i64,
    #[serde(default)] pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListEntriesResponse {
    #[schema(value_type = Vec<Object>)] pub items: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")] pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntryBody {
    pub project_id: String,
    pub key: String,
    pub sabfiles_file_id: String,
    pub size_bytes: i64,
    pub content_type: String,
    #[serde(default)] pub public: Option<bool>,
}
