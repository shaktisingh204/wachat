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
                error!(
                    "Failed to deserialize job payload: {}. Payload: {}",
                    e, payload
                );
            }
        }
    }
}

#[derive(Clone)]
pub struct QueueClient {
    redis_client: redis::Client,
    queue_name: String,
}

impl QueueClient {
    pub fn new(redis_url: &str, queue_name: &str) -> Result<Self> {
        let redis_client = redis::Client::open(redis_url)?;
        Ok(Self {
            redis_client,
            queue_name: queue_name.to_string(),
        })
    }

    pub async fn enqueue_job(&self, job: &SendJob) -> Result<()> {
        let mut con = self.redis_client.get_multiplexed_async_connection().await?;
        let payload = serde_json::to_string(job)?;
        // Bind the result to `()` so rustc doesn't fall back to `!` for the
        // generic return type of `AsyncCommands::rpush` (rust-lang/rust#148922
        // regression — `!` lost its `FromRedisValue` impl).
        let _: () = con.rpush(&self.queue_name, payload).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use sabsms_types::SendRequest;

    struct MockProvider;

    #[async_trait]
    impl SmsProvider for MockProvider {
        async fn send_sms(
            &self,
            _to: &str,
            _from: &str,
            _body: &str,
        ) -> std::result::Result<String, String> {
            Ok("mock-id".to_string())
        }
    }

    #[test]
    fn test_send_job_serialization() {
        let job = SendJob {
            request: SendRequest {
                to: "+1234567890".to_string(),
                from: "+0987654321".to_string(),
                body: "Hello".to_string(),
            },
        };
        let serialized = serde_json::to_string(&job).unwrap();
        assert!(serialized.contains("+1234567890"));
    }

    // An actual Redis test might fail if redis isn't running, so we keep it simple or ignored
    #[tokio::test]
    #[ignore]
    async fn test_redis_queue_flow() {
        let redis_url = "redis://127.0.0.1:6379/";
        let queue_name = "test_sms_queue";

        let client = QueueClient::new(redis_url, queue_name).unwrap();
        let job = SendJob {
            request: SendRequest {
                to: "+111".to_string(),
                from: "+222".to_string(),
                body: "test".to_string(),
            },
        };

        client.enqueue_job(&job).await.unwrap();

        let provider = Arc::new(MockProvider);
        let processor = QueueProcessor::new(redis_url, provider, queue_name).unwrap();

        // This would block indefinitely in a real test without a timeout
        let mut con = processor
            .redis_client
            .get_multiplexed_async_connection()
            .await
            .unwrap();
        let result: redis::RedisResult<(String, String)> = con.blpop(queue_name, 1.0).await;
        assert!(result.is_ok());
    }
}
