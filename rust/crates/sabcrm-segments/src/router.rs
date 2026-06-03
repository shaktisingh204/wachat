//! Axum router for the SabCRM saved-segments HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/segments", sabcrm_segments::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/segments`):
//!
//! ```text
//! GET    /        — list_segments
//! POST   /        — create_segment
//! GET    /{id}    — get_segment
//! PATCH  /{id}    — update_segment
//! DELETE /{id}    — delete_segment
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

/// Build the SabCRM segments router. See module docs for the route table and
/// state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_segments).post(handlers::create_segment),
        )
        .route(
            "/{id}",
            get(handlers::get_segment)
                .patch(handlers::update_segment)
                .delete(handlers::delete_segment),
        )
}
