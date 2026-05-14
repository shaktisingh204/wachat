//! Thin async helpers around Redis pub/sub for SabWa events.
//!
//! All real-time fan-out goes through Redis (`sabwa:{sessionId}:events`),
//! per `SABWA_PLAN.md` §5. The worker calls [`publish`]; HTTP handlers call
//! [`subscribe`] to obtain a typed [`Stream`] of [`SabwaEvent`]s.

use anyhow::Context;
use futures::{Stream, StreamExt};
use redis::AsyncCommands;

use super::events::{self, SabwaEvent};

/// Publish a [`SabwaEvent`] to the Redis channel for `session_id`.
///
/// The payload is JSON-encoded. The function returns once Redis has
/// acknowledged the PUBLISH; it does **not** wait for any subscriber to
/// actually receive the message — Redis pub/sub is fire-and-forget.
pub async fn publish(
    redis: &redis::Client,
    session_id: &str,
    event: &SabwaEvent,
) -> anyhow::Result<()> {
    let channel = events::channel(session_id);
    let payload = serde_json::to_string(event)
        .context("serialising SabwaEvent for Redis publish")?;

    let mut conn = redis
        .get_multiplexed_async_connection()
        .await
        .context("opening Redis connection for publish")?;

    // `_: ()` discards the subscriber count Redis returns.
    let _: () = conn
        .publish(&channel, payload)
        .await
        .with_context(|| format!("PUBLISH to {channel}"))?;

    tracing::debug!(
        target: "sabwa::realtime::pubsub",
        channel = %channel,
        "published event"
    );
    Ok(())
}

/// Subscribe to the Redis channel for `session_id` and return a stream of
/// deserialised [`SabwaEvent`]s.
///
/// Malformed payloads (bad UTF-8, JSON that doesn't match the schema) are
/// **silently dropped** after a `tracing::warn!` — one bad publisher must
/// not be able to break every connected client.
///
/// The returned stream owns its own `PubSub` connection; dropping it
/// releases the connection back to the system.
pub async fn subscribe(
    redis: &redis::Client,
    session_id: &str,
) -> anyhow::Result<impl Stream<Item = SabwaEvent>> {
    let channel = events::channel(session_id);

    let mut pubsub = redis
        .get_async_pubsub()
        .await
        .context("opening Redis pub/sub connection")?;
    pubsub
        .subscribe(&channel)
        .await
        .with_context(|| format!("SUBSCRIBE to {channel}"))?;

    tracing::debug!(
        target: "sabwa::realtime::pubsub",
        channel = %channel,
        "subscribed"
    );

    // `into_on_message()` consumes the `PubSub` and yields a `Stream<Msg>`
    // that keeps the underlying connection alive as long as the stream lives.
    let channel_for_log = channel.clone();
    let stream = pubsub.into_on_message().filter_map(move |msg| {
        let channel = channel_for_log.clone();
        async move {
            let payload: Vec<u8> = match msg.get_payload() {
                Ok(p) => p,
                Err(err) => {
                    tracing::warn!(
                        target: "sabwa::realtime::pubsub",
                        channel = %channel,
                        error = %err,
                        "failed to extract payload bytes"
                    );
                    return None;
                }
            };

            match serde_json::from_slice::<SabwaEvent>(&payload) {
                Ok(ev) => Some(ev),
                Err(err) => {
                    tracing::warn!(
                        target: "sabwa::realtime::pubsub",
                        channel = %channel,
                        error = %err,
                        bytes = payload.len(),
                        "dropping malformed SabwaEvent payload"
                    );
                    None
                }
            }
        }
    });

    Ok(stream)
}
