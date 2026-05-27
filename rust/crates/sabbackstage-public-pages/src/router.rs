//! Mountable router. Mount under `/v1/sabbackstage/public-pages`.
//!
//! Admin CRUD + public-slug resolver. The public resolver is
//! unauthenticated and only returns rows whose status is `live`.

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
            get(handlers::list_public_pages).post(handlers::create_public_page),
        )
        .route(
            "/{id}",
            get(handlers::get_public_page)
                .patch(handlers::update_public_page)
                .delete(handlers::delete_public_page),
        )
        .route("/public/by-slug/{slug}", get(handlers::public_get_by_slug))
}
