//! Axum router for the SabCRM activities-timeline HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/activities", sabcrm_activities::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/activities`):
//!
//! ```text
//! GET    /                              — list_activities  (timeline, newest first)
//! POST   /                              — create_activity
//! PATCH  /{id}                          — update_activity
//! DELETE /{id}                          — delete_activity
//! GET    /{id}/comments                 — list_comments
//! POST   /{id}/comments                 — add_comment
//! PATCH  /{id}/comments/{commentId}     — edit_comment   (edit-own)
//! DELETE /{id}/comments/{commentId}     — delete_comment (delete-own)
//! POST   /{id}/reactions                — toggle_activity_reaction
//! POST   /{id}/comments/{commentId}/reactions — toggle_comment_reaction
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::get,
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM activities router. See module docs for the route table
/// and state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_activities).post(handlers::create_activity),
        )
        .route(
            "/{id}",
            axum::routing::patch(handlers::update_activity).delete(handlers::delete_activity),
        )
        .route(
            "/{id}/comments",
            get(handlers::list_comments).post(handlers::add_comment),
        )
        .route(
            "/{id}/comments/{commentId}",
            axum::routing::patch(handlers::edit_comment).delete(handlers::delete_comment),
        )
        .route(
            "/{id}/reactions",
            axum::routing::post(handlers::toggle_activity_reaction),
        )
        .route(
            "/{id}/comments/{commentId}/reactions",
            axum::routing::post(handlers::toggle_comment_reaction),
        )
}
