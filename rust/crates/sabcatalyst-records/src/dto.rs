use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

pub const MAX_LIMIT: i64 = 200;
fn default_limit() -> i64 {
    50
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRecordsQuery {
    pub table_id: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRecordsResponse {
    #[schema(value_type = Vec<Object>)]
    pub items: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordBody {
    pub table_id: String,
    pub project_id: String,
    pub data_json: Value,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecordBody {
    pub data_json: Value,
}
