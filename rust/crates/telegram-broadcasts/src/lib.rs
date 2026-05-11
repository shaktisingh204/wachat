//! # telegram-broadcasts
//!
//! Telegram broadcast manager. Mount under `/v1/telegram/broadcasts`.
//!
//! Exposes:
//!   * `GET    /`                          — list (filter + paginate)
//!   * `POST   /`                          — create (draft)
//!   * `GET    /analytics`                 — aggregate analytics for a project
//!   * `GET    /{id}`                      — fetch one
//!   * `PATCH  /{id}`                      — update (only when status=draft)
//!   * `DELETE /{id}`                      — delete
//!   * `POST   /{id}/duplicate`            — duplicate as new draft
//!   * `POST   /{id}/send-now`             — flip to SENDING + enqueue
//!   * `POST   /{id}/send`                 — legacy alias for `/send-now`
//!   * `POST   /{id}/schedule`             — set scheduledAt + flip to SCHEDULED
//!   * `POST   /{id}/cancel`               — cancel scheduled / sending broadcast
//!   * `POST   /{id}/test`                 — fire a one-off preview to a chat id
//!   * `GET    /{id}/deliveries`           — paginated delivery log
//!   * `GET    /{id}/deliveries.csv`       — CSV export of the same log

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramBroadcastsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramBroadcastsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::create))
        .route("/analytics", get(handlers::analytics))
        .route(
            "/{broadcast_id}",
            get(handlers::get_one)
                .patch(handlers::update)
                .delete(handlers::delete_one),
        )
        .route("/{broadcast_id}/duplicate", post(handlers::duplicate))
        .route("/{broadcast_id}/send-now", post(handlers::send_now))
        // Backward-compat alias — original slice exposed `/send`.
        .route("/{broadcast_id}/send", post(handlers::send_now))
        .route("/{broadcast_id}/schedule", post(handlers::schedule))
        .route("/{broadcast_id}/cancel", post(handlers::cancel))
        .route("/{broadcast_id}/test", post(handlers::test_send))
        .route("/{broadcast_id}/deliveries", get(handlers::deliveries))
        .route(
            "/{broadcast_id}/deliveries.csv",
            get(handlers::deliveries_csv),
        )
}
