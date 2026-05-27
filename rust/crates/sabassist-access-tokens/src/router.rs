//! Mountable routers.
//!
//! Two surfaces:
//! * `router()` — authenticated technician surface, mount under
//!   `/v1/sabassist/access-tokens`. Has list / issue / revoke.
//! * `public_router()` — UNAUTHENTICATED redeem endpoint, mount under
//!   `/v1/sabassist/public/redeem`. Must be wired outside the auth layer.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_tokens).post(handlers::issue_token),
        )
        .route("/{tokenId}", delete(handlers::revoke_token))
}

/// Unauthenticated. The host crate must mount this outside the auth middleware.
pub fn public_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
{
    Router::new().route("/redeem", post(handlers::redeem_token))
}
