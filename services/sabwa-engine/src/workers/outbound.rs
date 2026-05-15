//! Outbound message delivery worker.
//!
//! Implements SABWA_PLAN.md §5 (real-time outbound path) and §8 (worker /
//! queue design):
//!
//! ```text
//!   server action ──LPUSH──▶ sabwa:{sessionId}:outbound ──BRPOP──▶ worker
//!                                                                    │
//!                                                  antiban::Limiter ─┤
//!                                                                    ▼
//!                                                  wa::pool::send_message
//!                                                                    │
//!                                                  Mongo (sabwa_messages)
//!                                                  Redis pub (MessageStatus)
//! ```
//!
//! ## Architecture
//!
//! Instead of spawning one Tokio task per session (which would scale
//! badly across hundreds of linked numbers), we run a **single loop** that
//! periodically refreshes the set of `status=connected` sessions from
//! Mongo and blocks on a single multi-key `BRPOP` over the union of their
//! outbound queues. The `BRPOP key [key ...] timeout` form blocks until
//! *any* of the listed lists has an element ready, so we get fair
//! cross-session draining with one connection. (We use BRPOP instead of
//! BLMPOP because the redis 0.27 BLMPOP wrapper takes a single key arg —
//! BRPOP natively accepts a list of keys via `ToRedisArgs for Vec<T>`.)
//!
//! When no sessions are connected we sleep for [`IDLE_SLEEP_MS`] so we
//! don't busy-loop on `find(status=connected)`. The session set is
//! re-read on every iteration, which is cheap because the list is short
//! (per-project, plan-capped).
//!
//! ## Payload shapes accepted on the queue
//!
//! - Routes (e.g. `routes::messages::send_message`) push:
//!   ```json
//!   { "op": "send", "tempMessageId": "tmp_…", "chatJid": "…@s.whatsapp.net",
//!     "type": "text", "body": "hello", "mediaUrl": null, "caption": null,
//!     "quotedMessageId": null, "mentions": [] }
//!   ```
//! - The scheduler (`scheduler::tick::lpush_outbound`) pushes a full
//!   `ScheduledJob { id, sessionId, projectId, kind, payload }`. We unwrap
//!   `payload` and treat it the same way.
//!
//! Both shapes are parsed loosely via `serde_json::Value` so the worker
//! never blocks shipping new producer formats.

use std::time::Duration;

use anyhow::Context;
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::bson::{self, doc};
use redis::AsyncCommands;
use tokio::time::sleep;

use crate::antiban::{Limiter, LimiterDecision, RateProfile as AntibanProfile};
use crate::db::messages::{MessageStatus, MessageType, MessagesRepo, SabwaMessage};
use crate::db::sessions::{
    self as sessions_db, RateProfile as DbRateProfile, SabwaSession, SessionStatus,
};
use crate::realtime::events::{MessageStatusEvent, SabwaEvent};
use crate::realtime::pubsub;
use crate::state::AppState;
use crate::wa::errors::WaError;
use crate::wa::pool;
use crate::wa::session::SendRequest;

/// How long to block on `BRPOP` per iteration (seconds).
const BRPOP_TIMEOUT_SECS: f64 = 1.0;

/// How long to sleep when there are zero connected sessions to drain.
const IDLE_SLEEP_MS: u64 = 1_000;

/// How long to sleep when a fatal error occurred (e.g. Redis dropped) so
/// we don't tight-loop reconnecting on a flapping network.
const ERROR_BACKOFF_MS: u64 = 2_000;

/// Worker entry point — runs forever (returns only on irrecoverable error).
pub async fn run(state: AppState) -> anyhow::Result<()> {
    tracing::info!(
        target: "sabwa::workers::outbound",
        brpop_timeout_secs = BRPOP_TIMEOUT_SECS,
        "outbound worker starting"
    );

    loop {
        if let Err(err) = run_once(&state).await {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                error = %err,
                "iteration failed — backing off"
            );
            sleep(Duration::from_millis(ERROR_BACKOFF_MS)).await;
        }
    }
}

/// Single drain iteration: snapshot connected sessions, multi-key BRPOP,
/// dispatch the popped payload, persist + publish.
async fn run_once(state: &AppState) -> anyhow::Result<()> {
    let sessions = load_connected_sessions(state).await?;
    if sessions.is_empty() {
        // No live sessions — back off to avoid hammering Mongo.
        sleep(Duration::from_millis(IDLE_SLEEP_MS)).await;
        return Ok(());
    }

    let keys: Vec<String> = sessions
        .iter()
        .filter_map(|s| s.id.map(|oid| outbound_key(&oid.to_hex())))
        .collect();
    if keys.is_empty() {
        sleep(Duration::from_millis(IDLE_SLEEP_MS)).await;
        return Ok(());
    }

    // BRPOP blocks until any of the supplied keys has an item or the
    // timeout fires. The redis crate returns `Option<(key, value)>` —
    // `None` on timeout, which is the common case when traffic is idle.
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .context("redis connect for outbound brpop")?;

    let popped: Option<(String, String)> = conn
        .brpop(keys.as_slice(), BRPOP_TIMEOUT_SECS)
        .await
        .context("BRPOP outbound queues")?;

    let Some((queue_key, payload)) = popped else {
        // Timeout fired without a message — totally normal, loop around.
        return Ok(());
    };

    let session_id = match session_id_from_queue_key(&queue_key) {
        Some(id) => id.to_string(),
        None => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                key = %queue_key,
                "BRPOP returned key that doesn't match sabwa:*:outbound — dropping"
            );
            return Ok(());
        }
    };

    // Find the session record so we can read its rate profile + project id.
    let session = sessions
        .iter()
        .find(|s| s.id.map(|o| o.to_hex()) == Some(session_id.clone()))
        .cloned();
    let session = match session {
        Some(s) => s,
        None => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                session_id = %session_id,
                "popped message for unknown session — re-queueing"
            );
            // Best effort re-queue so a transient session refresh race
            // doesn't lose the user's message.
            let _: Result<i64, _> = conn.lpush(&queue_key, &payload).await;
            return Ok(());
        }
    };

    dispatch_payload(state, &session, &queue_key, &payload).await;
    Ok(())
}

/// Decode, gate, send, persist, and emit MessageStatus for a single payload.
///
/// All branches here are intentionally infallible at the outer level — a
/// bad payload, a WA-side error, or a Mongo write failure must never
/// poison the worker loop. We log loudly and continue.
async fn dispatch_payload(
    state: &AppState,
    session: &SabwaSession,
    queue_key: &str,
    payload: &str,
) {
    let session_oid = match session.id {
        Some(o) => o,
        None => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                "session record missing _id — discarding payload"
            );
            return;
        }
    };
    let session_id = session_oid.to_hex();

    let parsed = match parse_outbound_payload(payload) {
        Some(p) => p,
        None => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                session_id = %session_id,
                payload_preview = %preview(payload),
                "could not parse outbound payload — dropping"
            );
            return;
        }
    };

    tracing::debug!(
        target: "sabwa::workers::outbound",
        session_id = %session_id,
        chat_jid = %parsed.chat_jid,
        kind = %parsed.kind,
        "processing outbound message"
    );

    // Anti-ban gate. The spec accepts back-off (sleep+requeue) on
    // `Throttle` and a hard failure on `BlockedDaily`.
    let profile = map_rate_profile(session.rate_limit_profile);
    let limiter = Limiter {
        redis: &state.redis,
        session_id: &session_id,
        profile,
    };

    match limiter.check().await {
        Ok(LimiterDecision::Allow { jitter_ms }) => {
            // Per-profile jitter before actually dispatching — see
            // SABWA_PLAN.md §9.1.
            if jitter_ms > 0 {
                sleep(Duration::from_millis(jitter_ms as u64)).await;
            }
        }
        Ok(LimiterDecision::Throttle { retry_after_ms }) => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                session_id = %session_id,
                retry_after_ms,
                "rate limited — sleeping and re-queueing"
            );
            sleep(Duration::from_millis(retry_after_ms.min(60_000))).await;
            requeue(state, queue_key, payload).await;
            return;
        }
        Ok(LimiterDecision::BlockedDaily) => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                session_id = %session_id,
                chat_jid = %parsed.chat_jid,
                "daily cap reached — failing message"
            );
            persist_failed(state, session, &parsed, "daily_limit").await;
            publish_status(state, &session_id, &parsed, "failed").await;
            return;
        }
        Err(err) => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                session_id = %session_id,
                error = %err,
                "limiter check failed — re-queueing for retry"
            );
            sleep(Duration::from_millis(500)).await;
            requeue(state, queue_key, payload).await;
            return;
        }
    }

    // Dispatch through the WA session pool.
    let send_req = SendRequest {
        chat_jid: parsed.chat_jid.clone(),
        kind: parsed.kind.clone(),
        body: parsed.body.clone(),
        media_url: parsed.media_url.clone(),
        caption: parsed.caption.clone(),
        quoted_message_id: parsed.quoted_message_id.clone(),
        mentions: parsed.mentions.clone(),
    };

    match pool::send_message(state, &session_id, send_req).await {
        Ok(resp) => {
            // Record success against the rate-limiter so the next `check`
            // sees the bumped counter.
            if let Err(err) = limiter.record_send().await {
                tracing::warn!(
                    target: "sabwa::workers::outbound",
                    session_id = %session_id,
                    error = %err,
                    "limiter.record_send failed — counters may drift"
                );
            }
            persist_sent(state, session, &parsed, &resp.message_id).await;
            publish_status_with_id(state, &session_id, &parsed, &resp.message_id, "sent").await;
        }
        Err(WaError::RateLimited) => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                session_id = %session_id,
                "WA reported rate limit — backing off + re-queueing"
            );
            sleep(Duration::from_millis(5_000)).await;
            requeue(state, queue_key, payload).await;
        }
        Err(WaError::NotPaired) | Err(WaError::AuthExpired) | Err(WaError::Disconnected) => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                session_id = %session_id,
                "session not ready — re-queueing and waiting for reconnect"
            );
            sleep(Duration::from_millis(1_500)).await;
            requeue(state, queue_key, payload).await;
        }
        Err(err) => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                session_id = %session_id,
                chat_jid = %parsed.chat_jid,
                error = %err,
                "send failed — persisting as failed"
            );
            persist_failed(state, session, &parsed, "send_error").await;
            publish_status(state, &session_id, &parsed, "failed").await;
        }
    }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

async fn persist_sent(
    state: &AppState,
    session: &SabwaSession,
    parsed: &OutboundPayload,
    wa_message_id: &str,
) {
    let session_oid = match session.id {
        Some(o) => o,
        None => return,
    };

    let msg = SabwaMessage {
        id: None,
        project_id: session.project_id,
        session_id: session_oid,
        chat_jid: parsed.chat_jid.clone(),
        message_id: wa_message_id.to_string(),
        from_jid: session
            .phone_e164
            .clone()
            .unwrap_or_else(|| session_oid.to_hex()),
        from_me: true,
        message_type: map_message_kind(&parsed.kind),
        body: parsed.body.clone(),
        media_url: parsed.media_url.clone(),
        media_mime: None,
        media_size: None,
        caption: parsed.caption.clone(),
        quoted_message_id: parsed.quoted_message_id.clone(),
        reactions: Vec::new(),
        status: MessageStatus::Sent,
        forwarded: false,
        starred: false,
        ts: Utc::now(),
        edited_at: None,
        deleted_at: None,
    };

    let repo = MessagesRepo::new(&state.db);
    if let Err(err) = repo.insert_many(std::slice::from_ref(&msg)).await {
        tracing::warn!(
            target: "sabwa::workers::outbound",
            session_id = %session_oid.to_hex(),
            error = %err,
            "persist_sent: insert_many failed"
        );
    }
}

async fn persist_failed(
    state: &AppState,
    session: &SabwaSession,
    parsed: &OutboundPayload,
    reason: &str,
) {
    let session_oid = match session.id {
        Some(o) => o,
        None => return,
    };

    // Synthesise a stable message id so the row is dedupable. We prefer
    // the producer-supplied tempMessageId so the UI can correlate its
    // optimistic row with this failure marker.
    let message_id = parsed
        .temp_message_id
        .clone()
        .unwrap_or_else(|| format!("failed_{}", uuid::Uuid::new_v4()));

    let body = parsed
        .body
        .clone()
        .map(|b| format!("{b}\n\n[{reason}]"))
        .or_else(|| Some(format!("[{reason}]")));

    let msg = SabwaMessage {
        id: None,
        project_id: session.project_id,
        session_id: session_oid,
        chat_jid: parsed.chat_jid.clone(),
        message_id,
        from_jid: session
            .phone_e164
            .clone()
            .unwrap_or_else(|| session_oid.to_hex()),
        from_me: true,
        message_type: map_message_kind(&parsed.kind),
        body,
        media_url: parsed.media_url.clone(),
        media_mime: None,
        media_size: None,
        caption: parsed.caption.clone(),
        quoted_message_id: parsed.quoted_message_id.clone(),
        reactions: Vec::new(),
        status: MessageStatus::Failed,
        forwarded: false,
        starred: false,
        ts: Utc::now(),
        edited_at: None,
        deleted_at: None,
    };

    let repo = MessagesRepo::new(&state.db);
    if let Err(err) = repo.insert_many(std::slice::from_ref(&msg)).await {
        tracing::warn!(
            target: "sabwa::workers::outbound",
            session_id = %session_oid.to_hex(),
            error = %err,
            reason = %reason,
            "persist_failed: insert_many failed"
        );
    }
}

async fn publish_status(
    state: &AppState,
    session_id: &str,
    parsed: &OutboundPayload,
    status: &str,
) {
    let message_id = parsed
        .temp_message_id
        .clone()
        .unwrap_or_else(|| "unknown".into());
    publish_status_with_id(state, session_id, parsed, &message_id, status).await;
}

async fn publish_status_with_id(
    state: &AppState,
    session_id: &str,
    parsed: &OutboundPayload,
    message_id: &str,
    status: &str,
) {
    let event = SabwaEvent::MessageStatus(MessageStatusEvent {
        session_id: session_id.to_string(),
        chat_jid: parsed.chat_jid.clone(),
        message_id: message_id.to_string(),
        status: status.to_string(),
        ts: Utc::now().timestamp_millis(),
    });

    if let Err(err) = pubsub::publish(&state.redis, session_id, &event).await {
        tracing::warn!(
            target: "sabwa::workers::outbound",
            session_id = %session_id,
            error = %err,
            "publish MessageStatus failed"
        );
    }
}

async fn requeue(state: &AppState, queue_key: &str, payload: &str) {
    let mut conn = match state.redis.get_multiplexed_async_connection().await {
        Ok(c) => c,
        Err(err) => {
            tracing::warn!(
                target: "sabwa::workers::outbound",
                error = %err,
                "requeue: redis connect failed — message dropped"
            );
            return;
        }
    };
    // LPUSH back so the message lands at the head; we BRPOP from the tail
    // so this preserves FIFO ordering relative to existing items.
    let res: Result<i64, _> = conn.lpush(queue_key, payload).await;
    if let Err(err) = res {
        tracing::warn!(
            target: "sabwa::workers::outbound",
            key = %queue_key,
            error = %err,
            "requeue LPUSH failed"
        );
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct OutboundPayload {
    chat_jid: String,
    kind: String,
    body: Option<String>,
    media_url: Option<String>,
    caption: Option<String>,
    quoted_message_id: Option<String>,
    mentions: Vec<String>,
    /// Producer-supplied correlation id (tempMessageId) — surfaced on the
    /// MessageStatus event so the UI can match its optimistic row.
    temp_message_id: Option<String>,
}

/// Accept both `{ op, chatJid, type, body, ... }` (server-action shape) and
/// `{ id, sessionId, kind, payload: { ... } }` (scheduler `ScheduledJob`
/// shape). Unknown shapes return `None`.
fn parse_outbound_payload(raw: &str) -> Option<OutboundPayload> {
    let value: serde_json::Value = serde_json::from_str(raw).ok()?;

    // If we see a `payload` nested object and a `kind` peer, treat the
    // payload as the message envelope (scheduler form).
    let envelope = if value.get("payload").map(|v| v.is_object()).unwrap_or(false)
        && value.get("kind").is_some()
    {
        value.get("payload").cloned().unwrap_or(value)
    } else {
        value
    };

    let chat_jid = envelope
        .get("chatJid")
        .or_else(|| envelope.get("to"))
        .or_else(|| envelope.get("jid"))
        .and_then(|v| v.as_str())?
        .to_string();

    let kind = envelope
        .get("type")
        .or_else(|| envelope.get("kind"))
        .and_then(|v| v.as_str())
        .unwrap_or("text")
        .to_string();

    let body = envelope
        .get("body")
        .or_else(|| envelope.get("text"))
        .and_then(|v| v.as_str())
        .map(str::to_string);

    let media_url = envelope
        .get("mediaUrl")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let caption = envelope
        .get("caption")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let quoted_message_id = envelope
        .get("quotedMessageId")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    let mentions = envelope
        .get("mentions")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();

    let temp_message_id = envelope
        .get("tempMessageId")
        .or_else(|| envelope.get("messageId"))
        .and_then(|v| v.as_str())
        .map(str::to_string);

    Some(OutboundPayload {
        chat_jid,
        kind,
        body,
        media_url,
        caption,
        quoted_message_id,
        mentions,
        temp_message_id,
    })
}

fn outbound_key(session_id: &str) -> String {
    format!("sabwa:{session_id}:outbound")
}

/// Parse `"sabwa:{id}:outbound"` back to `{id}`. Returns `None` on any
/// other shape so a malformed key never crashes the worker.
fn session_id_from_queue_key(key: &str) -> Option<&str> {
    let stripped = key.strip_prefix("sabwa:")?;
    let session_id = stripped.strip_suffix(":outbound")?;
    if session_id.is_empty() {
        return None;
    }
    Some(session_id)
}

fn map_message_kind(kind: &str) -> MessageType {
    match kind {
        "image" => MessageType::Image,
        "video" => MessageType::Video,
        "audio" => MessageType::Audio,
        "voice" => MessageType::Voice,
        "document" => MessageType::Document,
        "sticker" => MessageType::Sticker,
        "location" => MessageType::Location,
        "contact" => MessageType::Contact,
        "poll" => MessageType::Poll,
        "reaction" => MessageType::Reaction,
        "system" => MessageType::System,
        _ => MessageType::Text,
    }
}

fn map_rate_profile(profile: DbRateProfile) -> AntibanProfile {
    match profile {
        DbRateProfile::Safe => AntibanProfile::Safe,
        DbRateProfile::Normal => AntibanProfile::Normal,
        DbRateProfile::Aggressive => AntibanProfile::Aggressive,
    }
}

fn preview(payload: &str) -> String {
    const MAX: usize = 200;
    if payload.len() <= MAX {
        payload.to_string()
    } else {
        format!("{}…", &payload[..MAX])
    }
}

/// Fetch every `status=connected` session across all projects.
///
/// The `sabwa_sessions` collection is naturally bounded by plan caps
/// (Free=1, Pro=3, Business=10) so a full scan is fine until we have
/// dozens of paying tenants. Once we cross that line, swap to a paged
/// cursor or maintain a Redis SET of connected ids.
async fn load_connected_sessions(state: &AppState) -> anyhow::Result<Vec<SabwaSession>> {
    let connected = bson::to_bson(&SessionStatus::Connected)
        .context("encode SessionStatus::Connected for query")?;
    let col = sessions_db::collection(&state.db);
    let cursor = col
        .find(doc! { "status": connected })
        .await
        .context("sabwa_sessions.find(status=connected)")?;
    let sessions: Vec<SabwaSession> =
        cursor.try_collect().await.context("collect connected sessions")?;
    Ok(sessions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_route_shape() {
        let raw = r#"{
            "op": "send",
            "tempMessageId": "tmp_1",
            "chatJid": "91xxx@s.whatsapp.net",
            "type": "text",
            "body": "hi",
            "mediaUrl": null,
            "caption": null,
            "quotedMessageId": null,
            "mentions": []
        }"#;
        let p = parse_outbound_payload(raw).unwrap();
        assert_eq!(p.chat_jid, "91xxx@s.whatsapp.net");
        assert_eq!(p.kind, "text");
        assert_eq!(p.body.as_deref(), Some("hi"));
        assert_eq!(p.temp_message_id.as_deref(), Some("tmp_1"));
    }

    #[test]
    fn parse_scheduler_shape() {
        let raw = r#"{
            "id": "job1",
            "sessionId": "sess1",
            "projectId": "proj1",
            "scheduledForTs": 0,
            "kind": "send_message",
            "payload": { "chatJid": "g@g.us", "type": "image", "mediaUrl": "https://x/y.jpg" }
        }"#;
        let p = parse_outbound_payload(raw).unwrap();
        assert_eq!(p.chat_jid, "g@g.us");
        assert_eq!(p.kind, "image");
        assert_eq!(p.media_url.as_deref(), Some("https://x/y.jpg"));
    }

    #[test]
    fn parses_session_id_from_key() {
        assert_eq!(
            session_id_from_queue_key("sabwa:abc123:outbound"),
            Some("abc123")
        );
        assert_eq!(session_id_from_queue_key("sabwa::outbound"), None);
        assert_eq!(session_id_from_queue_key("sabwa:abc:other"), None);
    }
}
