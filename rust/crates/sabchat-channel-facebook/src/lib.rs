//! # sabchat-channel-facebook
//!
//! Channel adapter that ingests Facebook Messenger DMs and Page-comment
//! webhook events into the SabChat inbox graph. Mounted under
//! `/v1/sabchat/channels/facebook` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/channels/facebook",
//!     sabchat_channel_facebook::router::<AppState>(),
//! )
//! ```
//!
//! ## Scope
//!
//! Two server-to-server routes — the upstream Facebook webhook
//! verifier / signature check / queue-drainer lives in the Next.js
//! shim and POSTs normalised JSON here. There is no `AuthUser`
//! extractor; the network boundary is the trust boundary.
//!
//! | Route                                           | Purpose                                      |
//! |-------------------------------------------------|----------------------------------------------|
//! | `POST /v1/sabchat/channels/facebook/ingest`     | Messenger DM → visitor message               |
//! | `POST /v1/sabchat/channels/facebook/comment`    | Page comment → Card block citing the post    |
//!
//! ## Inbox resolution
//!
//! Both routes locate the owning [`SabChatInbox`](sabchat_types::SabChatInbox)
//! by:
//!
//! ```text
//! channel_type == "facebook"
//!  AND channel_config.settings.page_id == event.page_id
//! ```
//!
//! Tenancy flows from the resolved inbox's `tenantId`; the caller does
//! not (and cannot) assert it directly.
//!
//! ## Idempotency
//!
//! Both routes are idempotent against an event-scoped key:
//!
//! - `/ingest`  → `providerMessageId` (`fb-msg:{providerMessageId}`)
//! - `/comment` → `commentId`         (`fb-comment:{commentId}`)
//!
//! The key is written into `sabchat_messages.providerMetadata.dedupeKey`.
//! On the application path we `find_one({ "providerMetadata.dedupeKey": k })`
//! before insert so duplicate webhook deliveries are no-ops that still
//! return 200 with the existing ids (mirrors the Instagram adapter).
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. It only needs
//! the [`SabChatChannelFacebookState`] bundle (a Mongo handle), pulled
//! via [`FromRef`](axum::extract::FromRef) so this crate stays decoupled
//! from the orchestrator's concrete `AppState`.

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};

pub use state::SabChatChannelFacebookState;

/// Build the Facebook channel ingest router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/channels/facebook`):
///
/// ```text
/// POST /ingest    — Messenger DM   (idempotent on providerMessageId)
/// POST /comment   — Page comment   (idempotent on commentId)
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelFacebookState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest_messenger))
        .route("/comment", post(handlers::ingest_comment))
}
