//! Inbound real-time event persister.
//!
//! Subscribes to `PSUBSCRIBE sabwa:*:events` on Redis (matches every
//! session's pub/sub channel — see SABWA_PLAN.md §5) and writes the
//! durable side-effects each event implies:
//!
//! | Event           | Action                                                                  |
//! |-----------------|-------------------------------------------------------------------------|
//! | `Message`       | Upsert into `sabwa_messages` (unique key `messageId`); bump chat unread |
//! | `Chat`          | Upsert `sabwa_chats` with the new metadata                              |
//! | `MessageStatus` | Patch `sabwa_messages.status` (delivered / read / failed receipts)      |
//! | `Presence`      | Log only (not persisted)                                                |
//! | `Typing`        | Log only (not persisted)                                                |
//! | `Qr`            | `sabwa_sessions.status = pending`                                       |
//! | `PairCode`      | `sabwa_sessions.status = pending`                                       |
//! | `Status`        | `sabwa_sessions.status = <event.status>`                                |
//!
//! ## De-duplication with the outbound worker
//!
//! Both this worker and the outbound worker write to `sabwa_messages`. For
//! `fromMe=true` events the outbound worker already persisted the row
//! when the WA send returned `Ok(SendResponse { message_id, .. })`. To
//! avoid duplicates we use an **upsert by `(sessionId, messageId)`** —
//! the unique index on that pair (declared in SABWA_PLAN.md §3) means a
//! repeated insert is reduced to a no-op `$setOnInsert`. Outbound-then-
//! inbound and inbound-then-outbound both converge on a single row.
//!
//! ## Resilience
//!
//! The PubSub loop reconnects on disconnect: if the underlying stream
//! ends we sleep for [`RECONNECT_BACKOFF_MS`] and re-`PSUBSCRIBE`. We
//! never propagate stream errors out of `run` — that would kill the
//! worker; the supervisor in `workers::mod` would then surface a
//! confusing "exited cleanly" message every time the user's home Wi-Fi
//! flapped.

use std::time::Duration;

use anyhow::Context;
use bson::oid::ObjectId;
use chrono::{TimeZone, Utc};
use futures::StreamExt;
use mongodb::bson::{self, doc, Bson};
use mongodb::options::UpdateOptions;
use tokio::time::sleep;

use crate::db::chats::{ChatType, COLLECTION as CHATS_COLLECTION};
use crate::db::messages::{MessageStatus, MessageType, COLLECTION as MESSAGES_COLLECTION};
use crate::db::sessions::{SessionStatus, COLLECTION as SESSIONS_COLLECTION};
use crate::realtime::events::{
    ChatEvent, MessageEvent, MessageStatusEvent, PairCodeEvent, PresenceEvent, QrEvent, SabwaEvent,
    StatusEvent, TypingEvent,
};
use crate::state::AppState;

/// Redis pattern that matches every per-session events channel.
const EVENT_PATTERN: &str = "sabwa:*:events";

/// How long to sleep before re-PSUBSCRIBE'ing after a fatal stream
/// failure (Redis dropped, OOM kill on the broker, …).
const RECONNECT_BACKOFF_MS: u64 = 2_000;

/// Worker entry point — runs forever, reconnecting transparently.
pub async fn run(state: AppState) -> anyhow::Result<()> {
    tracing::info!(
        target: "sabwa::workers::inbound",
        pattern = EVENT_PATTERN,
        "inbound worker starting"
    );

    loop {
        match psubscribe_and_drain(&state).await {
            Ok(()) => {
                tracing::warn!(
                    target: "sabwa::workers::inbound",
                    "psubscribe stream ended — reconnecting"
                );
            }
            Err(err) => {
                tracing::warn!(
                    target: "sabwa::workers::inbound",
                    error = %err,
                    "psubscribe loop crashed — reconnecting"
                );
            }
        }
        sleep(Duration::from_millis(RECONNECT_BACKOFF_MS)).await;
    }
}

/// Open one PubSub connection and drain it until the stream ends.
async fn psubscribe_and_drain(state: &AppState) -> anyhow::Result<()> {
    let mut pubsub = state
        .redis
        .get_async_pubsub()
        .await
        .context("opening redis pub/sub for inbound")?;
    pubsub
        .psubscribe(EVENT_PATTERN)
        .await
        .with_context(|| format!("PSUBSCRIBE {EVENT_PATTERN}"))?;

    tracing::info!(
        target: "sabwa::workers::inbound",
        pattern = EVENT_PATTERN,
        "subscribed — draining events"
    );

    let mut stream = pubsub.on_message();
    while let Some(msg) = stream.next().await {
        let channel = msg.get_channel_name().to_string();
        let session_id = match session_id_from_channel(&channel) {
            Some(id) => id.to_string(),
            None => {
                tracing::warn!(
                    target: "sabwa::workers::inbound",
                    channel = %channel,
                    "skipping non-conforming channel name"
                );
                continue;
            }
        };

        let payload: Vec<u8> = match msg.get_payload() {
            Ok(p) => p,
            Err(err) => {
                tracing::warn!(
                    target: "sabwa::workers::inbound",
                    channel = %channel,
                    error = %err,
                    "could not read payload bytes"
                );
                continue;
            }
        };

        let event: SabwaEvent = match serde_json::from_slice(&payload) {
            Ok(ev) => ev,
            Err(err) => {
                tracing::warn!(
                    target: "sabwa::workers::inbound",
                    channel = %channel,
                    error = %err,
                    bytes = payload.len(),
                    "dropping malformed SabwaEvent"
                );
                continue;
            }
        };

        handle_event(state, &session_id, event).await;
    }
    Ok(())
}

/// Dispatch one decoded event to its persistence side-effect.
async fn handle_event(state: &AppState, session_id: &str, event: SabwaEvent) {
    tracing::debug!(
        target: "sabwa::workers::inbound",
        session_id = %session_id,
        kind = ?event_kind(&event),
        "handling event"
    );
    match event {
        SabwaEvent::Message(ev) => handle_message(state, session_id, ev).await,
        SabwaEvent::MessageStatus(ev) => handle_message_status(state, session_id, ev).await,
        SabwaEvent::Chat(ev) => handle_chat(state, session_id, ev).await,
        SabwaEvent::Presence(ev) => log_presence(session_id, ev),
        SabwaEvent::Typing(ev) => log_typing(session_id, ev),
        SabwaEvent::Qr(ev) => handle_qr(state, session_id, ev).await,
        SabwaEvent::PairCode(ev) => handle_pair_code(state, session_id, ev).await,
        SabwaEvent::Status(ev) => handle_status(state, session_id, ev).await,
        // Scheduler-dispatched events are handled by the scheduler tick
        // itself; we don't persist them here. Logged for visibility.
        SabwaEvent::Scheduled(_) => {
            tracing::debug!(
                target: "sabwa::workers::inbound",
                session_id = %session_id,
                "Scheduled event (not persisted)"
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Per-event handlers
// ---------------------------------------------------------------------------

async fn handle_message(state: &AppState, session_id: &str, ev: MessageEvent) {
    let session_oid = match ObjectId::parse_str(session_id) {
        Ok(o) => o,
        Err(_) => {
            tracing::warn!(
                target: "sabwa::workers::inbound",
                session_id = %session_id,
                "MessageEvent: session_id is not an ObjectId"
            );
            return;
        }
    };

    let ts = ms_to_bson(ev.message.ts);
    let message_type = map_kind(&ev.message.kind);
    let message_type_bson = match bson::to_bson(&message_type) {
        Ok(b) => b,
        Err(err) => {
            tracing::warn!(
                target: "sabwa::workers::inbound",
                error = %err,
                "failed to encode MessageType"
            );
            return;
        }
    };
    let status_bson = match bson::to_bson(&MessageStatus::Sent) {
        Ok(b) => b,
        Err(err) => {
            tracing::warn!(
                target: "sabwa::workers::inbound",
                error = %err,
                "failed to encode MessageStatus"
            );
            return;
        }
    };

    // Upsert by `(sessionId, messageId)` — the unique index on that pair
    // makes the second writer a no-op so outbound + inbound converge.
    //
    // - `$setOnInsert` covers fields the outbound worker may have already
    //   written (avoids clobbering a `from_me=true` row).
    // - `$set` covers fields the inbound worker is authoritative on
    //   (`body` / `mediaUrl` from the WA payload) — but only on
    //   *inbound* messages, so we never clobber outbound rows.
    let mut set_on_insert = doc! {
        "sessionId": session_oid,
        "chatJid": &ev.chat_jid,
        "messageId": &ev.message.message_id,
        "fromJid": &ev.message.from_jid,
        "fromMe": ev.message.from_me,
        "type": message_type_bson,
        "reactions": Vec::<Bson>::new(),
        "status": status_bson,
        "forwarded": false,
        "starred": false,
        "ts": ts.clone(),
    };
    if let Some(body) = &ev.message.body {
        set_on_insert.insert("body", body);
    }
    if let Some(url) = &ev.message.media_url {
        set_on_insert.insert("mediaUrl", url);
    }
    // Best-effort fill projectId from the session if known.
    if let Ok(Some(project_oid)) = lookup_project_id(state, &session_oid).await {
        set_on_insert.insert("projectId", Bson::ObjectId(project_oid));
    }

    let update = doc! { "$setOnInsert": set_on_insert };

    let col = state.db.collection::<bson::Document>(MESSAGES_COLLECTION);
    let opts = UpdateOptions::builder().upsert(true).build();
    let res = col
        .update_one(
            doc! { "sessionId": session_oid, "messageId": &ev.message.message_id },
            update,
        )
        .with_options(opts)
        .await;
    match res {
        Ok(result) => {
            // Only bump unread + lastMessage when the row was actually
            // inserted (otherwise we're racing with the outbound worker
            // on a `from_me=true` row that's already counted).
            if result.upserted_id.is_some() {
                upsert_chat_with_last_message(state, &session_oid, &ev).await;
            } else {
                tracing::debug!(
                    target: "sabwa::workers::inbound",
                    session_id = %session_id,
                    message_id = %ev.message.message_id,
                    "MessageEvent: row already persisted (outbound), skipping chat bump"
                );
            }
        }
        Err(err) => {
            tracing::warn!(
                target: "sabwa::workers::inbound",
                session_id = %session_id,
                message_id = %ev.message.message_id,
                error = %err,
                "MessageEvent upsert failed"
            );
        }
    }
}

async fn handle_message_status(
    state: &AppState,
    session_id: &str,
    ev: MessageStatusEvent,
) {
    let session_oid = match ObjectId::parse_str(session_id) {
        Ok(o) => o,
        Err(_) => return,
    };
    let status = match ev.status.as_str() {
        "sending" => MessageStatus::Sending,
        "sent" => MessageStatus::Sent,
        "delivered" => MessageStatus::Delivered,
        "read" => MessageStatus::Read,
        "failed" => MessageStatus::Failed,
        other => {
            tracing::debug!(
                target: "sabwa::workers::inbound",
                status = %other,
                "ignoring unknown MessageStatus value"
            );
            return;
        }
    };
    let status_bson = match bson::to_bson(&status) {
        Ok(b) => b,
        Err(_) => return,
    };
    let col = state.db.collection::<bson::Document>(MESSAGES_COLLECTION);
    if let Err(err) = col
        .update_one(
            doc! { "sessionId": session_oid, "messageId": &ev.message_id },
            doc! { "$set": { "status": status_bson } },
        )
        .await
    {
        tracing::warn!(
            target: "sabwa::workers::inbound",
            session_id = %session_id,
            message_id = %ev.message_id,
            error = %err,
            "MessageStatus update failed"
        );
    }
}

async fn handle_chat(state: &AppState, session_id: &str, ev: ChatEvent) {
    let session_oid = match ObjectId::parse_str(session_id) {
        Ok(o) => o,
        Err(_) => return,
    };
    let chat_type = match ev.chat.kind.as_str() {
        "group" => ChatType::Group,
        "broadcast" => ChatType::Broadcast,
        "status" => ChatType::Status,
        _ => ChatType::Individual,
    };
    let chat_type_bson = match bson::to_bson(&chat_type) {
        Ok(b) => b,
        Err(_) => return,
    };

    let mut set = doc! {
        "type": chat_type_bson,
        "unreadCount": ev.chat.unread_count as i64,
        "pinned": ev.chat.pinned,
        "archived": ev.chat.archived,
        "muted": ev.chat.muted,
        "updatedAt": ms_to_bson(ev.chat.updated_at),
    };
    if let Some(name) = &ev.chat.name {
        set.insert("name", name);
    }

    let mut set_on_insert = doc! {
        "sessionId": session_oid,
        "jid": &ev.chat.jid,
    };
    if let Ok(Some(project_oid)) = lookup_project_id(state, &session_oid).await {
        set_on_insert.insert("projectId", Bson::ObjectId(project_oid));
    }

    let col = state.db.collection::<bson::Document>(CHATS_COLLECTION);
    let opts = UpdateOptions::builder().upsert(true).build();
    if let Err(err) = col
        .update_one(
            doc! { "sessionId": session_oid, "jid": &ev.chat.jid },
            doc! {
                "$set": set,
                "$setOnInsert": set_on_insert,
            },
        )
        .with_options(opts)
        .await
    {
        tracing::warn!(
            target: "sabwa::workers::inbound",
            session_id = %session_id,
            jid = %ev.chat.jid,
            error = %err,
            "ChatEvent upsert failed"
        );
    }
}

fn log_presence(session_id: &str, ev: PresenceEvent) {
    tracing::debug!(
        target: "sabwa::workers::inbound",
        session_id = %session_id,
        chat_jid = %ev.chat_jid,
        presence = %ev.presence,
        "presence (not persisted)"
    );
}

fn log_typing(session_id: &str, ev: TypingEvent) {
    tracing::debug!(
        target: "sabwa::workers::inbound",
        session_id = %session_id,
        chat_jid = %ev.chat_jid,
        typing = ev.typing,
        "typing (not persisted)"
    );
}

async fn handle_qr(state: &AppState, session_id: &str, ev: QrEvent) {
    tracing::debug!(
        target: "sabwa::workers::inbound",
        session_id = %session_id,
        qr_len = ev.qr.len(),
        "Qr event — marking session pending"
    );
    update_session_status(state, session_id, SessionStatus::Pending).await;
}

async fn handle_pair_code(state: &AppState, session_id: &str, ev: PairCodeEvent) {
    tracing::debug!(
        target: "sabwa::workers::inbound",
        session_id = %session_id,
        code_len = ev.code.len(),
        "PairCode event — marking session pending"
    );
    update_session_status(state, session_id, SessionStatus::Pending).await;
}

async fn handle_status(state: &AppState, session_id: &str, ev: StatusEvent) {
    let new_status = match ev.status.as_str() {
        "pending" => SessionStatus::Pending,
        "connected" => SessionStatus::Connected,
        "logged_out" => SessionStatus::LoggedOut,
        "banned" => SessionStatus::Banned,
        "error" => SessionStatus::Error,
        other => {
            tracing::debug!(
                target: "sabwa::workers::inbound",
                status = %other,
                "ignoring unknown StatusEvent value"
            );
            return;
        }
    };
    update_session_status(state, session_id, new_status).await;
}

// ---------------------------------------------------------------------------
// Mongo helpers
// ---------------------------------------------------------------------------

async fn update_session_status(state: &AppState, session_id: &str, status: SessionStatus) {
    let oid = match ObjectId::parse_str(session_id) {
        Ok(o) => o,
        Err(_) => return,
    };
    let status_bson = match bson::to_bson(&status) {
        Ok(b) => b,
        Err(_) => return,
    };
    let col = state.db.collection::<bson::Document>(SESSIONS_COLLECTION);
    if let Err(err) = col
        .update_one(
            doc! { "_id": oid },
            doc! {
                "$set": {
                    "status": status_bson,
                    "updatedAt": Bson::DateTime(bson::DateTime::now()),
                }
            },
        )
        .await
    {
        tracing::warn!(
            target: "sabwa::workers::inbound",
            session_id = %session_id,
            error = %err,
            "session status update failed"
        );
    }
}

/// Patch `sabwa_chats.{lastMessage, unreadCount}`. Only called for newly
/// inserted messages (we don't bump unread on a duplicate event).
async fn upsert_chat_with_last_message(
    state: &AppState,
    session_oid: &ObjectId,
    ev: &MessageEvent,
) {
    let body = ev.message.body.clone();
    let from_me = ev.message.from_me;
    let ts = ms_to_bson(ev.message.ts);

    let mut last_message = doc! {
        "id": &ev.message.message_id,
        "ts": ts.clone(),
        "fromMe": from_me,
    };
    if let Some(b) = body {
        last_message.insert("body", b);
    }

    let set = doc! {
        "lastMessage": last_message,
        "updatedAt": ts.clone(),
    };
    // `$inc` can't share a path with `$set`, so unreadCount lives outside
    // the `set` doc.
    let inc = if from_me {
        doc! {}
    } else {
        doc! { "unreadCount": 1i64 }
    };

    let mut set_on_insert = doc! {
        "sessionId": session_oid,
        "jid": &ev.chat_jid,
        "type": "individual",
    };
    if let Ok(Some(project_oid)) = lookup_project_id(state, session_oid).await {
        set_on_insert.insert("projectId", Bson::ObjectId(project_oid));
    }
    set_on_insert.insert("pinned", false);
    set_on_insert.insert("archived", false);
    set_on_insert.insert("muted", false);

    // MongoDB rejects an update that touches the same path in both `$inc`
    // and `$setOnInsert` (error 40, "would create a conflict at
    // 'unreadCount'"). We only seed `unreadCount: 0` on insert when there's
    // no `$inc` (i.e. the message is from us). When the message is inbound
    // the `$inc: { unreadCount: 1 }` initializes the field on insert too —
    // Mongo treats a missing path as 0 and applies the increment, so a
    // brand-new chat ends up with unreadCount=1 without any conflict.
    if from_me {
        set_on_insert.insert("unreadCount", 0i64);
    }

    let mut update = doc! {
        "$set": set,
        "$setOnInsert": set_on_insert,
    };
    if !inc.is_empty() {
        update.insert("$inc", inc);
    }

    let col = state.db.collection::<bson::Document>(CHATS_COLLECTION);
    let opts = UpdateOptions::builder().upsert(true).build();
    if let Err(err) = col
        .update_one(
            doc! { "sessionId": session_oid, "jid": &ev.chat_jid },
            update,
        )
        .with_options(opts)
        .await
    {
        tracing::warn!(
            target: "sabwa::workers::inbound",
            session_id = %session_oid.to_hex(),
            jid = %ev.chat_jid,
            error = %err,
            "chat lastMessage update failed"
        );
    }
}

/// Resolve `sabwa_sessions._id → projectId` so chat/message rows can
/// reuse it on insert. Errors and absent rows return `Ok(None)` so the
/// caller can simply skip the `projectId` field.
async fn lookup_project_id(
    state: &AppState,
    session_oid: &ObjectId,
) -> anyhow::Result<Option<ObjectId>> {
    let col = state.db.collection::<bson::Document>(SESSIONS_COLLECTION);
    let doc = col
        .find_one(doc! { "_id": session_oid })
        .projection(doc! { "projectId": 1i32 })
        .await
        .context("sabwa_sessions.find_one projectId")?;
    Ok(doc
        .as_ref()
        .and_then(|d| d.get_object_id("projectId").ok()))
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/// Parse `"sabwa:{session_id}:events"` back to `session_id`.
fn session_id_from_channel(channel: &str) -> Option<&str> {
    let stripped = channel.strip_prefix("sabwa:")?;
    let session_id = stripped.strip_suffix(":events")?;
    if session_id.is_empty() {
        return None;
    }
    Some(session_id)
}

fn map_kind(kind: &str) -> MessageType {
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

/// Convert a unix-ms timestamp into a BSON DateTime (clamped to non-negative).
fn ms_to_bson(ts_ms: i64) -> Bson {
    let dt = Utc
        .timestamp_millis_opt(ts_ms.max(0))
        .single()
        .unwrap_or_else(Utc::now);
    Bson::DateTime(dt.into())
}

fn event_kind(event: &SabwaEvent) -> &'static str {
    match event {
        SabwaEvent::Message(_) => "message",
        SabwaEvent::MessageStatus(_) => "message_status",
        SabwaEvent::Chat(_) => "chat",
        SabwaEvent::Presence(_) => "presence",
        SabwaEvent::Typing(_) => "typing",
        SabwaEvent::Qr(_) => "qr",
        SabwaEvent::PairCode(_) => "pair_code",
        SabwaEvent::Status(_) => "status",
        SabwaEvent::Scheduled(_) => "scheduled",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_channel_name() {
        assert_eq!(
            session_id_from_channel("sabwa:abc:events"),
            Some("abc")
        );
        assert_eq!(session_id_from_channel("sabwa::events"), None);
        assert_eq!(session_id_from_channel("sabwa:abc:other"), None);
        assert_eq!(session_id_from_channel("other"), None);
    }
}
