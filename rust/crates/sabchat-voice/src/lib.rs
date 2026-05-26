//! # sabchat-voice
//!
//! Phase — axum router that owns the SabChat **voice / video calling**
//! HTTP surface. Mounted under `/v1/sabchat/voice` from the orchestrating
//! `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/voice", sabchat_voice::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! WebRTC media is offloaded to a third-party provider — LiveKit or
//! Daily.co today, chosen per-tenant via env. The per-call access token
//! issued by the provider is what gates the room; SabNode itself only
//! cares about signaling (who started the call, who joined, when it
//! ended) and the durable call record under the `sabchat_calls` Mongo
//! collection.
//!
//! | Method | Path                              | Handler              |
//! |--------|-----------------------------------|----------------------|
//! | POST   | `/calls`                          | [`handlers::start`]  |
//! | POST   | `/calls/{id}/answer`              | [`handlers::answer`] |
//! | POST   | `/calls/{id}/end`                 | [`handlers::end`]    |
//! | POST   | `/calls/{id}/fail`                | [`handlers::fail`]   |
//! | GET    | `/calls`                          | [`handlers::list`]   |
//! | GET    | `/calls/{id}`                     | [`handlers::get_one`]|
//! | GET    | `/token`                          | [`handlers::token`]  |
//!
//! ## Provider adapter (stub for now)
//!
//! Per-call tokens are issued by a small env-driven adapter. The shape
//! of the adapter is fixed (input = room id + participant identity +
//! kind, output = an opaque JWT-like string the client hands to the
//! WebRTC SDK). Today every call returns the literal string `"stub"`
//! — wiring the real LiveKit / Daily.co SDKs in is a follow-up that
//! does not change any HTTP shape.
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. Every read and every write filters on
//! `tenant_id == ObjectId(auth.tenant_id)`. There is no cross-tenant
//! call lookup, and a malformed `tid` claim is treated as
//! `401 Unauthorized` (matches the sabchat-audit convention).
//!
//! ## Side-effects on `end`
//!
//! Ending a call posts a `ContentBlock::System` message into the parent
//! conversation (so the inbox reflects "📞 voice call ended (42s)")
//! and writes a `message_sent` row to `sabchat_audit_log`. Both writes
//! are best-effort with respect to the user-facing operation — a
//! Mongo error while writing the system message must not roll the
//! call's `ended` state back. We mirror the
//! [`sabchat-messages`](../sabchat_messages/index.html) `write_audit`
//! contract (log on failure, never propagate).
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatVoiceState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

#![forbid(unsafe_code)]

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatVoiceState;

/// Mongo collection name for persisted call records. Exposed
/// `pub(crate)` so the handlers + any future helpers agree on the name
/// in one place.
pub(crate) const CALLS_COLL: &str = "sabchat_calls";

/// Mongo collection name for the system-message we post into the
/// parent conversation when a call ends.
pub(crate) const MESSAGES_COLL: &str = "sabchat_messages";

/// Mongo collection name for the parent conversation row we patch
/// (`lastMessageAt` / `lastMessagePreview` / `updatedAt`) when a call
/// ends.
pub(crate) const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// Mongo collection name for the audit log. Sibling crates also use
/// `sabchat_audit_log`; once a `sabchat-audit` path dep is taken we
/// can swap the inline write for `sabchat_audit::record(...)`.
pub(crate) const AUDIT_COLL: &str = "sabchat_audit_log";

/// Build the SabChat voice router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/voice`):
///
/// ```text
/// POST   /calls                          — start
/// POST   /calls/{id}/answer              — answer
/// POST   /calls/{id}/end                 — end
/// POST   /calls/{id}/fail                — fail
/// GET    /calls                          — list (filtered, cursor-paginated)
/// GET    /calls/{id}                     — get_one
/// GET    /token?callId=...               — re-issue a provider room token
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatVoiceState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route-ordering note:** the literal `/calls/{id}/answer`,
/// `/calls/{id}/end`, `/calls/{id}/fail` segments are registered before
/// the bare `/calls/{id}` so axum's matcher prefers the more specific
/// patterns over the generic `{id}` capture.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatVoiceState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- token re-issue (literal segment) ----------------------------
        .route("/token", get(handlers::token))
        // ---- collection root ---------------------------------------------
        .route("/calls", post(handlers::start).get(handlers::list))
        // ---- per-call lifecycle transitions (literal segments first) -----
        .route("/calls/{id}/answer", post(handlers::answer))
        .route("/calls/{id}/end", post(handlers::end))
        .route("/calls/{id}/fail", post(handlers::fail))
        // ---- per-call read -----------------------------------------------
        .route("/calls/{id}", get(handlers::get_one))
}
