//! Mountable router. Mount under `/v1/crm/tags` from the host `api` crate.

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
        .route("/", get(handlers::list_tags).post(handlers::create_tag))
        .route(
            "/{tagId}",
            get(handlers::get_tag)
                .patch(handlers::update_tag)
                .delete(handlers::delete_tag),
        )
}
