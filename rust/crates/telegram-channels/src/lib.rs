//! # telegram-channels
//!
//! Telegram channel administration via the bot API. Discover channels,
//! post messages (single, media or media-group), schedule posts, edit /
//! pin / delete messages, list administrators and promote/demote them,
//! plus surface a lightweight stats view computed from the local
//! mirror. Mount under `/v1/telegram/channels`.
//!
//! Every endpoint is project-scoped (`require_project`), so the page
//! always knows which workspace it is operating in.

pub mod bot_api;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramChannelsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramChannelsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // List channels.
        .route("/", get(handlers::list))
        // Discover a new channel.
        .route("/discover", post(handlers::discover))
        // Channel detail (refresh from Telegram).
        .route(
            "/{channel_id}",
            get(handlers::get_channel).delete(handlers::delete_channel),
        )
        // Administrators.
        .route("/{channel_id}/admins", get(handlers::list_admins))
        .route("/{channel_id}/promote", post(handlers::promote))
        .route("/{channel_id}/demote", post(handlers::demote))
        // Posts.
        .route("/{channel_id}/post", post(handlers::post_message))
        .route("/{channel_id}/posts", get(handlers::list_posts))
        .route(
            "/{channel_id}/posts/{post_id}/edit",
            post(handlers::edit_post),
        )
        .route(
            "/{channel_id}/posts/{post_id}",
            delete(handlers::delete_post),
        )
        .route(
            "/{channel_id}/posts/{post_id}/pin",
            post(handlers::pin_post).delete(handlers::unpin_post),
        )
        // Scheduled.
        .route("/{channel_id}/scheduled", get(handlers::list_scheduled))
        .route(
            "/{channel_id}/scheduled/{post_id}",
            delete(handlers::cancel_scheduled),
        )
        // Stats.
        .route("/{channel_id}/stats", get(handlers::stats))
}
