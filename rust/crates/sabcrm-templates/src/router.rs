//! Axum router for the SabCRM templates HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/templates", sabcrm_templates::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/templates`):
//!
//! ```text
//! GET    /             — list_templates
//! POST   /             — create_template
//! POST   /preview      — preview_template  (ad-hoc render)
//! GET    /{id}         — get_template
//! PATCH  /{id}         — update_template
//! DELETE /{id}         — delete_template
//! POST   /{id}/render  — render_template   (stored template render)
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

/// Build the SabCRM templates router. See module docs for the route table
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
            get(handlers::list_templates).post(handlers::create_template),
        )
        .route("/preview", post(handlers::preview_template))
        .route(
            "/{id}",
            get(handlers::get_template)
                .patch(handlers::update_template)
                .delete(handlers::delete_template),
        )
        .route("/{id}/render", post(handlers::render_template))
}
