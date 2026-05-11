//! # telegram-stories
//!
//! Bot API 7.0+ stories: posting / editing / deleting channel and
//! business-account stories, manual business-connection registry, and
//! local-only draft / schedule / cancel workflow. Mounted by
//! `crates/api/src/router.rs` at `/v1/telegram/stories`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramStoriesState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramStoriesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Top-level list / create.
        .route("/", get(handlers::list).post(handlers::create))
        // Analytics, CSV export, business connections, star balance.
        // These must come BEFORE the `/{story_id}` path so axum doesn't
        // match them as story ids.
        .route("/analytics", get(handlers::analytics))
        .route("/export", get(handlers::export_csv))
        .route(
            "/business-connections",
            get(handlers::list_business_connections).post(handlers::register_business_connection),
        )
        .route(
            "/business-connections/{id}",
            delete(handlers::delete_business_connection),
        )
        .route("/star-balance", get(handlers::star_balance))
        // Per-story routes.
        .route(
            "/{story_id}",
            get(handlers::detail)
                .put(handlers::update_story)
                .delete(handlers::delete_story),
        )
        .route("/{story_id}/post", post(handlers::post_now))
        .route("/{story_id}/schedule", post(handlers::schedule))
        .route("/{story_id}/cancel", post(handlers::cancel))
        .route("/{story_id}/edit", post(handlers::edit_on_telegram))
        .route(
            "/{story_id}/delete-on-telegram",
            post(handlers::delete_on_telegram),
        )
}
