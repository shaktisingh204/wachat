//! # sabchat-channel-email
//!
//! Axum router that translates inbound email events into SabChat
//! conversations + messages. Acts as the "channel adapter" half of the
//! email transport: an upstream component (the IMAP poller, or a
//! Postmark / SendGrid inbound webhook shim) normalises raw MIME into a
//! flat JSON payload and POSTs it here; we resolve the owning inbox,
//! find-or-create the contact, find-or-create the conversation (using
//! the `In-Reply-To` / `References` header chain to thread replies
//! into existing conversations), then append a single visitor inbound
//! [`SabChatMessage`][sabchat_types::SabChatMessage].
//!
//! ## Routes
//!
//! Mounted under `/v1/sabchat/channels/email` by the orchestrator:
//!
//! ```text
//! POST /ingest   — single inbound email event
//! ```
//!
//! ## Threading
//!
//! Emails group by RFC-2822 [`In-Reply-To`] / [`References`] chains. We
//! persist the `Message-ID` of every inbound message under
//! `provider_metadata.message_id` and the full reference list under
//! `provider_metadata.references` on the [`SabChatMessage`] row. To find
//! the parent conversation for a new inbound email we scan
//! `sabchat_messages` for any prior message whose
//! `provider_metadata.message_id` appears in the inbound's
//! `In-Reply-To` / `References` set; the first hit's `conversation_id`
//! wins and the new message attaches to it. If no chain match is found
//! we create a brand new conversation, taking its title from the first
//! message's subject.
//!
//! ## Tenancy
//!
//! No JWT. The router is a server-to-server endpoint — the IMAP poller
//! and the inbound webhook shim run inside the trust boundary.
//! Tenancy is established entirely by the `to:` address: we look up the
//! `sabchat_inboxes` row whose `channel_type == "email"` and whose
//! `channel_config.settings.address` equals the inbound recipient.
//! Unknown recipients surface as `404 Not Found`. Authentication of the
//! caller itself (poller / webhook shim) is the responsibility of the
//! reverse proxy / network layer mounting this router.
//!
//! ## Idempotency
//!
//! Each inbound message carries a stable RFC-2822 `Message-ID`. Before
//! inserting we look up `sabchat_messages` for a row whose
//! `provider_metadata.message_id` already equals the inbound's
//! `message_id` **inside this tenant**; if one is found we return its
//! `conversation_id` + `message_id` instead of creating a duplicate.
//! Retries from upstream (webhook redelivery, IMAP poller restart) are
//! therefore safe.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. Only the
//! [`SabChatChannelEmailState`] bundle (a Mongo handle) needs to be
//! reachable via [`FromRef`](axum::extract::FromRef). No
//! [`AuthConfig`](sabnode_auth::AuthConfig) is required because the
//! routes do not authenticate per-request.

pub mod dto;
pub mod handlers;
pub mod state;
pub(crate) mod threading;

use axum::{Router, extract::FromRef, routing::post};

pub use state::SabChatChannelEmailState;

/// Build the SabChat email channel router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/channels/email`):
///
/// ```text
/// POST /ingest   — ingest one inbound email event
/// ```
///
/// `S` is the caller's outer application state. The handlers only need
/// a [`SabChatChannelEmailState`] bundle; it is pulled via [`FromRef`]
/// so this crate stays decoupled from the orchestrator's `AppState`
/// struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelEmailState: FromRef<S>,
{
    Router::new().route("/ingest", post(handlers::ingest))
}
