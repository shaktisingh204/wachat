use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::types::TableSchema;

pub const MAX_LIMIT: i64 = 100;
fn default_limit() -> i64 { 50 }

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTablesQuery {
    pub project_id: String,
    #[serde(default = "default_limit")] pub limit: i64,
    #[serde(default)] pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTablesResponse {
    #[schema(value_type = Vec<Object>)] pub items: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")] pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateTableBody {
    pub project_id: String,
    pub name: String,
    pub schema_json: TableSchema,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTableBody {
    #[serde(default)] pub name: Option<String>,
    #[serde(default)] pub schema_json: Option<TableSchema>,
}
