//! Mountable router. Mount under `/v1/sabcheckout/links`.

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
        .route("/", get(handlers::list_links).post(handlers::create_link))
        .route(
            "/{linkId}",
            get(handlers::get_link)
                .patch(handlers::update_link)
                .delete(handlers::delete_link),
        )
}
