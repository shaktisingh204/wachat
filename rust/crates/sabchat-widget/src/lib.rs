//! # sabchat-widget
//!
//! Phase — axum router for the **public** SabChat widget HTTP surface.
//! Mounted under `/v1/sabchat/widget` by the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/widget", sabchat_widget::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! These are the endpoints the JS widget loaded on third-party websites
//! talks to directly. There is **no [`AuthUser`](sabnode_auth::AuthUser)
//! extractor** — the public widget cannot present a SabNode JWT. Instead
//! every request is scoped by one of two soft credentials:
//!
//! - the inbox id (a Mongo `ObjectId`) — looked up to derive the tenant
//!   scope. We refuse to serve disabled inboxes;
//! - an opaque `visitorToken` (32-byte hex string) issued by
//!   [`handlers::start_session`] and stored in
//!   `sabchat_widget_sessions`. The token TTL is 7 days from
//!   `created_at` and is refreshed on every `post_message`.
//!
//! For embedding logged-in app users the host site can additionally
//! pass an `externalUserId` plus an `identityHmac` —
//! `hex(hmac_sha256(secret, externalUserId))` — where `secret` is the
//! inbox's `channel_config.settings.identity_secret`. We verify before
//! trusting the supplied `externalUserId`.
//!
//! ## Routes
//!
//! | HTTP route                                | Handler                       |
//! |-------------------------------------------|-------------------------------|
//! | `GET    /config?inboxId=`                 | [`handlers::public_config`]   |
//! | `POST   /session`                         | [`handlers::start_session`]   |
//! | `POST   /messages`                        | [`handlers::post_message`]    |
//! | `GET    /history?visitorToken=&beforeId=&limit=` | [`handlers::fetch_history`] |
//! | `POST   /end`                             | [`handlers::end_session`]     |
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need only a [`SabChatWidgetState`] bundle (a Mongo handle today),
//! which is pulled via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
mod preview;
mod session;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabchat_ws::WsHub;

pub use state::SabChatWidgetState;

/// Build the SabChat widget router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/widget`):
///
/// ```text
/// GET    /config         — public_config
/// POST   /session        — start_session
/// POST   /messages       — post_message
/// GET    /history        — fetch_history
/// POST   /end            — end_session
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatWidgetState: FromRef<S>,
    WsHub: FromRef<S>,
{
    Router::new()
        .route("/config", get(handlers::public_config))
        .route("/session", post(handlers::start_session))
        .route("/identify", post(handlers::identify))
        .route("/messages", post(handlers::post_message))
        .route("/history", get(handlers::fetch_history))
        .route("/stream", get(handlers::widget_stream))
        .route("/end", post(handlers::end_session))
}
