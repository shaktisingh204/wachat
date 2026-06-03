//! Mountable router. Mount under `/v1/sabcheckout/sessions`.
//!
//! The `/public/*` sub-routes are intentionally unauthenticated — they
//! are called from the public payment page.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
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
        .route("/", get(handlers::list_sessions))
        .route("/{sessionId}", get(handlers::get_session))
        // Public (unauthenticated) routes:
        .route("/public", post(handlers::public_create_session))
        .route("/public/confirm", post(handlers::public_confirm_session))
}
