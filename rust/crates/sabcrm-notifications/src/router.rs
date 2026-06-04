//! Axum router for the SabCRM notifications HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/notifications", sabcrm_notifications::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/notifications`):
//!
//! ```text
//! GET    /            — list_notifications
//! GET    /count       — count_notifications
//! GET    /stream      — stream_notifications (SSE, text/event-stream)
//! POST   /            — create_notification
//! POST   /read-all    — mark_all_read
//! POST   /{id}/read   — mark_read
//! DELETE /{id}        — delete_notification
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM notifications router. See module docs for the route
/// table and state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_notifications).post(handlers::create_notification),
        )
        .route("/count", get(handlers::count_notifications))
        .route("/stream", get(handlers::stream_notifications))
        .route("/read-all", post(handlers::mark_all_read))
        .route("/{id}/read", post(handlers::mark_read))
        .route("/{id}", delete(handlers::delete_notification))
}
