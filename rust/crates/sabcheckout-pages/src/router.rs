//! Mountable router. Mount under `/v1/sabcheckout/pages`.
//!
//! Also exposes a *public* sub-route `/public/by-slug/:slug` that is
//! intentionally unauthenticated — the public payment page at
//! `/pay/[pageSlug]` resolves through it.

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
        .route("/", get(handlers::list_pages).post(handlers::create_page))
        .route(
            "/{pageId}",
            get(handlers::get_page)
                .patch(handlers::update_page)
                .delete(handlers::delete_page),
        )
        // Public (unauthenticated) — page resolution by slug for the
        // hosted `/pay/[pageSlug]` route.
        .route("/public/by-slug/{slug}", get(handlers::public_get_by_slug))
}
