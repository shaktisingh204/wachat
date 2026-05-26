//! Mountable router. Mount under `/v1/sabsign/envelopes`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
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
            "/{envelopeId}",
            get(handlers::get_envelope)
                .patch(handlers::update_envelope)
                .delete(handlers::delete_envelope),
        )
        .route("/{envelopeId}/send", post(handlers::send_envelope))
        .route("/{envelopeId}/void", post(handlers::void_envelope))
        // Public sign-page submission. This route is unauthenticated at the
        // axum layer because the signer is an external party; auth is
        // enforced inside `submit_signature` via the per-signer
        // `accessToken` + auth method. Mount under a separate `/public`
        // tree if your auth middleware blocks unauthenticated requests.
        .route(
            "/{envelopeId}/submit",
            post(handlers::submit_signature),
        )
}
