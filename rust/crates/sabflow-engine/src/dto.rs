use std::collections::HashMap;

#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TriggerExecutionRequest {
    pub trigger_mode: String,
    pub trigger_data: Option<serde_json::Value>,
    pub initial_variables: Option<HashMap<String, String>>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TriggerExecutionResponse {
    pub execution_id: String,
    pub status: String,
    pub started_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>)]
    pub id: Option<bson::oid::ObjectId>,
    pub execution_id: String,
    pub flow_id: String,
    pub project_id: String,
    /// "queued" | "running" | "success" | "error" | "cancelled"
    pub status: String,
    /// "manual" | "webhook" | "schedule" | "test"
    pub trigger_mode: String,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
    pub duration_ms: Option<u64>,
    pub node_results: Vec<NodeExecutionResult>,
    pub error: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NodeExecutionResult {
    pub block_id: String,
    pub block_type: String,
    pub status: String,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub finished_at: chrono::DateTime<chrono::Utc>,
    pub input_data: Option<serde_json::Value>,
    pub output_data: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ActivateFlowResponse {
    pub flow_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListExecutionsQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub status: Option<String>,
}
