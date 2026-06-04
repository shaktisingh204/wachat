//! Axum router for the SabCRM sales-pipelines HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/pipelines", sabcrm_pipelines::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/pipelines`):
//!
//! ```text
//! GET    /        — list_pipelines
//! POST   /        — create_pipeline
//! GET    /{id}    — get_pipeline
//! PATCH  /{id}    — update_pipeline
//! DELETE /{id}    — delete_pipeline
//! GET    /{id}/board           — get_board (per-stage count + summed amount)
//! POST   /{id}/stages/reorder  — reorder_stages
//! POST   /{id}/move-record     — move_record
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

/// Build the SabCRM pipelines router. See module docs for the route table and
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
            get(handlers::list_pipelines).post(handlers::create_pipeline),
        )
        .route(
            "/{id}",
            get(handlers::get_pipeline)
                .patch(handlers::update_pipeline)
                .delete(handlers::delete_pipeline),
        )
        .route("/{id}/board", get(handlers::get_board))
        .route("/{id}/stages/reorder", post(handlers::reorder_stages))
        .route("/{id}/move-record", post(handlers::move_record))
}
