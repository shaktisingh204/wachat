//! Mountable router for `/v1/sabshow/publications/*`.
//!
//! The `/public/{slug}` route is the only **unauthenticated** endpoint
//! across SabShow — it powers the public deck viewer at
//! `src/app/present/[publishSlug]/page.tsx`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// ```text
/// GET    /                       — list_publications (auth)
/// POST   /                       — publish_deck      (auth, idempotent upsert)
/// PATCH  /{publicationId}        — update_publication (auth)
/// DELETE /{publicationId}        — unpublish         (auth)
/// GET    /public/{slug}          — get_public_by_slug (UNAUTHENTICATED)
/// ```
///
/// NOTE: the authenticated routes still rely on the standard
/// `AuthUser` extractor. The integrator must avoid wrapping the
/// `/public/*` subtree in an `AuthLayer`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_publications).post(handlers::publish_deck),
        )
        .route(
            "/{publicationId}",
            patch(handlers::update_publication).delete(handlers::unpublish),
        )
        // UNAUTHENTICATED — caller must not wrap this in AuthLayer.
        .route("/public/{slug}", get(handlers::get_public_by_slug))
        // Convenience alias for explicit POST + DELETE on full URLs.
        .route("/unpublish/{publicationId}", delete(handlers::unpublish))
}
