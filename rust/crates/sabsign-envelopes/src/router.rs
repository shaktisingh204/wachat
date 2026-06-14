//! Mountable router. Mount under `/v1/sabsign/envelopes`.
//!
//! The `/{id}/sign` (GET) and `/{id}/submit` (POST) routes are public: their
//! handlers take no [`AuthUser`], so they are reachable without a JWT and
//! authenticate the external signer via the per-signer access token instead.

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
            get(handlers::list_envelopes).post(handlers::create_envelope),
        )
        .route(
            "/{id}",
            get(handlers::get_envelope)
                .patch(handlers::update_envelope)
                .delete(handlers::delete_envelope),
        )
        .route("/{id}/send", post(handlers::send_envelope))
        .route("/{id}/void", post(handlers::void_envelope))
        // Public (no session) — signer-token authenticated:
        .route("/{id}/sign", get(handlers::sign_view))
        .route("/{id}/submit", post(handlers::submit_envelope))
}
