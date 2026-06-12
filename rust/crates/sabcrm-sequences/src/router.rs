//! Axum router for the SabCRM sequences (cadences) HTTP surface.
//!
//! Exposed as a free function so the orchestrating `api` crate can mount
//! this router into its outer `AppState`:
//!
//! ```ignore
//! .nest("/v1/sabcrm/sequences", sabcrm_sequences::router::<AppState>())
//! ```
//!
//! `S` only has to expose two slices via `FromRef`:
//!
//! - [`MongoHandle`] — for collection access; and
//! - `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Routes (mounted relative — caller nests under `/v1/sabcrm/sequences`):
//!
//! ```text
//! GET    /                            — list_sequences (status filter + pagination)
//! POST   /                            — create_sequence
//! GET    /enrollments                 — list_enrollments
//! POST   /enrollments/{id}/unenroll   — unenroll_enrollment
//! GET    /{id}                        — get_sequence
//! PATCH  /{id}                        — update_sequence
//! DELETE /{id}                        — delete_sequence
//! POST   /{id}/enroll                 — enroll_records
//! ```
//!
//! The static `/enrollments` routes are declared alongside the `/{id}` param
//! routes — axum's matcher prefers the static segment, so `enrollments` is
//! never swallowed as a sequence id.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the SabCRM sequences router. See module docs for the route table
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
            get(handlers::list_sequences).post(handlers::create_sequence),
        )
        .route("/enrollments", get(handlers::list_enrollments))
        .route(
            "/enrollments/{id}/unenroll",
            post(handlers::unenroll_enrollment),
        )
        .route(
            "/{id}",
            get(handlers::get_sequence)
                .patch(handlers::update_sequence)
                .delete(handlers::delete_sequence),
        )
        .route("/{id}/enroll", post(handlers::enroll_records))
}
