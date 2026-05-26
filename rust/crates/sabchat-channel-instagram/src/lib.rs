//! # sabchat-channel-instagram
//!
//! Phase — axum router for the SabChat **Instagram DM** channel adapter.
//! Translates already-verified Instagram webhook events (forwarded by the
//! Next.js webhook shim after Meta signature verification) into the
//! unified SabChat conversation graph.
//!
//! Mounted under `/v1/sabchat/channels/instagram` from the orchestrating
//! `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/channels/instagram",
//!     sabchat_channel_instagram::router::<AppState>(),
//! )
//! ```
//!
//! ## Routes
//!
//! | Method | Path       | Handler         | Idempotency key       |
//! |--------|------------|-----------------|-----------------------|
//! | POST   | `/ingest`  | `ingest_dm`     | `providerMessageId`   |
//! | POST   | `/comment` | `ingest_comment`| `commentId`           |
//!
//! ## Collections touched
//!
//! - **read** `sabchat_inboxes` — find the inbox where
//!   `channelType == "instagram"` AND
//!   `channelConfig.settings.igUserId == body.igUserId`.
//! - **read/write** `sabchat_contacts` — resolve (or create) by
//!   `socialIds[provider="instagram", externalId=senderId]`.
//! - **read/write** `sabchat_conversations` — reuse the newest
//!   open/pending/snoozed conversation for `(tenant, inbox, contact)` or
//!   open a fresh one. Roll up `lastMessageAt` / preview / unread count.
//! - **write** `sabchat_messages` — append one inbound visitor message
//!   with the IG-side id pinned in `providerMetadata.idempotencyKey`.
//! - **write** `sabchat_audit_log` — best-effort `message_sent`,
//!   `conversation_created`, `contact_created` events (failures logged
//!   only).
//!
//! ## Auth
//!
//! Both endpoints are **server-to-server** — the Next.js webhook shim
//! verifies Meta's `x-hub-signature-256` upstream and only forwards
//! normalised, trusted payloads here. There is no
//! [`AuthUser`](sabnode_auth::AuthUser) extractor; tenancy comes off the
//! matched inbox doc.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! only need a [`SabChatChannelInstagramState`] bundle (one Mongo
//! handle), pulled via [`FromRef`](axum::extract::FromRef) so this crate
//! stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};

pub use state::SabChatChannelInstagramState;

/// Build the SabChat Instagram channel router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/channels/instagram`):
///
/// ```text
/// POST   /ingest    — ingest_dm
/// POST   /comment   — ingest_comment
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelInstagramState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest_dm))
        .route("/comment", post(handlers::ingest_comment))
}
