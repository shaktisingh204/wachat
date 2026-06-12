//! Axum router for the SabCRM assignment-routing HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/routing", sabcrm_routing::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/routing`):
//!
//! ```text
//! GET    /          — list_rules (objectSlug/trigger/active filters)
//! POST   /          — create_rule
//! POST   /evaluate  — evaluate (apply first matching active rule)
//! GET    /{id}      — get_rule
//! PATCH  /{id}      — update_rule
//! DELETE /{id}      — delete_rule
//! ```
//!
//! The static `/evaluate` route is declared alongside the `/{id}` param
//! routes — axum's matcher prefers the static segment.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM routing router. See module docs for the route table
/// and state contract.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_rules).post(handlers::create_rule))
        .route("/evaluate", post(handlers::evaluate))
        .route(
            "/{id}",
            get(handlers::get_rule)
                .patch(handlers::update_rule)
                .delete(handlers::delete_rule),
        )
}
