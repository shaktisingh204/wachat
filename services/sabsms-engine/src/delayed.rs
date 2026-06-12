//! Delayed-send queue: a Redis ZSET (`sabsms:delayed`) scored by the
//! epoch second a message becomes due. A 1s ticker promotes due ids to
//! the main send list. ZREM acts as the atomicity guard so multiple
//! engine processes never double-promote the same id.

use std::sync::Arc;

use anyhow::Result;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;

use crate::{queue, state::AppState};

pub const DELAYED_ZSET: &str = "sabsms:delayed";

/// Schedule a message id to be (re-)enqueued at `run_at_epoch` (seconds).
pub async fn schedule(
    conn: &mut ConnectionManager,
    message_id: &str,
    run_at_epoch: u64,
) -> Result<()> {
    let _: () = conn.zadd(DELAYED_ZSET, message_id, run_at_epoch).await?;
    Ok(())
}

/// Ticker loop — spawned once per process from `main`.
pub async fn run_ticker(state: Arc<AppState>) {
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        if let Err(e) = tick(&state).await {
            tracing::warn!(?e, "delayed-queue tick failed");
        }
    }
}

async fn tick(state: &Arc<AppState>) -> Result<()> {
    let mut conn = state.redis.clone();
    let now = chrono::Utc::now().timestamp().max(0) as u64;

    let due: Vec<String> = conn
        .zrangebyscore_limit(DELAYED_ZSET, 0, now as isize, 0, 100)
        .await?;

    for id in due {
        // Only promote when WE removed the member — guards against a
        // second engine process racing the same tick.
        let removed: i64 = conn.zrem(DELAYED_ZSET, &id).await?;
        if removed == 1 {
            let _: () = conn.lpush(queue::QUEUE_SEND, &id).await?;
            tracing::debug!(msg_id = %id, "promoted delayed message to send queue");
        }
    }
    Ok(())
}
