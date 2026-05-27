//! Mountable router for `/v1/sabshow/versions/*`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// ```text
/// GET    /                — list_versions (?deckId=…)
/// POST   /                — create_version
/// GET    /{versionId}     — get_version
/// ```
///
/// Restore is intentionally not exposed here — see the module-level doc
/// in `lib.rs` for the cross-crate coordination.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_versions).post(handlers::create_version),
        )
        .route("/{versionId}", get(handlers::get_version))
}
