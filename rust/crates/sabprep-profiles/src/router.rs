//! Mountable router for `/v1/sabprep/profiles`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Routes (relative — caller nests under `/v1/sabprep/profiles`):
///
/// ```text
/// GET    /              — list_profiles
/// POST   /              — create_profile (persists)
/// POST   /compute       — compute_profile (ad-hoc rows, no persist)
/// GET    /{profileId}   — get_profile
/// DELETE /{profileId}   — delete_profile
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_profiles).post(handlers::create_profile),
        )
        .route("/compute", post(handlers::compute_profile))
        .route(
            "/{profileId}",
            get(handlers::get_profile).delete(handlers::delete_profile),
        )
}
