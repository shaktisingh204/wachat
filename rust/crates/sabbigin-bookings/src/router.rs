//! Mountable router for the SabBigin booking-page endpoints.
//!
//! Mount under `/v1/sabbigin/bookings` from the host `api` crate:
//!
//! ```ignore
//! use sabbigin_bookings;
//! .nest("/v1/sabbigin/bookings", sabbigin_bookings::router::<AppState>())
//! ```
//!
//! Routes (relative — caller nests under `/v1/sabbigin/bookings`):
//!
//! ```text
//! GET    /            — list_pages
//! POST   /            — create_page
//! GET    /slug/{slug} — get_by_slug
//! GET    /{pageId}    — get_page
//! PATCH  /{pageId}    — update_page
//! DELETE /{pageId}    — delete_page (soft → status: archived)
//! ```

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
        .route("/slug/{slug}", get(handlers::get_by_slug))
        .route(
            "/{pageId}",
            get(handlers::get_page)
                .patch(handlers::update_page)
                .delete(handlers::delete_page),
        )
}
