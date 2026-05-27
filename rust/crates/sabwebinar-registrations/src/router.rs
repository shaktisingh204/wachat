//! Mountable router. Mount under `/v1/sabwebinar/registrations`.
//!
//! `POST /public/by-slug/:slug` is **unauthenticated** — public landing form
//! posts here. Host list/get/update endpoints require auth.

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
        .route("/", get(handlers::list_registrations))
        .route("/{registrationId}", get(handlers::get_registration))
        // Public — unauthenticated registration by slug.
        .route(
            "/public/by-slug/{slug}",
            post(handlers::create_registration_by_slug),
        )
        // Public — record join/leave timestamps using join_token.
        .route(
            "/public/{joinToken}/join",
            post(handlers::mark_joined_public),
        )
        .route("/public/{joinToken}/leave", post(handlers::mark_left_public))
}
