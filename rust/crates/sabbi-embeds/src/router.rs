//! Two mountable routers.
//!
//! - `router()` — authenticated CRUD, mount under `/v1/sabbi/embeds`.
//! - `public_router()` — anonymous token resolution, mount under
//!   `/public/sabbi/embeds` (no auth middleware).

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
        .route("/", get(handlers::list_embeds).post(handlers::create_embed))
        .route(
            "/{embedId}",
            post(handlers::update_embed)
                .patch(handlers::update_embed)
                .delete(handlers::delete_embed),
        )
}

pub fn public_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
{
    Router::new().route("/{token}", get(handlers::resolve_public_embed))
}
