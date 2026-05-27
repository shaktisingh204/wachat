//! Mountable router. Mount under `/v1/sabwebinar/polls`.
//!
//! `POST /public/:pollId/vote` is unauthenticated.

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
        .route("/", get(handlers::list_polls).post(handlers::create_poll))
        .route(
            "/{pollId}",
            get(handlers::get_poll).patch(handlers::update_poll),
        )
        // Public — unauthenticated vote.
        .route("/public/{pollId}/vote", post(handlers::vote_poll_public))
        // Public — list open polls for a webinar (read-only).
        .route(
            "/public/by-webinar/{webinarId}",
            get(handlers::list_polls_public),
        )
}
