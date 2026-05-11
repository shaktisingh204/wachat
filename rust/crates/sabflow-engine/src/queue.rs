use std::collections::HashMap;

pub const SABFLOW_QUEUE: &str = "sabflow:executions";
pub const SABFLOW_CRON_QUEUE: &str = "sabflow:cron";
pub const SABFLOW_EXEC_CHANNEL_PREFIX: &str = "sabflow:exec:";
pub const SABFLOW_WEBHOOK_RESPONSE_PREFIX: &str = "sabflow:webhook-response:";

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionJobPayload {
    pub execution_id: String,
    pub flow_id: String,
    pub project_id: String,
    /// Full serialized SabFlowDoc — worker uses this snapshot directly.
    pub flow_snapshot: serde_json::Value,
    /// "manual" | "webhook" | "schedule" | "test"
    pub trigger_mode: String,
    pub trigger_data: Option<serde_json::Value>,
    pub variables: HashMap<String, String>,
}
