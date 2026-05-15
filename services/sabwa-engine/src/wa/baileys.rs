//! Real WhatsApp implementation backed by a long-lived **Baileys
//! sidecar** (Node.js) process.
//!
//! ## Architecture
//!
//! ```text
//!  Rust sabwa-engine                               Node sidecar
//!  ┌──────────────────┐  stdin (NDJSON RPC)  ┌──────────────────┐
//!  │ BaileysSupervisor│ ────────────────────▶│ services/sabwa-  │
//!  │  ├ stdin writer  │                      │ engine/sidecar-  │
//!  │  ├ stdout reader │  stdout (NDJSON      │ node/src/index.js│
//!  │  ├ pending: Map  │  responses + events) │ (Baileys sockets)│
//!  │  └ supervisor    │ ◀────────────────────│                  │
//!  └──────────────────┘                      └──────────────────┘
//!         │
//!         ▼
//!  one [`BaileysSession`] per linked WA account multiplexes its
//!  RPC calls over the single supervisor.
//! ```
//!
//! - A **single** Node child process is spawned per Rust service instance
//!   (not per session). The supervisor multiplexes every RPC over its
//!   stdin/stdout using a `HashMap<u64, oneshot::Sender<RpcResult>>`.
//! - A background reader task parses each NDJSON line on stdout:
//!   - lines with `id` complete the matching oneshot,
//!   - lines with `event` are translated into [`SabwaEvent`]s and
//!     published to Redis via [`crate::realtime::pubsub::publish`].
//! - If the child exits the supervisor re-spawns with exponential backoff
//!   (1s, 2s, 4s, … cap 60s). RPCs in flight at exit time complete with
//!   `WaError::Disconnected`.
//!
//! See `SABWA_PLAN.md` §4 + §8 for the higher-level lifecycle, and
//! `services/sabwa-engine/sidecar-node/` for the Node side of the wire.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};

use crate::config::Config;
use crate::realtime::events::{
    self, ChatEvent, ChatPayload, MessageEvent, MessagePayload, MessageStatusEvent, PairCodeEvent,
    PresenceEvent, QrEvent, SabwaEvent, StatusEvent, TypingEvent,
};
use crate::realtime::pubsub;
use crate::state::AppState;

use super::errors::WaError;
use super::session::{
    PairMethod, PairRequest, PairResponse, PresenceKind, SendRequest, SendResponse, WaSession,
    WaSessionFactory,
};

// ---------------------------------------------------------------------------
// Sidecar wire types
// ---------------------------------------------------------------------------

/// JSON-RPC response sent by the sidecar — mirrors `protocol.js`.
#[derive(Debug, Deserialize)]
struct RpcResponseRaw {
    /// Always present on responses, absent on events.
    id: Option<String>,
    /// Present on responses only.
    ok: Option<bool>,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<String>,
    /// Present on events only.
    event: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default, rename = "sessionId")]
    session_id_camel: Option<String>,
    #[serde(default)]
    payload: Option<Value>,
}

/// Result delivered to a waiting RPC caller.
type RpcResult = Result<Value, String>;

// ---------------------------------------------------------------------------
// Supervisor
// ---------------------------------------------------------------------------

/// State shared between the writer side (RPC issuers) and the reader/
/// supervisor task. Wrapped in `Mutex` so writes are serialised.
struct Inner {
    /// Child's stdin handle. `None` while we are in the middle of a respawn.
    stdin: Option<ChildStdin>,
    /// Pending RPCs awaiting a response from the child.
    pending: HashMap<u64, oneshot::Sender<RpcResult>>,
}

/// Owns one Node sidecar child process and multiplexes RPCs over it.
///
/// Spawned once per Rust service instance — every [`BaileysSession`]
/// holds an `Arc<BaileysSupervisor>` and routes its requests through here.
pub struct BaileysSupervisor {
    node_binary: String,
    sidecar_path: String,
    state: AppState,
    seq: AtomicU64,
    inner: Arc<Mutex<Inner>>,
}

impl BaileysSupervisor {
    /// Spawn the supervisor (and its first child process). Returns an
    /// `Arc` so the factory and every session can share it.
    pub fn spawn(config: &Config, state: AppState) -> Result<Arc<Self>> {
        let supervisor = Arc::new(Self {
            node_binary: config.node_binary.clone(),
            sidecar_path: config.sidecar_node_path.clone(),
            state,
            seq: AtomicU64::new(1),
            inner: Arc::new(Mutex::new(Inner {
                stdin: None,
                pending: HashMap::new(),
            })),
        });

        // Kick off the first child + the respawn loop.
        let s = Arc::clone(&supervisor);
        tokio::spawn(async move {
            s.run_forever().await;
        });

        Ok(supervisor)
    }

    /// Respawn loop with exponential backoff. Runs for the lifetime of the
    /// service.
    async fn run_forever(self: Arc<Self>) {
        let mut backoff = Duration::from_secs(1);
        loop {
            match self.spawn_once().await {
                Ok(()) => {
                    tracing::warn!(
                        target: "sabwa_engine::wa::baileys",
                        "baileys sidecar exited cleanly — respawning in 1s"
                    );
                    backoff = Duration::from_secs(1);
                }
                Err(err) => {
                    tracing::error!(
                        target: "sabwa_engine::wa::baileys",
                        error = %err,
                        backoff_ms = backoff.as_millis() as u64,
                        "baileys sidecar crashed — respawning after backoff"
                    );
                }
            }

            // Fail every in-flight RPC so callers don't hang.
            {
                let mut inner = self.inner.lock().await;
                inner.stdin = None;
                let drained: Vec<_> = inner.pending.drain().collect();
                drop(inner);
                for (_id, tx) in drained {
                    let _ = tx.send(Err("sidecar disconnected".to_string()));
                }
            }

            tokio::time::sleep(backoff).await;
            backoff = std::cmp::min(backoff.saturating_mul(2), Duration::from_secs(60));
        }
    }

    /// Spawn one Node child and run its reader loop until the child exits.
    async fn spawn_once(self: &Arc<Self>) -> Result<()> {
        tracing::info!(
            target: "sabwa_engine::wa::baileys",
            node = %self.node_binary,
            script = %self.sidecar_path,
            "spawning baileys sidecar"
        );

        let mut child = Command::new(&self.node_binary)
            .arg(&self.sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .with_context(|| {
                format!(
                    "failed to spawn sidecar: {} {}",
                    self.node_binary, self.sidecar_path
                )
            })?;

        let stdin = child
            .stdin
            .take()
            .context("baileys sidecar child did not expose stdin")?;
        let stdout = child
            .stdout
            .take()
            .context("baileys sidecar child did not expose stdout")?;

        // Publish stdin handle so RPC writers can grab it.
        {
            let mut inner = self.inner.lock().await;
            inner.stdin = Some(stdin);
        }

        tracing::info!(
            target: "sabwa_engine::wa::baileys",
            "baileys sidecar ready"
        );

        // Reader task: parse stdout NDJSON, complete RPCs / forward events.
        let reader_handle = {
            let supervisor = Arc::clone(self);
            tokio::spawn(async move {
                let mut reader = BufReader::new(stdout).lines();
                loop {
                    match reader.next_line().await {
                        Ok(Some(line)) => {
                            supervisor.handle_line(&line).await;
                        }
                        Ok(None) => {
                            tracing::warn!(
                                target: "sabwa_engine::wa::baileys",
                                "sidecar stdout closed"
                            );
                            break;
                        }
                        Err(err) => {
                            tracing::error!(
                                target: "sabwa_engine::wa::baileys",
                                error = %err,
                                "sidecar stdout read error"
                            );
                            break;
                        }
                    }
                }
            })
        };

        // Wait for child exit OR reader exit (whichever first).
        let status = child.wait().await.context("waiting on sidecar child")?;
        tracing::warn!(
            target: "sabwa_engine::wa::baileys",
            status = ?status,
            "baileys sidecar exited"
        );
        reader_handle.abort();
        Ok(())
    }

    /// Parse a single NDJSON line emitted by the sidecar and dispatch it.
    async fn handle_line(self: &Arc<Self>, line: &str) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return;
        }

        let parsed: RpcResponseRaw = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(err) => {
                tracing::warn!(
                    target: "sabwa_engine::wa::baileys",
                    error = %err,
                    line_len = trimmed.len(),
                    "dropping malformed sidecar line"
                );
                return;
            }
        };

        // Event? (no `id`)
        if let Some(event_name) = parsed.event.as_deref() {
            let session_id = parsed
                .session_id_camel
                .or(parsed.session_id)
                .unwrap_or_default();
            let payload = parsed.payload.unwrap_or(Value::Null);
            self.dispatch_event(event_name, &session_id, payload).await;
            return;
        }

        // Otherwise it must be a response.
        let Some(id_str) = parsed.id else {
            tracing::warn!(
                target: "sabwa_engine::wa::baileys",
                "sidecar line had neither `id` nor `event`"
            );
            return;
        };
        let Ok(id) = id_str.parse::<u64>() else {
            tracing::warn!(
                target: "sabwa_engine::wa::baileys",
                id = %id_str,
                "sidecar response id is not a u64"
            );
            return;
        };

        let tx = {
            let mut inner = self.inner.lock().await;
            inner.pending.remove(&id)
        };
        let Some(tx) = tx else {
            tracing::warn!(
                target: "sabwa_engine::wa::baileys",
                id,
                "no pending RPC for response id"
            );
            return;
        };

        let result: RpcResult = if parsed.ok.unwrap_or(false) {
            Ok(parsed.result.unwrap_or(Value::Null))
        } else {
            Err(parsed.error.unwrap_or_else(|| "unknown error".to_string()))
        };
        let _ = tx.send(result);
    }

    /// Translate a sidecar event into a [`SabwaEvent`] and publish to Redis.
    async fn dispatch_event(
        self: &Arc<Self>,
        name: &str,
        session_id: &str,
        payload: Value,
    ) {
        if session_id.is_empty() {
            tracing::warn!(
                target: "sabwa_engine::wa::baileys",
                event = %name,
                "event missing sessionId — dropping"
            );
            return;
        }

        let now_ms = chrono::Utc::now().timestamp_millis();
        let ts = payload
            .get("ts")
            .and_then(|v| v.as_i64())
            .unwrap_or(now_ms);

        let mapped: Option<SabwaEvent> = match name {
            "qr" => {
                let qr = payload
                    .get("qr")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Some(SabwaEvent::Qr(QrEvent {
                    session_id: session_id.to_string(),
                    qr,
                    ts,
                }))
            }
            "pair_code" => {
                let code = payload
                    .get("code")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Some(SabwaEvent::PairCode(PairCodeEvent {
                    session_id: session_id.to_string(),
                    code,
                    ts,
                }))
            }
            "status" => {
                let status = payload
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("pending")
                    .to_string();
                let detail = payload
                    .get("detail")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                Some(SabwaEvent::Status(StatusEvent {
                    session_id: session_id.to_string(),
                    status,
                    detail,
                    ts,
                }))
            }
            "connected" => {
                // Persist auth_state, then emit a "connected" status event.
                if let Some(auth_b64) = payload.get("authState").and_then(|v| v.as_str()) {
                    self.persist_auth_state(session_id, auth_b64).await;
                }
                Some(SabwaEvent::Status(StatusEvent {
                    session_id: session_id.to_string(),
                    status: "connected".to_string(),
                    detail: None,
                    ts,
                }))
            }
            "disconnected" => Some(SabwaEvent::Status(StatusEvent {
                session_id: session_id.to_string(),
                status: "disconnected".to_string(),
                detail: payload
                    .get("detail")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                ts,
            })),
            "messages.upsert" | "message" => {
                map_message_event(session_id, &payload, ts).map(SabwaEvent::Message)
            }
            "messages.update" | "message_receipt.update" | "message_status" => {
                map_message_status_event(session_id, &payload, ts).map(SabwaEvent::MessageStatus)
            }
            "chats.upsert" | "chats.update" | "chat_update" => {
                map_chat_event(session_id, &payload, ts).map(SabwaEvent::Chat)
            }
            "presence.update" | "presence" => {
                map_presence_event(session_id, &payload, ts).map(SabwaEvent::Presence)
            }
            "typing" => {
                let chat_jid = payload
                    .get("chat_jid")
                    .or_else(|| payload.get("chatJid"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let typing = payload
                    .get("typing")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                Some(SabwaEvent::Typing(TypingEvent {
                    session_id: session_id.to_string(),
                    chat_jid,
                    typing,
                    ts,
                }))
            }
            // Pass-through events we don't model yet — log and drop.
            other => {
                tracing::debug!(
                    target: "sabwa_engine::wa::baileys",
                    event = %other,
                    session_id = %session_id,
                    "unmapped sidecar event"
                );
                None
            }
        };

        if let Some(ev) = mapped {
            let channel = events::channel(session_id);
            if let Err(err) = pubsub::publish(&self.state.redis, session_id, &ev).await {
                tracing::warn!(
                    target: "sabwa_engine::wa::baileys",
                    error = %err,
                    channel = %channel,
                    "failed to publish SabwaEvent to redis"
                );
            }
        }
    }

    /// Persist a base64 auth_state blob to Mongo. Best-effort — failures
    /// are logged but do not block event dispatch.
    async fn persist_auth_state(self: &Arc<Self>, session_id: &str, auth_b64: &str) {
        // The sidecar already emits a base64-encoded JSON snapshot of the
        // multi-file auth state. The repo call below transparently wraps
        // the bytes in AES-256-GCM via `AppState::crypto` (agent B6) — Mongo
        // only ever sees ciphertext.
        let plaintext = auth_b64.as_bytes();
        match bson::oid::ObjectId::parse_str(session_id) {
            Ok(oid) => {
                let repo = crate::db::sessions::SessionsRepo::new(&self.state.db);
                if let Err(err) = repo
                    .update_auth_state(&oid, plaintext, self.state.crypto.as_ref())
                    .await
                {
                    tracing::warn!(
                        target: "sabwa_engine::wa::baileys",
                        error = %err,
                        session_id = %session_id,
                        "failed to persist auth_state"
                    );
                } else {
                    // Flip the row to `connected` so the route's status
                    // poll reports the new state immediately.
                    if let Err(err) = repo
                        .update_status(&oid, crate::db::sessions::SessionStatus::Connected)
                        .await
                    {
                        tracing::warn!(
                            target: "sabwa_engine::wa::baileys",
                            error = %err,
                            session_id = %session_id,
                            "failed to update session status post-pair"
                        );
                    }
                }
            }
            Err(_) => {
                tracing::warn!(
                    target: "sabwa_engine::wa::baileys",
                    session_id = %session_id,
                    "session_id is not a valid ObjectId — skipping auth_state persist"
                );
            }
        }
    }

    /// Issue an RPC over the sidecar's stdin and await the response.
    async fn rpc(self: &Arc<Self>, method: &str, params: Value) -> Result<Value, WaError> {
        let id = self.seq.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel::<RpcResult>();

        let payload = json!({
            "id": id.to_string(),
            "method": method,
            "params": params,
        });
        let mut line = serde_json::to_string(&payload).map_err(|e| WaError::Other(e.into()))?;
        line.push('\n');

        tracing::debug!(
            target: "sabwa_engine::wa::baileys",
            id, method,
            "rpc → sidecar"
        );

        // Register the pending oneshot *before* writing to stdin so the
        // reader task can never lose a race.
        {
            let mut inner = self.inner.lock().await;
            if inner.stdin.is_none() {
                return Err(WaError::Disconnected);
            }
            inner.pending.insert(id, tx);
            // Hold the lock while writing — Mutex serialises writers, which
            // is exactly what we want for a shared pipe. We take a fresh
            // `&mut` from `inner` here so the earlier `pending.insert` has
            // already returned its borrow.
            let stdin = inner.stdin.as_mut().expect("checked stdin is Some above");
            if let Err(err) = stdin.write_all(line.as_bytes()).await {
                inner.pending.remove(&id);
                return Err(WaError::Other(anyhow::anyhow!(
                    "failed to write to sidecar stdin: {err}"
                )));
            }
            if let Err(err) = stdin.flush().await {
                inner.pending.remove(&id);
                return Err(WaError::Other(anyhow::anyhow!(
                    "failed to flush sidecar stdin: {err}"
                )));
            }
        }

        match rx.await {
            Ok(Ok(value)) => {
                tracing::debug!(
                    target: "sabwa_engine::wa::baileys",
                    id, method,
                    "rpc ← sidecar ok"
                );
                Ok(value)
            }
            Ok(Err(msg)) => {
                tracing::debug!(
                    target: "sabwa_engine::wa::baileys",
                    id, method, error = %msg,
                    "rpc ← sidecar error"
                );
                Err(WaError::ProtocolError(msg))
            }
            Err(_recv_err) => Err(WaError::Disconnected),
        }
    }
}

// ---------------------------------------------------------------------------
// Event payload mapping helpers
// ---------------------------------------------------------------------------

fn map_message_event(session_id: &str, payload: &Value, ts_default: i64) -> Option<MessageEvent> {
    // Sidecar shape: { type, message: WAMessage } or a flat message object.
    let msg = payload.get("message").unwrap_or(payload);
    let key = msg.get("key").cloned().unwrap_or(Value::Null);
    let chat_jid = key
        .get("remoteJid")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let message_id = key
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let from_me = key
        .get("fromMe")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let from_jid = key
        .get("participant")
        .and_then(|v| v.as_str())
        .or_else(|| key.get("remoteJid").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    let ts = msg
        .get("messageTimestamp")
        .and_then(|v| v.as_i64())
        .map(|t| t * 1000)
        .unwrap_or(ts_default);

    // Best-effort extraction of body / kind from Baileys' nested
    // `message.<kind>Message` shape.
    let (kind, body, media_url) = extract_message_content(msg);

    if chat_jid.is_empty() || message_id.is_empty() {
        return None;
    }

    Some(MessageEvent {
        session_id: session_id.to_string(),
        chat_jid,
        message: MessagePayload {
            message_id,
            from_jid,
            from_me,
            kind,
            body,
            media_url,
            ts,
        },
    })
}

fn extract_message_content(msg: &Value) -> (String, Option<String>, Option<String>) {
    let content = match msg.get("message") {
        Some(v) => v,
        None => return ("text".to_string(), None, None),
    };
    if let Some(text) = content.get("conversation").and_then(|v| v.as_str()) {
        return ("text".to_string(), Some(text.to_string()), None);
    }
    if let Some(ext) = content.get("extendedTextMessage") {
        let body = ext.get("text").and_then(|v| v.as_str()).map(|s| s.to_string());
        return ("text".to_string(), body, None);
    }
    if let Some(img) = content.get("imageMessage") {
        let cap = img.get("caption").and_then(|v| v.as_str()).map(|s| s.to_string());
        let url = img.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());
        return ("image".to_string(), cap, url);
    }
    if let Some(vid) = content.get("videoMessage") {
        let cap = vid.get("caption").and_then(|v| v.as_str()).map(|s| s.to_string());
        let url = vid.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());
        return ("video".to_string(), cap, url);
    }
    if let Some(aud) = content.get("audioMessage") {
        let url = aud.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());
        let kind = if aud.get("ptt").and_then(|v| v.as_bool()).unwrap_or(false) {
            "voice"
        } else {
            "audio"
        };
        return (kind.to_string(), None, url);
    }
    if let Some(doc) = content.get("documentMessage") {
        let url = doc.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());
        let cap = doc.get("caption").and_then(|v| v.as_str()).map(|s| s.to_string());
        return ("document".to_string(), cap, url);
    }
    if content.get("stickerMessage").is_some() {
        return ("sticker".to_string(), None, None);
    }
    if content.get("locationMessage").is_some() {
        return ("location".to_string(), None, None);
    }
    if content.get("contactMessage").is_some() {
        return ("contact".to_string(), None, None);
    }
    if content.get("reactionMessage").is_some() {
        return ("reaction".to_string(), None, None);
    }
    ("text".to_string(), None, None)
}

fn map_message_status_event(
    session_id: &str,
    payload: &Value,
    ts_default: i64,
) -> Option<MessageStatusEvent> {
    let key = payload.get("key").cloned().unwrap_or(Value::Null);
    let chat_jid = key
        .get("remoteJid")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let message_id = key
        .get("id")
        .and_then(|v| v.as_str())
        .or_else(|| payload.get("messageId").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    // Baileys sends a numeric status code (0–5) on receipt updates and a
    // string on direct status events.
    let status = if let Some(s) = payload
        .get("update")
        .and_then(|u| u.get("status"))
        .and_then(|v| v.as_i64())
        .or_else(|| payload.get("status").and_then(|v| v.as_i64()))
    {
        match s {
            0 => "error",
            1 => "sending",
            2 => "sent",
            3 => "delivered",
            4 => "read",
            5 => "played",
            _ => "sent",
        }
        .to_string()
    } else {
        payload
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("sent")
            .to_string()
    };

    if message_id.is_empty() {
        return None;
    }
    Some(MessageStatusEvent {
        session_id: session_id.to_string(),
        chat_jid,
        message_id,
        status,
        ts: ts_default,
    })
}

fn map_chat_event(session_id: &str, payload: &Value, ts_default: i64) -> Option<ChatEvent> {
    let jid = payload
        .get("id")
        .and_then(|v| v.as_str())
        .or_else(|| payload.get("jid").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    if jid.is_empty() {
        return None;
    }
    let kind = if jid.ends_with("@g.us") {
        "group"
    } else if jid.contains("broadcast") {
        "broadcast"
    } else {
        "individual"
    }
    .to_string();
    let name = payload
        .get("name")
        .or_else(|| payload.get("subject"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let unread_count = payload
        .get("unreadCount")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let pinned = payload
        .get("pinned")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let archived = payload
        .get("archived")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let muted = payload
        .get("muteEndTime")
        .and_then(|v| v.as_i64())
        .map(|t| t > 0)
        .unwrap_or(false);

    Some(ChatEvent {
        session_id: session_id.to_string(),
        chat: ChatPayload {
            jid,
            kind,
            name,
            unread_count,
            pinned,
            archived,
            muted,
            updated_at: ts_default,
        },
    })
}

fn map_presence_event(
    session_id: &str,
    payload: &Value,
    ts_default: i64,
) -> Option<PresenceEvent> {
    let chat_jid = payload
        .get("chat_jid")
        .or_else(|| payload.get("chatJid"))
        .or_else(|| payload.get("id"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let presence = payload
        .get("presence")
        .and_then(|v| v.as_str())
        .unwrap_or("available")
        .to_string();
    let ts = payload.get("ts").and_then(|v| v.as_i64()).unwrap_or(ts_default);
    if chat_jid.is_empty() {
        return None;
    }
    Some(PresenceEvent {
        session_id: session_id.to_string(),
        chat_jid,
        presence,
        ts,
    })
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/// A single linked WhatsApp account, multiplexed over the shared
/// [`BaileysSupervisor`].
///
/// Cheap to construct — holds nothing except an `Arc<BaileysSupervisor>`
/// and the session id. The actual Baileys socket lives inside the
/// Node sidecar.
pub struct BaileysSession {
    supervisor: Arc<BaileysSupervisor>,
    session_id: String,
}

impl BaileysSession {
    pub fn new(supervisor: Arc<BaileysSupervisor>, session_id: String) -> Self {
        Self {
            supervisor,
            session_id,
        }
    }
}

#[async_trait]
impl WaSession for BaileysSession {
    fn id(&self) -> &str {
        &self.session_id
    }

    async fn start_pair(&self, req: PairRequest) -> Result<PairResponse, WaError> {
        let method_str = match req.method {
            PairMethod::Qr => "qr",
            PairMethod::Code => "code",
        };
        let params = json!({
            "sessionId": &self.session_id,
            "method": method_str,
            "phoneE164": req.phone_e164,
        });
        let result = self.supervisor.rpc("pair", params).await?;
        // The sidecar's `pair` returns `{ sessionId, status }` immediately
        // — the actual QR / pair_code lands as an unsolicited event over
        // Redis. Mirror that here by returning no QR up-front.
        let _ = result;
        Ok(PairResponse {
            qr: None,
            pair_code: None,
        })
    }

    async fn is_connected(&self) -> bool {
        let params = json!({ "sessionId": &self.session_id });
        match self.supervisor.rpc("getStatus", params).await {
            Ok(v) => v
                .get("status")
                .and_then(|s| s.as_str())
                .map(|s| s == "connected")
                .unwrap_or(false),
            Err(_) => false,
        }
    }

    async fn send(&self, req: SendRequest) -> Result<SendResponse, WaError> {
        // Translate our SendRequest into the loose payload the sidecar
        // expects (see `_buildContent` in session-manager.js).
        let mut payload = serde_json::Map::new();
        payload.insert("type".into(), Value::String(req.kind.clone()));
        if let Some(body) = req.body.clone() {
            payload.insert("body".into(), Value::String(body));
        }
        if let Some(url) = req.media_url.clone() {
            payload.insert("url".into(), Value::String(url));
        }
        if let Some(caption) = req.caption.clone() {
            payload.insert("caption".into(), Value::String(caption));
        }
        if !req.mentions.is_empty() {
            payload.insert(
                "mentions".into(),
                Value::Array(req.mentions.iter().cloned().map(Value::String).collect()),
            );
        }

        let params = json!({
            "sessionId": &self.session_id,
            "chatJid": &req.chat_jid,
            "payload": Value::Object(payload),
        });
        let result = self.supervisor.rpc("send", params).await?;
        let message_id = result
            .get("messageId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let server_ts = result
            .get("serverTs")
            .and_then(|v| v.as_i64())
            .map(|ms| ms / 1000)
            .unwrap_or_else(|| chrono::Utc::now().timestamp());
        if message_id.is_empty() {
            return Err(WaError::ProtocolError(
                "sidecar send returned empty messageId".into(),
            ));
        }
        Ok(SendResponse {
            message_id,
            server_ts,
        })
    }

    async fn logout(&self) -> Result<(), WaError> {
        let params = json!({ "sessionId": &self.session_id });
        self.supervisor.rpc("logout", params).await?;
        Ok(())
    }

    async fn presence(&self, jid: &str, kind: PresenceKind) -> Result<(), WaError> {
        let kind_str = match kind {
            PresenceKind::Available => "available",
            PresenceKind::Composing => "composing",
            PresenceKind::Recording => "recording",
            PresenceKind::Paused => "paused",
            PresenceKind::Unavailable => "unavailable",
        };
        let params = json!({
            "sessionId": &self.session_id,
            "jid": jid,
            "kind": kind_str,
        });
        self.supervisor.rpc("setPresence", params).await?;
        Ok(())
    }

    async fn mark_read(&self, jid: &str, message_id: &str) -> Result<(), WaError> {
        let params = json!({
            "sessionId": &self.session_id,
            "chatJid": jid,
            "messageId": message_id,
        });
        self.supervisor.rpc("markRead", params).await?;
        Ok(())
    }

    async fn create_group(
        &self,
        subject: &str,
        participants: Vec<String>,
    ) -> Result<String, WaError> {
        let params = json!({
            "sessionId": &self.session_id,
            "subject": subject,
            "participants": participants,
        });
        let result = self.supervisor.rpc("createGroup", params).await?;
        Ok(result
            .get("groupJid")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string())
    }

    async fn add_participants(
        &self,
        group_jid: &str,
        jids: Vec<String>,
    ) -> Result<(), WaError> {
        let params = json!({
            "sessionId": &self.session_id,
            "groupJid": group_jid,
            "jids": jids,
            "op": "add",
        });
        self.supervisor.rpc("addParticipants", params).await?;
        Ok(())
    }

    async fn remove_participants(
        &self,
        group_jid: &str,
        jids: Vec<String>,
    ) -> Result<(), WaError> {
        let params = json!({
            "sessionId": &self.session_id,
            "groupJid": group_jid,
            "jids": jids,
            "op": "remove",
        });
        self.supervisor.rpc("removeParticipants", params).await?;
        Ok(())
    }

    async fn promote_admin(&self, group_jid: &str, jid: &str) -> Result<(), WaError> {
        let params = json!({
            "sessionId": &self.session_id,
            "groupJid": group_jid,
            "jids": [jid],
            "op": "promote",
        });
        self.supervisor.rpc("promoteAdmin", params).await?;
        Ok(())
    }

    async fn demote_admin(&self, group_jid: &str, jid: &str) -> Result<(), WaError> {
        let params = json!({
            "sessionId": &self.session_id,
            "groupJid": group_jid,
            "jids": [jid],
            "op": "demote",
        });
        self.supervisor.rpc("demoteAdmin", params).await?;
        Ok(())
    }

    async fn get_invite_code(&self, group_jid: &str) -> Result<String, WaError> {
        let params = json!({
            "sessionId": &self.session_id,
            "groupJid": group_jid,
        });
        let result = self.supervisor.rpc("getInviteCode", params).await?;
        Ok(result
            .get("code")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string())
    }

    async fn revoke_invite_code(&self, group_jid: &str) -> Result<String, WaError> {
        let params = json!({
            "sessionId": &self.session_id,
            "groupJid": group_jid,
        });
        let result = self.supervisor.rpc("revokeInviteCode", params).await?;
        Ok(result
            .get("code")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string())
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/// Builds a fresh [`BaileysSession`] for every session id the pool asks
/// about. Cheap — every session shares the same supervisor.
pub struct BaileysFactory {
    supervisor: Arc<BaileysSupervisor>,
}

impl BaileysFactory {
    pub fn new(supervisor: Arc<BaileysSupervisor>) -> Self {
        Self { supervisor }
    }
}

#[async_trait]
impl WaSessionFactory for BaileysFactory {
    async fn create(
        &self,
        session_id: String,
        auth_state: Option<Vec<u8>>,
    ) -> Result<Arc<dyn WaSession>> {
        // If hydration material was supplied, kick off a `resume` RPC so the
        // sidecar can rebuild its Baileys socket before we hand the session
        // back to the caller. The persisted blob is the AES-256-GCM
        // ciphertext we wrote on the previous `connected` event — decrypt
        // it first using the AppState-level crypto helper.
        if let Some(blob) = auth_state {
            let plaintext = match self.supervisor.state.crypto.decrypt(&blob) {
                Ok(p) => p,
                Err(err) => {
                    tracing::warn!(
                        target: "sabwa_engine::wa::baileys",
                        error = %err,
                        session_id = %session_id,
                        "failed to decrypt persisted auth_state — starting fresh"
                    );
                    return Ok(Arc::new(BaileysSession::new(
                        Arc::clone(&self.supervisor),
                        session_id,
                    )));
                }
            };
            let auth_b64 = match std::str::from_utf8(&plaintext) {
                Ok(s) => s.to_string(),
                Err(_) => base64::Engine::encode(
                    &base64::engine::general_purpose::STANDARD,
                    &plaintext,
                ),
            };
            let params = json!({
                "sessionId": &session_id,
                "authState": auth_b64,
            });
            if let Err(err) = self.supervisor.rpc("resume", params).await {
                tracing::warn!(
                    target: "sabwa_engine::wa::baileys",
                    error = %err,
                    session_id = %session_id,
                    "resume rpc failed — session will start in pending state"
                );
            }
        }
        Ok(Arc::new(BaileysSession::new(
            Arc::clone(&self.supervisor),
            session_id,
        )))
    }
}
