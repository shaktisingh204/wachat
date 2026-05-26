//! # sabchat-channel-sms
//!
//! Phase — axum router for the **SabChat SMS channel adapter**. Mounted
//! under `/v1/sabchat/channels/sms` by the orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/channels/sms",
//!     sabchat_channel_sms::router::<AppState>(),
//! )
//! ```
//!
//! ## Scope
//!
//! Two endpoints, both POSTed by the (already signature-verified) shim
//! that sits in front of the SMS providers (Twilio, MSG91, …):
//!
//! | HTTP route        | Handler                          |
//! |-------------------|----------------------------------|
//! | `POST /ingest`    | [`handlers::ingest`] — inbound SMS message |
//! | `POST /status`    | [`handlers::status`] — provider delivery receipt |
//!
//! There is **no `AuthUser` extractor**. Provider webhooks cannot
//! present a SabNode JWT — instead the shim crate
//! (`sabsms-webhooks-inbound`) verifies the provider signature and only
//! then forwards a normalised JSON envelope to us. We trust pre-verified
//! ingest events.
//!
//! ## Resolution rules (matching the slice contract)
//!
//! - **Inbox** is found by `channelType == "sms"` AND
//!   `channelConfig.settings.from_number == event.to`. The inbox row
//!   carries the tenant scope.
//! - **Contact** is looked up by `phones` (digits-only normalised
//!   `event.from`) within the inbox tenant. Missing contacts are
//!   created.
//! - **Conversation** is the most recent open/pending thread on the
//!   (inbox, contact) pair, or a brand new `pending` conversation when
//!   none exists.
//! - **Idempotency** uses `providerMetadata.providerMessageId` (scoped
//!   by `providerMetadata.provider` so two providers can't collide on a
//!   shared id).
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need only a [`SabChatChannelSmsState`] bundle (a Mongo
//! handle today), which is pulled via
//! [`FromRef`](axum::extract::FromRef) so this crate stays decoupled
//! from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};

pub use state::SabChatChannelSmsState;

/// Build the SabChat SMS channel router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/channels/sms`):
///
/// ```text
/// POST /ingest    — handlers::ingest
/// POST /status    — handlers::status
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelSmsState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest))
        .route("/status", post(handlers::status))
}
