//! Axum router for the SabCRM object-metadata HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState` without this crate having to know
//! the concrete state struct:
//!
//! ```ignore
//! .nest("/v1/sabcrm/objects", sabcrm_objects::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/objects`):
//!
//! ```text
//! GET    /            — list_objects   (merged standard + custom)
//! POST   /            — create_object
//! GET    /{slug}      — get_object      (merged)
//! PATCH  /{slug}      — update_object
//! DELETE /{slug}      — delete_object
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

/// Build the SabCRM objects router. See module docs for the route table
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
            get(handlers::list_objects).post(handlers::create_object),
        )
        .route(
            "/{slug}",
            get(handlers::get_object)
                .patch(handlers::update_object)
                .delete(handlers::delete_object),
        )
}
