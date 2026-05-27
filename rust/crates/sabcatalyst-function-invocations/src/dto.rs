use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::types::InvocationStatus;

pub const MAX_LIMIT: i64 = 500;
pub const DEFAULT_LIMIT: i64 = 100;
fn default_limit() -> i64 { DEFAULT_LIMIT }

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListInvocationsQuery {
    pub function_id: String,
    #[serde(default = "default_limit")] pub limit: i64,
    #[serde(default)] pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListInvocationsResponse {
    #[schema(value_type = Vec<Object>)] pub items: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")] pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecordInvocationBody {
    pub function_id: String,
    pub project_id: String,
    pub duration_ms: u32,
    pub status: InvocationStatus,
    pub request_size_bytes: u32,
    pub response_size_bytes: u32,
    #[serde(default)] pub error_message: Option<String>,
    pub billable_ms: u32,
}
