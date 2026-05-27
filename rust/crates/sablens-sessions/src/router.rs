//! Mountable routers.
//!
//! Technician router (`router()`) — JWT-authenticated, mount under
//! `/v1/sablens/sessions`.
//!
//! Public router (`public_router()`) — token-only, mount under
//! `/v1/sablens/sessions-public`.

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
        .route(
            "/",
            get(handlers::list_sessions).post(handlers::create_session),
        )
        .route(
            "/{sessionId}",
            get(handlers::get_session)
                .patch(handlers::update_session)
                .delete(handlers::delete_session),
        )
        .route("/{sessionId}/start", post(handlers::start_session))
        .route("/{sessionId}/end", post(handlers::end_session))
        .route(
            "/{sessionId}/snapshots",
            post(handlers::append_snapshot),
        )
        .route(
            "/{sessionId}/customer-token",
            post(handlers::reissue_customer_token),
        )
}

pub fn public_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
{
    Router::new()
        .route(
            "/{token}",
            get(handlers::redeem_customer_token),
        )
        .route(
            "/{token}/join",
            post(handlers::customer_join),
        )
}
