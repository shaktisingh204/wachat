//! Mountable router for SabVault Secret endpoints.
//!
//! Mount under `/v1/sabvault/secrets` from the host `api` crate:
//!
//! ```ignore
//! use sabvault_secrets;
//! .nest("/v1/sabvault/secrets", sabvault_secrets::router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Routes (relative — caller nests under `/v1/sabvault/secrets`):
///
/// ```text
/// GET    /             — list_secrets
/// POST   /             — create_secret
/// GET    /{secretId}   — get_secret
/// PATCH  /{secretId}   — update_secret
/// DELETE /{secretId}   — delete_secret (soft → status: archived)
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
            get(handlers::list_secrets).post(handlers::create_secret),
        )
        .route(
            "/{secretId}",
            get(handlers::get_secret)
                .patch(handlers::update_secret)
                .delete(handlers::delete_secret),
        )
}
