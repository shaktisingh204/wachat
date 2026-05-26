//! Mountable router. Mount under `/v1/sabrewards/redemptions`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, patch}};
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
            get(handlers::list_redemptions).post(handlers::create_redemption),
        )
        .route("/{redemptionId}", get(handlers::get_redemption))
        .route(
            "/{redemptionId}/status",
            patch(handlers::update_redemption_status),
        )
}
