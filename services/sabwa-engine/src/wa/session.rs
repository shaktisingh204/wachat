//! [`WaSession`] — the runtime-agnostic trait every WhatsApp client
//! implementation in this crate must satisfy.
//!
//! Rest of the engine (routes, scheduler, webhooks, anti-ban) talks to
//! `Arc<dyn WaSession>` and never touches a concrete client. Phase 1
//! ships a [`crate::wa::stub::StubSession`] — Phase 2 will swap in a real
//! Multi-Device implementation. See `SABWA_PLAN.md` §4 and §16.

use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use super::errors::WaError;

// ---------- Pairing DTOs ----------

/// How the user wants to link their phone.
///
/// Mirrors SABWA_PLAN.md §4 ("Mode A: QR" / "Mode B: pair code") and the
/// `sabwa_sessions.pairMethod` Mongo field.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PairMethod {
    /// Display a refreshing QR code in the browser.
    Qr,
    /// Display an 8-character pair code; user enters it on their phone.
    Code,
}

/// Input for [`WaSession::start_pair`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairRequest {
    pub method: PairMethod,
    /// Required for [`PairMethod::Code`]; ignored for QR.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone_e164: Option<String>,
}

/// First-shot pairing payload returned to the browser.
///
/// Subsequent QR rotations are streamed over SSE / WebSocket via the
/// `realtime` module — this struct only carries the **initial** artifact.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairResponse {
    /// Base64-encoded QR (PNG bytes or ref string). `None` when pairing
    /// via [`PairMethod::Code`].
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qr: Option<String>,
    /// 8-char pair code, e.g. `"JKLM-NPQR"`. `None` for QR pairing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pair_code: Option<String>,
}

// ---------- Send DTOs ----------

/// Input for [`WaSession::send`].
///
/// `kind` matches the values stored on `sabwa_messages.type` (SABWA_PLAN
/// §3). `body` carries plain text for text messages and is otherwise
/// optional. `media_url` should point at a SabFiles URL (never a raw
/// external URL — see project SabFiles policy).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendRequest {
    pub chat_jid: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quoted_message_id: Option<String>,
    /// Group mentions (`@<phone>`) — JIDs of users to ping.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mentions: Vec<String>,
}

/// Outcome of a successful [`WaSession::send`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendResponse {
    /// WA-side message id (`key.id` in Baileys parlance).
    pub message_id: String,
    /// Server-assigned timestamp (epoch seconds, UTC).
    pub server_ts: i64,
}

/// Live status snapshot of a session, returned by [`crate::wa::pool::status`].
///
/// Mirrors the shape `routes::sessions::get_session_status` projects onto
/// `SessionStatusResponse`. Filled in best-effort from the pool's cached
/// session — fields that aren't known yet are simply `None`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusDto {
    /// `pending` | `connected` | `logged_out` | `banned` | `error`.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qr: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pair_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_connected_at: Option<chrono::DateTime<chrono::Utc>>,
}

// ---------- Presence ----------

/// Presence states we can broadcast on the wire. Maps 1:1 to WA's own
/// presence enum (`available`, `composing`, etc.).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PresenceKind {
    Available,
    Composing,
    Recording,
    Paused,
    Unavailable,
}

// ---------- Traits ----------

/// One live WhatsApp Multi-Device session.
///
/// Implementations MUST be `Send + Sync` (handed around as
/// `Arc<dyn WaSession>` from a `tokio` runtime). All methods are async so
/// implementations can do network I/O, but the trait says nothing about
/// the transport — see [`crate::wa::stub`] for a no-op implementation and
/// the module-level docs for the planned Phase 2 implementations.
#[async_trait]
pub trait WaSession: Send + Sync {
    /// The stable session id this client is bound to. Always equals
    /// `sabwa_sessions._id` once the session is persisted.
    fn id(&self) -> &str;

    /// Begin a pairing flow. Returns the first QR / pair code; subsequent
    /// QRs are streamed via `realtime::pubsub`.
    async fn start_pair(&self, req: PairRequest) -> Result<PairResponse, WaError>;

    /// Cheap, non-blocking liveness check. `true` iff the underlying
    /// socket is in the `open` state.
    async fn is_connected(&self) -> bool;

    /// Send an outbound message. Anti-ban / rate-limit policy is applied
    /// **outside** this trait (see `crate::antiban`) — `send` itself is
    /// expected to fail-fast.
    async fn send(&self, req: SendRequest) -> Result<SendResponse, WaError>;

    /// Tear down the live connection and invalidate stored auth state.
    async fn logout(&self) -> Result<(), WaError>;

    /// Broadcast presence to a peer (typing / recording indicators).
    async fn presence(&self, jid: &str, kind: PresenceKind) -> Result<(), WaError>;

    /// Send a read receipt for a specific message.
    async fn mark_read(&self, jid: &str, message_id: &str) -> Result<(), WaError>;

    /// Create a new group. Returns the new group JID (ends in `@g.us`).
    async fn create_group(
        &self,
        subject: &str,
        participants: Vec<String>,
    ) -> Result<String, WaError>;

    /// Add members to an existing group.
    async fn add_participants(
        &self,
        group_jid: &str,
        jids: Vec<String>,
    ) -> Result<(), WaError>;

    /// Remove members from a group (requires admin).
    async fn remove_participants(
        &self,
        group_jid: &str,
        jids: Vec<String>,
    ) -> Result<(), WaError>;

    /// Promote a member to admin (requires super-admin).
    async fn promote_admin(&self, group_jid: &str, jid: &str) -> Result<(), WaError>;

    /// Demote an admin back to a regular member.
    async fn demote_admin(&self, group_jid: &str, jid: &str) -> Result<(), WaError>;

    /// Fetch the current invite code for a group (admin only).
    async fn get_invite_code(&self, group_jid: &str) -> Result<String, WaError>;

    /// Revoke the current invite code; returns the freshly minted one.
    async fn revoke_invite_code(&self, group_jid: &str) -> Result<String, WaError>;
}

/// Factory used by the session pool to instantiate one [`WaSession`] per
/// linked account. Lets us swap stubs in tests / Phase 2 implementations
/// without touching call sites.
#[async_trait]
pub trait WaSessionFactory: Send + Sync {
    /// Build a fresh session, optionally hydrating from a previously
    /// persisted `auth_state` blob (the encrypted Baileys creds stored on
    /// `sabwa_sessions.authState`).
    async fn create(
        &self,
        session_id: String,
        auth_state: Option<Vec<u8>>,
    ) -> anyhow::Result<Arc<dyn WaSession>>;
}
