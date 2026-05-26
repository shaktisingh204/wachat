use anyhow::Result;
use async_trait::async_trait;
use redis::AsyncCommands;
use sabsms_types::SendRequest;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SendJob {
    pub request: SendRequest,
}

#[async_trait]
pub trait QueueEnqueuer: Send + Sync {
    async fn enqueue_job(&self, job: SendJob) -> Result<()>;
    async fn enqueue_jobs(&self, jobs: Vec<SendJob>) -> Result<()>;
}

pub struct RedisEnqueuer {
    client: redis::Client,
    queue_name: String,
}

impl RedisEnqueuer {
    pub fn new(redis_url: &str, queue_name: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        Ok(Self {
            client,
            queue_name: queue_name.to_string(),
        })
    }
}

#[async_trait]
impl QueueEnqueuer for RedisEnqueuer {
    async fn enqueue_job(&self, job: SendJob) -> Result<()> {
        let mut con = self.client.get_multiplexed_async_connection().await?;
        let payload = serde_json::to_string(&job)?;
        let _: () = con.rpush(&self.queue_name, payload).await?;
        Ok(())
    }

    async fn enqueue_jobs(&self, jobs: Vec<SendJob>) -> Result<()> {
        if jobs.is_empty() {
            return Ok(());
        }
        let mut con = self.client.get_multiplexed_async_connection().await?;
        let mut payloads = Vec::with_capacity(jobs.len());
        for job in jobs {
            payloads.push(serde_json::to_string(&job)?);
        }
        let _: () = con.rpush(&self.queue_name, payloads).await?;
        Ok(())
    }
}
