use anyhow::Result;
use redis::AsyncCommands;
use sabsms_providers::SmsProvider;
use sabsms_types::SendRequest;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

pub struct QueueProcessor {
    redis_client: redis::Client,
    provider: Arc<dyn SmsProvider>,
    queue_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendJob {
    pub request: SendRequest,
    // Add additional metadata if needed
}

impl QueueProcessor {
    pub fn new(redis_url: &str, provider: Arc<dyn SmsProvider>, queue_name: &str) -> Result<Self> {
        let redis_client = redis::Client::open(redis_url)?;
        Ok(Self {
            redis_client,
            provider,
            queue_name: queue_name.to_string(),
        })
    }

    pub async fn start(&self) -> Result<()> {
        let mut con = self.redis_client.get_multiplexed_async_connection().await?;
        info!("Started listening on queue: {}", self.queue_name);

        loop {
            // Block until a new job is available in the list
            let result: redis::RedisResult<(String, String)> =
                con.blpop(&self.queue_name, 0.0).await;

            match result {
                Ok((_, payload)) => {
                    self.process_job(&payload).await;
                }
                Err(e) => {
                    error!("Redis error pulling from queue {}: {}", self.queue_name, e);
                    // Add a small delay on error to prevent tight looping
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
            }
        }
    }

    async fn process_job(&self, payload: &str) {
        let job: Result<SendJob, _> = serde_json::from_str(payload);

        match job {
            Ok(job) => {
                info!("Processing job to send SMS to {}", job.request.to);
                match self
                    .provider
                    .send_sms(&job.request.to, &job.request.from, &job.request.body)
                    .await
                {
                    Ok(message_id) => {
                        info!("Successfully sent SMS, message_id: {}", message_id);
                    }
                    Err(e) => {
                        error!("Failed to send SMS: {}", e);
                        // TODO: Implement retry logic or push to a DLQ
                    }
                }
            }
            Err(e) => {
                error!("Failed to deserialize job payload: {}. Payload: {}", e, payload);
            }
        }
    }
}
