use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::types::{FunctionKind, FunctionRuntime, FunctionStatus};

pub const MAX_LIMIT: i64 = 100;
pub const DEFAULT_LIMIT: i64 = 25;
fn default_limit() -> i64 { DEFAULT_LIMIT }

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListFunctionsQuery {
    pub project_id: String,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListFunctionsResponse {
    #[schema(value_type = Vec<Object>)]
    pub items: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateFunctionBody {
    pub project_id: String,
    pub name: String,
    #[serde(default)]
    pub kind: Option<FunctionKind>,
    #[serde(default)]
    pub runtime: Option<FunctionRuntime>,
    #[serde(default)]
    pub code_blob_file_id: Option<String>,
    pub entrypoint: String,
    #[serde(default)]
    pub env_vars_json: Option<Value>,
    #[serde(default)]
    pub timeout_ms: Option<u32>,
    #[serde(default)]
    pub memory_mb: Option<u32>,
    #[serde(default)]
    pub schedule: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFunctionBody {
    #[serde(default)] pub name: Option<String>,
    #[serde(default)] pub code_blob_file_id: Option<String>,
    #[serde(default)] pub entrypoint: Option<String>,
    #[serde(default)] pub env_vars_json: Option<Value>,
    #[serde(default)] pub timeout_ms: Option<u32>,
    #[serde(default)] pub memory_mb: Option<u32>,
    #[serde(default)] pub schedule: Option<String>,
    #[serde(default)] pub status: Option<FunctionStatus>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarkDeployedBody {
    pub code_blob_file_id: String,
}
