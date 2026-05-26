//! # sabchat-channel-line
//!
//! SabChat channel-adapter that ingests LINE Messaging API events and
//! lands them on the unified SabChat conversation graph. Mounted under
//! `/v1/sabchat/channels/line` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/channels/line",
//!     sabchat_channel_line::router::<AppState>(),
//! )
//! ```
//!
//! ## Why a separate adapter crate
//!
//! SabChat keeps channel-specific normalisation out of the
//! `sabchat-messages` core. Each external transport (WhatsApp Cloud,
//! Telegram, LINE, Instagram, …) gets its own thin adapter that:
//!
//! 1. Resolves the target [`SabChatInbox`] keyed on the channel-native
//!    handle (LINE `channelId` here; bot username for Telegram;
//!    phone-number id for WhatsApp; page id for Instagram).
//! 2. Resolves or creates the per-tenant [`SabChatContact`] keyed on
//!    the channel-native external id (LINE `userId` here).
//! 3. Resolves or creates the latest open
//!    [`SabChatConversation`] on that `(inbox, contact)` pair.
//! 4. Appends one [`SabChatMessage`] (with the channel-translated
//!    [`ContentBlock`]).
//! 5. Caches a preview + bump `last_message_at` + bump `unread_count`
//!    on the conversation row for cheap inbox sort.
//!
//! Idempotency is enforced on `provider_metadata.update_id` so duplicate
//! LINE webhook retries collapse to a single append.
//!
//! ## No JWT
//!
//! This surface is **server-to-server**, called by the LINE webhook
//! shim that already lives in the same deployment. Tenant scope is
//! derived from the resolved inbox's `tenant_id`. There is no
//! [`AuthUser`](sabnode_auth::AuthUser) extractor anywhere in this
//! crate.
//!
//! ## Inbox lookup contract
//!
//! LINE inboxes are stored as standard SabChat inboxes with:
//!
//! ```text
//! channel_type == "line"
//! channel_config.settings.channel_id == <LINE webhook destination>
//! ```
//!
//! The webhook shim is expected to forward `event.destination` verbatim
//! — that's the bot/official-account channel id LINE puts at the root
//! of every webhook payload.
//!
//! ## Collections
//!
//! Same sibling collections as every other SabChat adapter:
//!
//! - `sabchat_inboxes`
//! - `sabchat_contacts`
//! - `sabchat_conversations`
//! - `sabchat_messages`
//!
//! [`SabChatInbox`]: sabchat_types::SabChatInbox
//! [`SabChatContact`]: sabchat_types::SabChatContact
//! [`SabChatConversation`]: sabchat_types::SabChatConversation
//! [`SabChatMessage`]: sabchat_types::SabChatMessage
//! [`ContentBlock`]: sabchat_types::ContentBlock

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};

pub use state::SabChatChannelLineState;

/// Re-export of the [`ChannelType`] discriminant this adapter targets,
/// so downstream crates that wire up LINE inboxes don't need a separate
/// `sabchat-types` dependency just to spell the enum.
pub use sabchat_types::ChannelType;

/// Build the SabChat LINE channel-adapter router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/channels/line`):
///
/// ```text
/// POST /ingest    — handlers::ingest
/// POST /follow    — handlers::follow
/// POST /postback  — handlers::postback
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatChannelLineState`] bundle pulled via [`FromRef`] so this
/// crate stays decoupled from the orchestrator's `AppState` struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelLineState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest))
        .route("/follow", post(handlers::follow))
        .route("/postback", post(handlers::postback))
}
