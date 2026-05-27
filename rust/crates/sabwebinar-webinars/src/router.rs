//! Mountable router. Mount under `/v1/sabwebinar/webinars`.
//!
//! `GET /by-slug/:slug` is **unauthenticated** — public landing pages
//! consume it. Every other route requires `AuthUser` and is host-scoped.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
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
            get(handlers::list_webinars).post(handlers::create_webinar),
        )
        .route(
            "/{webinarId}",
            get(handlers::get_webinar)
                .patch(handlers::update_webinar)
                .delete(handlers::delete_webinar),
        )
        // Public — unauthenticated landing-page lookup by slug.
        .route("/by-slug/{slug}", get(handlers::get_webinar_by_slug))
}
