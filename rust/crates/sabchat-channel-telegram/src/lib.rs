//! # sabchat-channel-telegram
//!
//! SabChat channel-adapter that ingests Telegram Bot API updates and
//! lands them on the unified SabChat conversation graph. Mounted under
//! `/v1/sabchat/channels/telegram` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/channels/telegram",
//!     sabchat_channel_telegram::router::<AppState>(),
//! )
//! ```
//!
//! ## Why a separate adapter crate
//!
//! SabChat keeps channel-specific normalisation out of the
//! `sabchat-messages` core. Each external transport (WhatsApp Cloud,
//! Telegram, Instagram, …) gets its own thin adapter that:
//!
//! 1. Resolves the target [`SabChatInbox`] keyed on the channel-native
//!    handle (bot username here; phone-number id for WhatsApp; page id
//!    for Instagram).
//! 2. Resolves or creates the per-tenant [`SabChatContact`] keyed on
//!    the channel-native external id (Telegram `fromId` here).
//! 3. Resolves or creates the latest open
//!    [`SabChatConversation`] on that `(inbox, contact)` pair.
//! 4. Appends one [`SabChatMessage`] (with the channel-translated
//!    [`ContentBlock`]).
//! 5. Caches a preview + bump `last_message_at` + bump `unread_count`
//!    on the conversation row for cheap inbox sort.
//!
//! Idempotency is enforced on `provider_metadata.update_id` so duplicate
//! Telegram webhook retries collapse to a single append.
//!
//! ## No JWT
//!
//! This surface is **server-to-server**, called by the Telegram webhook
//! shim that already lives in the same deployment. Tenant scope is
//! derived from the resolved inbox's `tenant_id`. There is no
//! [`AuthUser`](sabnode_auth::AuthUser) extractor anywhere in this
//! crate.
//!
//! ## Inbox lookup contract
//!
//! Telegram inboxes are stored as standard SabChat inboxes with:
//!
//! ```text
//! channel_type == "telegram"
//! channel_config.settings.bot_username == <bot username without '@'>
//! ```
//!
//! The webhook shim is expected to forward the bot username verbatim
//! (no leading `@`), matching what Telegram returns in the bot's
//! `getMe.username` field.
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

pub use state::SabChatChannelTelegramState;

/// Re-export of the [`ChannelType`] discriminant this adapter targets,
/// so downstream crates that wire up Telegram inboxes don't need a
/// separate `sabchat-types` dependency just to spell the enum.
pub use sabchat_types::ChannelType;

/// Build the SabChat Telegram channel-adapter router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/channels/telegram`):
///
/// ```text
/// POST /ingest    — handlers::ingest
/// POST /callback  — handlers::callback
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatChannelTelegramState`] bundle pulled via [`FromRef`] so this
/// crate stays decoupled from the orchestrator's `AppState` struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatChannelTelegramState: FromRef<S>,
{
    Router::new()
        .route("/ingest", post(handlers::ingest))
        .route("/callback", post(handlers::callback))
}
