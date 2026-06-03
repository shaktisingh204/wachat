//! Axum router for the SabCRM automation-workflows HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/workflows", sabcrm_workflows::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/workflows`):
//!
//! ```text
//! GET    /        — list_workflows
//! POST   /        — create_workflow
//! GET    /{id}    — get_workflow
//! PATCH  /{id}    — update_workflow
//! DELETE /{id}    — delete_workflow
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM workflows router. See module docs for the route table
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
            get(handlers::list_workflows).post(handlers::create_workflow),
        )
        .route(
            "/{id}",
            get(handlers::get_workflow)
                .patch(handlers::update_workflow)
                .delete(handlers::delete_workflow),
        )
}
