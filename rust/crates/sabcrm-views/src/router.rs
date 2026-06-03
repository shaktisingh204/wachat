//! Axum router for the SabCRM saved-views HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/views", sabcrm_views::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/views`):
//!
//! ```text
//! GET    /              — list_views
//! POST   /              — create_view
//! PATCH  /{id}          — update_view
//! DELETE /{id}          — delete_view
//! POST   /{id}/default  — set_default_view
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM views router. See module docs for the route table and
/// state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_views).post(handlers::create_view))
        .route(
            "/{id}",
            axum::routing::patch(handlers::update_view).delete(handlers::delete_view),
        )
        .route("/{id}/default", post(handlers::set_default_view))
}
