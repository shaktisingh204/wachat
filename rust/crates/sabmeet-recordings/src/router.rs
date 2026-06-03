//! Mountable router. Mount under `/v1/sabmeet/recordings`.

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
            get(handlers::list_recordings).post(handlers::start_recording),
        )
        .route(
            "/{recordingId}",
            axum::routing::delete(handlers::delete_recording),
        )
        .route(
            "/{recordingId}/complete",
            post(handlers::complete_recording),
        )
        .route("/{recordingId}/fail", post(handlers::fail_recording))
}
