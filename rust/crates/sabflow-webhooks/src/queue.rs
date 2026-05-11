use anyhow::Result;
use serde::{Deserialize, Serialize};
use wachat_queue::{Backoff, BullProducer, JobOptions};

pub const SABFLOW_QUEUE: &str = "sabflow:executions";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookExecutionPayload {
    pub execution_id: String,
    pub flow_id: String,
    pub project_id: String,
    pub flow_snapshot: serde_json::Value,
    pub trigger_mode: String,
    pub trigger_data: Option<serde_json::Value>,
    pub variables: std::collections::HashMap<String, String>,
}

pub async fn enqueue_webhook_execution(
    bull: &BullProducer,
    payload: &WebhookExecutionPayload,
) -> Result<()> {
    bull.add(
        SABFLOW_QUEUE,
        "execute",
        payload,
        JobOptions {
            attempts: 3,
            backoff: Backoff::Exponential { delay_ms: 2000 },
            ..Default::default()
        },
    )
    .await?;
    Ok(())
}
