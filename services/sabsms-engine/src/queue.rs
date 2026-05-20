use anyhow::{Context, Result};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;

use crate::config::Config;

pub const QUEUE_SEND: &str = "sabsms:queue:send";

pub async fn connect(cfg: &Config) -> Result<ConnectionManager> {
    let client =
        redis::Client::open(cfg.redis_url.as_str()).context("opening Redis client")?;
    ConnectionManager::new(client)
        .await
        .context("Redis connection manager")
}

/// Push a message id onto the send queue (LPUSH + RPOP semantics).
pub async fn enqueue_send(conn: &mut ConnectionManager, message_id: &str) -> Result<()> {
    let _: () = conn.lpush(QUEUE_SEND, message_id).await?;
    Ok(())
}

/// Blocking pop with timeout (seconds). Returns `None` when no job
/// appears within the timeout — caller loops and retries.
pub async fn dequeue_send(
    conn: &mut ConnectionManager,
    timeout_secs: f64,
) -> Result<Option<String>> {
    let out: Option<(String, String)> = conn.brpop(QUEUE_SEND, timeout_secs).await?;
    Ok(out.map(|(_queue, id)| id))
}
