//! Axum router for the SabCRM saved-dashboards HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount this
//! router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/dashboards", sabcrm_dashboards::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/dashboards`):
//!
//! ```text
//! GET    /        — list_dashboards
//! POST   /        — create_dashboard
//! GET    /{id}    — get_dashboard
//! PATCH  /{id}    — update_dashboard
//! DELETE /{id}    — delete_dashboard
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

/// Build the SabCRM dashboards router. See module docs for the route table
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
            get(handlers::list_dashboards).post(handlers::create_dashboard),
        )
        .route(
            "/{id}",
            get(handlers::get_dashboard)
                .patch(handlers::update_dashboard)
                .delete(handlers::delete_dashboard),
        )
}
