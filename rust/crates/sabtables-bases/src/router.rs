//! Mountable router. Mount under `/v1/sabtables/bases`.

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
        .route("/", get(handlers::list_bases).post(handlers::create_base))
        .route(
            "/{baseId}",
            get(handlers::get_base)
                .patch(handlers::update_base)
                .delete(handlers::delete_base),
        )
}
