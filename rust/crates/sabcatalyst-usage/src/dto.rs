use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::types::UsagePeriod;

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetUsageQuery {
    pub project_id: String,
    pub period: UsagePeriod,
    #[serde(default)] pub period_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UsageRollupResponse {
    #[schema(value_type = Vec<Object>)] pub rows: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IncrementUsageBody {
    pub project_id: String,
    pub period: UsagePeriod,
    pub period_key: String,
    #[serde(default)] pub function_invocations: Option<i64>,
    #[serde(default)] pub function_billable_ms: Option<i64>,
    #[serde(default)] pub datastore_reads: Option<i64>,
    #[serde(default)] pub datastore_writes: Option<i64>,
    #[serde(default)] pub file_storage_bytes: Option<i64>,
    #[serde(default)] pub bandwidth_bytes: Option<i64>,
}
