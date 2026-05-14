//! PHASE 1 STUB — Replace with a real WA Multi-Device implementation.
//!
//! Candidates: hand-rolled against the published WA Web protocol, or a
//! Baileys (Node.js) sidecar invoked via local IPC. See SABWA_PLAN.md
//! section 16 (open risks — no production Rust WA Multi-Device lib
//! currently exists).
//!
//! [`StubSession`] satisfies [`crate::wa::WaSession`] without performing
//! any real network I/O. It exists purely so the rest of the engine
//! (routes, scheduler, anti-ban, webhooks) can be built and exercised
//! end-to-end before the real engine lands.
//!
//! Behaviour summary:
//!
//! - `start_pair` returns a fake base64-encoded UUID as the QR string and
//!   spawns a `tokio` task that publishes three [`QrEvent`]s 30 s apart
//!   (mimicking Baileys' QR rotation cadence from SABWA_PLAN.md §4).
//! - 60 s after pairing starts, an internal `AtomicBool` flips to
//!   `connected` and a `StatusEvent { status: "connected" }` is published,
//!   simulating the user scanning their phone.
//! - `send` mints a UUID `message_id`, logs at `tracing::info!` and
//!   publishes a `MessageStatusEvent { status: "sent" }`.
//! - Every other method logs a warning and returns `Ok(..)` with
//!   placeholder values.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use base64::Engine;
use chrono::Utc;
use uuid::Uuid;

use super::errors::WaError;
use super::session::{
    PairMethod, PairRequest, PairResponse, PresenceKind, SendRequest, SendResponse, WaSession,
    WaSessionFactory,
};

/// Phase 1 stub. Holds nothing except a session id, a redis client (so we
/// can publish realtime events into `sabwa:{id}:events` once that wiring
/// is in place — see TODO inside `publish_event`) and a connected flag.
///
/// `connected` is wrapped in an `Arc` so spawned tasks can flip it
/// without unsafe pointer juggling.
pub struct StubSession {
    id: String,
    connected: Arc<AtomicBool>,
    #[allow(dead_code)]
    redis: redis::Client,
}

impl StubSession {
    /// Construct a fresh stub session.
    ///
    /// The `redis` client is stored so future iterations can call
    /// `realtime::pubsub::publish(..)` directly — Phase 1 wires up that
    /// helper but the underlying transport may not be live yet, so we
    /// fall back to `tracing` if publication fails.
    pub fn new(id: String, redis: redis::Client) -> Self {
        Self {
            id,
            connected: Arc::new(AtomicBool::new(false)),
            redis,
        }
    }

    /// Helper: publish a realtime event, falling back to a log line if
    /// the realtime layer isn't available yet. Once `realtime::pubsub`
    /// goes live this should `?`-propagate publish errors instead.
    async fn publish_event(&self, channel: &str, kind: &str, payload: serde_json::Value) {
        // TODO: replace with
        //   crate::realtime::pubsub::publish(&self.redis, channel, &event).await?;
        // once `realtime::pubsub::publish` is implemented (currently the
        // realtime submodules are scaffold-only — see
        // `services/sabwa-engine/src/realtime.rs`).
        tracing::info!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            channel = %channel,
            kind = %kind,
            payload = %payload,
            "stub: publish_event (no-op until realtime::pubsub is wired)"
        );
    }
}

#[async_trait]
impl WaSession for StubSession {
    fn id(&self) -> &str {
        &self.id
    }

    async fn start_pair(&self, req: PairRequest) -> Result<PairResponse, WaError> {
        if self.connected.load(Ordering::Acquire) {
            return Err(WaError::AlreadyConnected);
        }

        // Mint a deterministic-looking fake QR: base64(uuid). Mirrors what
        // a real engine would push (a reference token the browser renders
        // into a QR image).
        let fake_qr = base64::engine::general_purpose::STANDARD
            .encode(Uuid::new_v4().as_bytes());

        match req.method {
            PairMethod::Qr => {
                tracing::info!(
                    target: "sabwa_engine::wa::stub",
                    session_id = %self.id,
                    "stub: start_pair (qr) — emitting fake QR + scheduling rotation"
                );

                let session_id = self.id.clone();
                let redis = self.redis.clone();
                let first_qr = fake_qr.clone();

                // Spawn the rotation: emit two more QRs at +30s and +60s
                // to match SABWA_PLAN.md §4 ("emit QR every 30s").
                tokio::spawn(async move {
                    let channel = format!("sabwa:{session_id}:events");
                    publish_qr(&redis, &channel, &session_id, &first_qr).await;
                    for _ in 0..2 {
                        tokio::time::sleep(Duration::from_secs(30)).await;
                        let next_qr = base64::engine::general_purpose::STANDARD
                            .encode(Uuid::new_v4().as_bytes());
                        publish_qr(&redis, &channel, &session_id, &next_qr).await;
                    }
                });

                // Spawn the "user scanned" simulator: flip to connected
                // 60 s later. In a real impl this would come from a
                // Baileys `connection.update: open` event.
                let session_id_for_connect = self.id.clone();
                let redis_for_connect = self.redis.clone();
                let connected_flag = Arc::clone(&self.connected);
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(60)).await;
                    connected_flag.store(true, Ordering::Release);
                    let channel = format!("sabwa:{session_id_for_connect}:events");
                    publish_status(&redis_for_connect, &channel, &session_id_for_connect, "connected").await;
                });

                Ok(PairResponse {
                    qr: Some(fake_qr),
                    pair_code: None,
                })
            }
            PairMethod::Code => {
                let phone = req.phone_e164.as_deref().unwrap_or("(unknown)");
                tracing::info!(
                    target: "sabwa_engine::wa::stub",
                    session_id = %self.id,
                    phone = %phone,
                    "stub: start_pair (code) — emitting fake pair code"
                );
                // 8-char monospace pair code per SABWA_PLAN.md §6 page 2.
                let code = format!("{}-{}", &Uuid::new_v4().simple().to_string()[..4].to_uppercase(),
                                   &Uuid::new_v4().simple().to_string()[..4].to_uppercase());
                Ok(PairResponse {
                    qr: None,
                    pair_code: Some(code),
                })
            }
        }
    }

    async fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Acquire)
    }

    async fn send(&self, req: SendRequest) -> Result<SendResponse, WaError> {
        let message_id = Uuid::new_v4().simple().to_string();
        let server_ts = Utc::now().timestamp();

        tracing::info!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            chat_jid = %req.chat_jid,
            kind = %req.kind,
            message_id = %message_id,
            "stub: send — pretending message was delivered"
        );

        let channel = format!("sabwa:{}:events", self.id);
        self.publish_event(
            &channel,
            "message.status",
            serde_json::json!({
                "type": "message.status",
                "sessionId": &self.id,
                "messageId": &message_id,
                "chatJid": &req.chat_jid,
                "status": "sent",
                "ts": server_ts,
            }),
        )
        .await;

        Ok(SendResponse {
            message_id,
            server_ts,
        })
    }

    async fn logout(&self) -> Result<(), WaError> {
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            "stub: logout — flipping connected flag, no real socket to close"
        );
        self.connected.store(false, Ordering::Release);
        let channel = format!("sabwa:{}:events", self.id);
        self.publish_event(
            &channel,
            "status",
            serde_json::json!({
                "type": "status",
                "sessionId": &self.id,
                "status": "logged_out",
            }),
        )
        .await;
        Ok(())
    }

    async fn presence(&self, jid: &str, kind: PresenceKind) -> Result<(), WaError> {
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            jid = %jid,
            kind = ?kind,
            "stub: presence — no-op"
        );
        Ok(())
    }

    async fn mark_read(&self, jid: &str, message_id: &str) -> Result<(), WaError> {
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            jid = %jid,
            message_id = %message_id,
            "stub: mark_read — no-op"
        );
        Ok(())
    }

    async fn create_group(
        &self,
        subject: &str,
        participants: Vec<String>,
    ) -> Result<String, WaError> {
        let jid = format!("{}@g.us", Uuid::new_v4().simple());
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            subject = %subject,
            participants = participants.len(),
            jid = %jid,
            "stub: create_group — returning fabricated JID"
        );
        Ok(jid)
    }

    async fn add_participants(
        &self,
        group_jid: &str,
        jids: Vec<String>,
    ) -> Result<(), WaError> {
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            group_jid = %group_jid,
            count = jids.len(),
            "stub: add_participants — no-op"
        );
        Ok(())
    }

    async fn remove_participants(
        &self,
        group_jid: &str,
        jids: Vec<String>,
    ) -> Result<(), WaError> {
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            group_jid = %group_jid,
            count = jids.len(),
            "stub: remove_participants — no-op"
        );
        Ok(())
    }

    async fn promote_admin(&self, group_jid: &str, jid: &str) -> Result<(), WaError> {
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            group_jid = %group_jid,
            jid = %jid,
            "stub: promote_admin — no-op"
        );
        Ok(())
    }

    async fn demote_admin(&self, group_jid: &str, jid: &str) -> Result<(), WaError> {
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            group_jid = %group_jid,
            jid = %jid,
            "stub: demote_admin — no-op"
        );
        Ok(())
    }

    async fn get_invite_code(&self, group_jid: &str) -> Result<String, WaError> {
        let code = Uuid::new_v4().simple().to_string()[..22].to_string();
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            group_jid = %group_jid,
            code = %code,
            "stub: get_invite_code — returning fabricated code"
        );
        Ok(code)
    }

    async fn revoke_invite_code(&self, group_jid: &str) -> Result<String, WaError> {
        let code = Uuid::new_v4().simple().to_string()[..22].to_string();
        tracing::warn!(
            target: "sabwa_engine::wa::stub",
            session_id = %self.id,
            group_jid = %group_jid,
            new_code = %code,
            "stub: revoke_invite_code — returning fabricated replacement"
        );
        Ok(code)
    }
}

/// Stand-in factory that always builds a [`StubSession`]. Replace at the
/// top of `main.rs` with the real factory when Phase 2 starts.
pub struct StubFactory {
    redis: redis::Client,
}

impl StubFactory {
    pub fn new(redis: redis::Client) -> Self {
        Self { redis }
    }
}

#[async_trait]
impl WaSessionFactory for StubFactory {
    async fn create(
        &self,
        session_id: String,
        _auth_state: Option<Vec<u8>>,
    ) -> anyhow::Result<Arc<dyn WaSession>> {
        Ok(Arc::new(StubSession::new(session_id, self.redis.clone())))
    }
}

// ---------- Internal helpers ----------

async fn publish_qr(redis: &redis::Client, channel: &str, session_id: &str, qr: &str) {
    let payload = serde_json::json!({
        "type": "qr",
        "sessionId": session_id,
        "qr": qr,
        "ts": Utc::now().timestamp(),
    });
    // TODO: swap for crate::realtime::pubsub::publish(redis, channel, &payload).await.
    let _ = redis; // keep the param live for the future wiring.
    tracing::info!(
        target: "sabwa_engine::wa::stub",
        session_id = %session_id,
        channel = %channel,
        payload = %payload,
        "stub: publish QR (no-op until realtime::pubsub is wired)"
    );
}

async fn publish_status(redis: &redis::Client, channel: &str, session_id: &str, status: &str) {
    let payload = serde_json::json!({
        "type": "status",
        "sessionId": session_id,
        "status": status,
        "ts": Utc::now().timestamp(),
    });
    let _ = redis;
    tracing::info!(
        target: "sabwa_engine::wa::stub",
        session_id = %session_id,
        channel = %channel,
        payload = %payload,
        "stub: publish status (no-op until realtime::pubsub is wired)"
    );
}
