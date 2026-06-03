//! Axum router for the SabCRM workflow-runs HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/workflow-runs", sabcrm_workflow_runs::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under
//! `/v1/sabcrm/workflow-runs`):
//!
//! ```text
//! GET    /        — list_runs
//! POST   /        — create_run
//! GET    /{id}    — get_run
//! PATCH  /{id}    — update_run
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM workflow-runs router. See module docs for the route
/// table and state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_runs).post(handlers::create_run))
        .route(
            "/{id}",
            get(handlers::get_run).patch(handlers::update_run),
        )
}
